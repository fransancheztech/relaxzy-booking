import { prisma } from "@/lib/prisma";
import { canonicalPhone } from "@/utils/phone";
import { normalizeNameForCompare } from "@/utils/placeholderName";

// Duplicate clients = active clients whose phones are the same number in different spellings.
// Grouped by the canonical E.164 form from libphonenumber, the same rule writes now use, so a group
// here is exactly a number that two or more client rows claim.
//
// On the live data (2026-10-18) no group disagreed on surname or email and only one had notes:
// the only thing that ever differs is the NAME. Most are the same person (identical names,
// typos, nicknames), but some are genuinely different people sharing a phone (a couple), which
// is why every group goes through a human decision and none is merged automatically.

export type DuplicateKind = "same" | "similar" | "different";

export type DuplicateMember = {
  id: string;
  client_name: string | null;
  client_surname: string | null;
  client_phone: string | null;
  client_email: string | null;
  client_notes: string | null;
  created_at: string;
  bookings: number;
  last_visit: string | null;
  vouchers: number;
};

export type DuplicateGroup = {
  /** The shared number, E.164. */
  phone: string;
  kind: DuplicateKind;
  /** Most bookings first, then oldest — so members[0] is the default record to keep. */
  members: DuplicateMember[];
};

export const memberFullName = (m: { client_name: string | null; client_surname: string | null }) =>
  [m.client_name, m.client_surname].map((s) => s?.trim()).filter(Boolean).join(" ");

function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/**
 * A hint for the reviewer, never a decision: "same" (identical after normalising), "similar"
 * (every pair is a shortening — Ste/Stephane — or within two typos — Elisabeth/Elizabeth), or
 * "different" (e.g. Adam/Ruth: possibly two people sharing a phone).
 */
export function classifyNames(names: string[]): DuplicateKind {
  const n = [...new Set(names.map((s) => normalizeNameForCompare(s)).filter(Boolean))];
  if (n.length <= 1) return "same";
  const close = (a: string, b: string) =>
    a.startsWith(b) || b.startsWith(a) || (Math.min(a.length, b.length) >= 4 && editDistance(a, b) <= 2);
  return n.every((a, i) => n.every((b, j) => i === j || close(a, b))) ? "similar" : "different";
}

const KIND_ORDER: Record<DuplicateKind, number> = { same: 0, similar: 1, different: 2 };

export async function loadDuplicateGroups(): Promise<DuplicateGroup[]> {
  const clients = await prisma.clients.findMany({
    where: { deleted_at: null, client_phone: { not: null } },
    select: {
      id: true,
      client_name: true,
      client_surname: true,
      client_phone: true,
      client_email: true,
      client_notes: true,
      created_at: true,
    },
  });

  const byNumber = new Map<string, typeof clients>();
  for (const c of clients) {
    const key = canonicalPhone(c.client_phone);
    if (!key) continue;
    const list = byNumber.get(key);
    if (list) list.push(c);
    else byNumber.set(key, [c]);
  }
  const shared = [...byNumber.entries()].filter(([, list]) => list.length > 1);
  if (shared.length === 0) return [];

  const ids = shared.flatMap(([, list]) => list.map((c) => c.id));
  const stats = await prisma.$queryRaw<{ id: string; bookings: number; last_visit: Date | null; vouchers: number }[]>`
    SELECT c.id::text AS id,
           (SELECT count(*)::int FROM bookings b WHERE b.client_id = c.id AND b.deleted_at IS NULL) AS bookings,
           (SELECT max(b.start_time) FROM bookings b WHERE b.client_id = c.id AND b.deleted_at IS NULL) AS last_visit,
           (SELECT count(*)::int FROM vouchers v
             WHERE (v.buyer_id = c.id OR v.recipient_id = c.id) AND v.deleted_at IS NULL) AS vouchers
    FROM clients c
    WHERE c.id = ANY (${ids}::uuid[])`;
  const statById = new Map(stats.map((s) => [s.id, s]));

  const groups: DuplicateGroup[] = shared.map(([phone, list]) => {
    const members: DuplicateMember[] = list
      .map((c) => {
        const s = statById.get(c.id);
        return {
          id: c.id,
          client_name: c.client_name,
          client_surname: c.client_surname,
          client_phone: c.client_phone,
          client_email: c.client_email,
          client_notes: c.client_notes,
          created_at: c.created_at.toISOString(),
          bookings: Number(s?.bookings ?? 0),
          last_visit: s?.last_visit ? new Date(s.last_visit).toISOString() : null,
          vouchers: Number(s?.vouchers ?? 0),
        };
      })
      .sort((a, b) => b.bookings - a.bookings || a.created_at.localeCompare(b.created_at));
    return { phone, kind: classifyNames(members.map(memberFullName)), members };
  });

  const total = (g: DuplicateGroup) => g.members.reduce((s, m) => s + m.bookings, 0);
  return groups.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || total(b) - total(a));
}

// ─── Possible phone typos ────────────────────────────────────────────────────────────────────
//
// The second kind of duplicate: two clients whose numbers differ by exactly ONE digit and whose
// names are compatible (Bruno Pantoja +34629256170 vs Bruno +34629250170). Usually one person with
// a mistyped number — but two real people can have numbers a digit apart (a couple on consecutive
// lines), so every pair is a human decision: merge, or mark as different people
// (client_duplicate_dismissals) so it isn't suggested again.

export type TypoMember = DuplicateMember & { number: string; first_visit: string | null };
export type TypoPair = { a: TypoMember; b: TypoMember };

/** Same length, exactly one digit different — the shape of a single mistyped key. */
export function oneDigitApart(x: string, y: string): boolean {
  if (x.length !== y.length || x === y) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i] && ++diff > 1) return false;
  return diff === 1;
}

/**
 * Names that could plausibly be the same person: same first word ("Daniel" / "Daniel Pañart"), or
 * not "different" by the shared classifier (shortenings, small typos). Both must have a name: a
 * nameless record next to a similar number is noise, not evidence.
 */
export function compatibleNames(x: string, y: string): boolean {
  const nx = normalizeNameForCompare(x);
  const ny = normalizeNameForCompare(y);
  if (!nx || !ny) return false;
  if (nx.split(" ")[0] === ny.split(" ")[0]) return true;
  return classifyNames([x, y]) !== "different";
}

export async function loadTypoPairs(): Promise<{ pairs: TypoPair[]; waiting: number }> {
  const clients = await prisma.clients.findMany({
    where: { deleted_at: null, client_phone: { not: null } },
    select: {
      id: true,
      client_name: true,
      client_surname: true,
      client_phone: true,
      client_email: true,
      client_notes: true,
      created_at: true,
    },
  });

  const holders = new Map<string, typeof clients>();
  for (const c of clients) {
    const key = canonicalPhone(c.client_phone);
    if (!key) continue;
    const list = holders.get(key);
    if (list) list.push(c);
    else holders.set(key, [c]);
  }

  // Bucket every number under each of its "one digit masked" forms: two numbers one digit apart
  // share exactly one bucket. Avoids comparing ~2,800 numbers against each other.
  const buckets = new Map<string, string[]>();
  for (const number of holders.keys()) {
    for (let i = 1; i < number.length; i++) {
      const key = `${number.slice(0, i)}_${number.slice(i + 1)}`;
      const list = buckets.get(key);
      if (list) list.push(number);
      else buckets.set(key, [number]);
    }
  }

  const dismissed = new Set(
    (await prisma.client_duplicate_dismissals.findMany({ select: { client_a: true, client_b: true } }))
      .map((d) => `${d.client_a}|${d.client_b}`),
  );

  const candidates = new Map<string, [(typeof clients)[number], (typeof clients)[number], string, string]>();
  let waiting = 0;
  const waitingSeen = new Set<string>();
  for (const numbers of buckets.values()) {
    if (numbers.length < 2) continue;
    for (let i = 0; i < numbers.length; i++) {
      for (let j = i + 1; j < numbers.length; j++) {
        const [nx, ny] = [numbers[i], numbers[j]];
        if (!oneDigitApart(nx, ny)) continue;
        const hx = holders.get(nx)!;
        const hy = holders.get(ny)!;
        // A number still shared by several clients is a same-phone group to resolve first;
        // mixing both problems in one card would make the decision unclear.
        if (hx.length > 1 || hy.length > 1) {
          const key = [nx, ny].sort().join("|");
          if (!waitingSeen.has(key)) {
            waitingSeen.add(key);
            waiting++;
          }
          continue;
        }
        const [x, y] = [hx[0], hy[0]];
        if (!compatibleNames(memberFullName(x), memberFullName(y))) continue;
        const [first, second] = x.id < y.id ? [x, y] : [y, x];
        const pairKey = `${first.id}|${second.id}`;
        if (dismissed.has(pairKey)) continue;
        candidates.set(pairKey, [x, y, nx, ny]);
      }
    }
  }
  if (candidates.size === 0) return { pairs: [], waiting };

  const ids = [...candidates.values()].flatMap(([x, y]) => [x.id, y.id]);
  const stats = await prisma.$queryRaw<
    { id: string; bookings: number; first_visit: Date | null; last_visit: Date | null; vouchers: number }[]
  >`
    SELECT c.id::text AS id,
           (SELECT count(*)::int FROM bookings b WHERE b.client_id = c.id AND b.deleted_at IS NULL) AS bookings,
           (SELECT min(b.start_time) FROM bookings b WHERE b.client_id = c.id AND b.deleted_at IS NULL) AS first_visit,
           (SELECT max(b.start_time) FROM bookings b WHERE b.client_id = c.id AND b.deleted_at IS NULL) AS last_visit,
           (SELECT count(*)::int FROM vouchers v
             WHERE (v.buyer_id = c.id OR v.recipient_id = c.id) AND v.deleted_at IS NULL) AS vouchers
    FROM clients c
    WHERE c.id = ANY (${ids}::uuid[])`;
  const statById = new Map(stats.map((s) => [s.id, s]));

  const toMember = (c: (typeof clients)[number], number: string): TypoMember => {
    const s = statById.get(c.id);
    return {
      id: c.id,
      client_name: c.client_name,
      client_surname: c.client_surname,
      client_phone: c.client_phone,
      client_email: c.client_email,
      client_notes: c.client_notes,
      created_at: c.created_at.toISOString(),
      bookings: Number(s?.bookings ?? 0),
      first_visit: s?.first_visit ? new Date(s.first_visit).toISOString() : null,
      last_visit: s?.last_visit ? new Date(s.last_visit).toISOString() : null,
      vouchers: Number(s?.vouchers ?? 0),
      number,
    };
  };

  // Default order inside a pair = the likely survivor first: more bookings, then the more recent
  // visit — the number someone keeps using is the one that's right.
  const rank = (m: TypoMember) => [m.bookings, m.last_visit ?? ""] as const;
  const pairs = [...candidates.values()].map(([x, y, nx, ny]) => {
    const [mx, my] = [toMember(x, nx), toMember(y, ny)];
    const [rx, ry] = [rank(mx), rank(my)];
    const xFirst = rx[0] !== ry[0] ? rx[0] > ry[0] : rx[1] >= ry[1];
    return xFirst ? { a: mx, b: my } : { a: my, b: mx };
  });

  pairs.sort((p, q) => q.a.bookings + q.b.bookings - (p.a.bookings + p.b.bookings));
  return { pairs, waiting };
}

// ─── Client summaries (for any two-client merge screen) ──────────────────────────────────────

/** An active client plus the activity a reviewer needs to decide which record to keep. */
export type ClientSummary = DuplicateMember & { first_visit: string | null };

/** Active clients with their booking/voucher activity, in the order of `ids` (missing ids skipped). */
export async function loadClientSummaries(ids: string[]): Promise<ClientSummary[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.$queryRaw<
    {
      id: string;
      client_name: string | null;
      client_surname: string | null;
      client_phone: string | null;
      client_email: string | null;
      client_notes: string | null;
      created_at: Date;
      bookings: number;
      first_visit: Date | null;
      last_visit: Date | null;
      vouchers: number;
    }[]
  >`
    SELECT c.id::text AS id, c.client_name, c.client_surname, c.client_phone, c.client_email,
           c.client_notes, c.created_at,
           (SELECT count(*)::int FROM bookings b WHERE b.client_id = c.id AND b.deleted_at IS NULL) AS bookings,
           (SELECT min(b.start_time) FROM bookings b WHERE b.client_id = c.id AND b.deleted_at IS NULL) AS first_visit,
           (SELECT max(b.start_time) FROM bookings b WHERE b.client_id = c.id AND b.deleted_at IS NULL) AS last_visit,
           (SELECT count(*)::int FROM vouchers v
             WHERE (v.buyer_id = c.id OR v.recipient_id = c.id) AND v.deleted_at IS NULL) AS vouchers
    FROM clients c
    WHERE c.id = ANY (${ids}::uuid[]) AND c.deleted_at IS NULL`;
  const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);
  const byId = new Map(
    rows.map((r) => [
      r.id,
      {
        ...r,
        created_at: new Date(r.created_at).toISOString(),
        bookings: Number(r.bookings),
        vouchers: Number(r.vouchers),
        first_visit: iso(r.first_visit),
        last_visit: iso(r.last_visit),
      },
    ]),
  );
  return ids.map((id) => byId.get(id)).filter((c): c is ClientSummary => !!c);
}

// ─── Voucher recipients ──────────────────────────────────────────────────────────────────────
//
// The third kind of duplicate, which no phone comparison can find: a gift voucher's recipient was
// saved by name only (no phone, no email), and when that person came in to use it, the booking
// was made under a second record WITH their phone, which then redeemed the voucher. Same name (or
// one is the other plus a surname), and the voucher ties them together.

export type VoucherPairUse = {
  code: string;
  /** Who bought the voucher for the recipient. */
  buyer: string | null;
  used_at: string | null;
  amount: number;
};

export type VoucherPair = {
  /** The contactless record the voucher was made out to. */
  recipient: ClientSummary;
  /** The record that redeemed it (usually has the phone). */
  redeemer: ClientSummary;
  uses: VoucherPairUse[];
};

export async function loadVoucherRecipientPairs(): Promise<VoucherPair[]> {
  const rows = await prisma.$queryRaw<
    { r_id: string; c_id: string; code: string; buyer_id: string | null; used_at: Date | null; amount: number }[]
  >`
    SELECT r.id::text AS r_id, c.id::text AS c_id, v.code, v.buyer_id::text AS buyer_id,
           u.created_at AS used_at, u.amount::float AS amount
    FROM voucher_uses u
    JOIN vouchers v ON v.id = u.voucher_id AND v.deleted_at IS NULL
    JOIN clients r ON r.id = v.recipient_id AND r.deleted_at IS NULL
                  AND r.client_phone IS NULL AND r.client_email IS NULL
    JOIN clients c ON c.id = u.recipient_id AND c.deleted_at IS NULL AND c.id <> r.id
    WHERE u.deleted_at IS NULL
      AND r.client_full_name_folded <> ''
      AND (c.client_full_name_folded = r.client_full_name_folded
           OR c.client_full_name_folded LIKE r.client_full_name_folded || ' %'
           OR r.client_full_name_folded LIKE c.client_full_name_folded || ' %')
    ORDER BY u.created_at DESC`;
  if (rows.length === 0) return [];

  const dismissed = new Set(
    (await prisma.client_duplicate_dismissals.findMany({ select: { client_a: true, client_b: true } }))
      .map((d) => `${d.client_a}|${d.client_b}`),
  );
  const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

  const grouped = new Map<string, { r: string; c: string; uses: typeof rows }>();
  for (const row of rows) {
    const key = pairKey(row.r_id, row.c_id);
    if (dismissed.has(key)) continue;
    const g = grouped.get(key);
    if (g) g.uses.push(row);
    else grouped.set(key, { r: row.r_id, c: row.c_id, uses: [row] });
  }
  if (grouped.size === 0) return [];

  const ids = [...new Set([...grouped.values()].flatMap((g) => [g.r, g.c]))];
  const buyerIds = [...new Set(rows.map((r) => r.buyer_id).filter((id): id is string => !!id))];
  const [summaries, buyers] = await Promise.all([
    loadClientSummaries(ids),
    prisma.clients.findMany({
      where: { id: { in: buyerIds } },
      select: { id: true, client_name: true, client_surname: true },
    }),
  ]);
  const summaryById = new Map(summaries.map((s) => [s.id, s]));
  const buyerName = (id: string | null) => {
    const b = buyers.find((x) => x.id === id);
    return b ? memberFullName(b) || null : null;
  };

  const pairs: VoucherPair[] = [];
  for (const g of grouped.values()) {
    const recipient = summaryById.get(g.r);
    const redeemer = summaryById.get(g.c);
    if (!recipient || !redeemer) continue;
    pairs.push({
      recipient,
      redeemer,
      uses: g.uses.map((u) => ({
        code: u.code,
        buyer: u.buyer_id === g.r ? null : buyerName(u.buyer_id),
        used_at: u.used_at ? new Date(u.used_at).toISOString() : null,
        amount: Number(u.amount),
      })),
    });
  }
  return pairs;
}

/** The stable code a merge_clients / unmerge_clients RAISE carries, if this error is one. */
export function mergeErrorCode(err: unknown): string | null {
  const message = String((err as { message?: unknown })?.message ?? "");
  return message.match(/\b((?:UN)?MERGE_[A-Z_]+)\b/)?.[1] ?? null;
}

/** A Postgres unique-violation (SQLSTATE 23505) surfaced through a raw query. */
export function isRawUniqueViolation(err: unknown): boolean {
  const message = String((err as { message?: unknown })?.message ?? "");
  return message.includes("23505") || /unique/i.test(message);
}

/**
 * A raw-SQL CHECK violation, e.g. undoing a merge made before clients_phone_e164 /
 * clients_email_canonical existed: it would bring back a phone or email in the old format.
 */
export function isRawCheckViolation(err: unknown): boolean {
  const message = String((err as { message?: unknown })?.message ?? "");
  return message.includes("23514") || /check constraint/i.test(message);
}
