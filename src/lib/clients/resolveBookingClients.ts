import { Prisma } from "generated/prisma";
import type {
  CandidateVoucher,
  ClientConflict,
  ClientPreview,
  ClientResolution,
  ContactlessCandidate,
} from "@/types/clientConflict";
import { isPlaceholderClientName } from "@/utils/placeholderName";
import { assertContactFree } from "@/lib/clients/contactCollision";
import { canonicalPhone, resolvePhoneUpdate, samePhone } from "@/utils/phone";
import { canonicalEmail } from "@/utils/email";
import { foldFullName, foldText } from "@/utils/text";
import { normalizeClientName, normalizeClientSurname } from "@/utils/names";

export type ClientInput = {
  client_name?: string | null;
  client_surname?: string | null;
  client_email?: string | null;
  client_phone?: string | null;
  /**
   * The client picked from the suggestions dropdown — or, when editing a booking, the booking's
   * current client. Picking fills the form fields only, so without this the server couldn't tell
   * "Carina, picked from the list, plus the phone she just gave" from a brand-new Carina.
   */
  client_picked_id?: string | null;
};

const normalize = (v?: string | null) => (v && v.trim() !== "" ? v.trim() : null);
const sameText = (a?: string | null, b?: string | null) =>
  (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Most contactless candidates listed in the "same person?" dialog. */
const MAX_CANDIDATES = 5;

export class ClientConflictError extends Error {
  conflicts: ClientConflict[];
  constructor(conflicts: ClientConflict[]) {
    super("CLIENT_NAME_CONFLICT");
    this.name = "ClientConflictError";
    this.conflicts = conflicts;
  }
}

// Thrown when a client name is a placeholder for an unknown client (e.g. "walk-in",
// "anon"). Carries httpStatus so routes can surface it as a 400 with the message.
export class PlaceholderNameError extends Error {
  httpStatus = 400;
  constructor(message: string) {
    super(message);
    this.name = "PlaceholderNameError";
  }
}

export const hasClientInfo = (input: ClientInput) =>
  !!(input.client_name || input.client_surname || input.client_email || input.client_phone);

const CLIENT_SELECT = {
  id: true,
  client_name: true,
  client_surname: true,
  client_email: true,
  client_phone: true,
  client_name_folded: true,
  client_full_name_folded: true,
} as const;

type MatchedClient = Prisma.clientsGetPayload<{ select: typeof CLIENT_SELECT }>;

/**
 * What saving changes on an existing client: empty phone / email / surname filled in, or a name or
 * surname whose typed spelling only ADDS accents ("Jesus" → "Jesús"). Nothing else is overwritten.
 */
type ClientFill = { phone: string | null; email: string | null; surname: string | null; name: string | null };
const NO_FILL: ClientFill = { phone: null, email: null, surname: null, name: null };

const stripAccents = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/**
 * The typed spelling when it is the stored one with accents ADDED and nothing else changed —
 * "Jesus" → "Jesús", "Pena" → "Peña" — otherwise null. Never removes an accent ("Jesús" typed as
 * "Jesus" changes nothing), never changes letters or capitals, so a quick unaccented typing can't
 * undo a correct spelling, and only a deliberate correction is saved.
 */
export function accentUpgrade(stored: string | null | undefined, typed: string | null | undefined): string | null {
  const a = stored?.normalize("NFC") ?? "";
  const b = typed?.normalize("NFC") ?? "";
  if (!a || !b || a === b || a.length !== b.length) return null;
  let added = false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    // Only an unaccented stored letter may gain an accent, and it must stay the same letter.
    if (stripAccents(a[i]) !== a[i] || stripAccents(b[i]) !== a[i]) return null;
    added = true;
  }
  return added ? b : null;
}

/**
 * What saving one client slot will do. The single decision point for saving (applyClientSlot),
 * for the conflict dialog (detectClientConflict) and for the live hint under the client fields
 * (previewClientSlot) — so the hint always says exactly what Save is about to do.
 */
type SlotPlan =
  | { kind: "none" }
  | { kind: "existing"; client: MatchedClient; fill: ClientFill }
  | { kind: "rename"; client: MatchedClient }
  | { kind: "conflict"; conflict: ClientConflict }
  | { kind: "new" };

// Contact tier: the typed email (first) or phone already belongs to an active client.
async function findContactMatch(
  db: Prisma.TransactionClient,
  email: string | null,
  phone: string | null,
): Promise<{ client: MatchedClient; matchedBy: "email" | "phone" } | null> {
  if (email) {
    // Case-insensitive: emails are stored lower-cased now, but rows written before that may not be.
    const client = await db.clients.findFirst({
      where: { client_email: { equals: email, mode: "insensitive" }, deleted_at: null },
      select: CLIENT_SELECT,
    });
    if (client) return { client, matchedBy: "email" };
  }
  if (phone) {
    // Exact stored string FIRST, then the same number typed in any other format. Editing a
    // booking sends the phone back exactly as stored, so this keeps it on the same client row.
    const exact = await db.clients.findFirst({
      where: { client_phone: phone, deleted_at: null },
      select: CLIENT_SELECT,
    });
    if (exact) return { client: exact, matchedBy: "phone" };
    const canonical = canonicalPhone(phone);
    if (canonical && canonical !== phone) {
      const client = await db.clients.findFirst({
        where: { client_phone: canonical, deleted_at: null },
        select: CLIENT_SELECT,
      });
      if (client) return { client, matchedBy: "phone" };
    }
  }
  return null;
}

// True when the typed name/surname (whichever is provided) differs from the matched client.
// Accent-sensitive on purpose: typing "Darío" with Dario's phone offers to fix the spelling.
// Accents alone never make it a different name: typing "Jesús" for a stored "Jesus" saves the
// correction (see accentUpgrade), and typing "Jesus" for a stored "Jesús" keeps the stored spelling.
// Neither asks.
const sameNameButAccents = (stored: string | null, typed: string) =>
  sameText(typed, stored) || !!accentUpgrade(stored, typed) || !!accentUpgrade(typed, stored);

function nameDiffers(input: ClientInput, match: MatchedClient): boolean {
  const typedName = normalizeClientName(input.client_name);
  const typedSurname = normalizeClientSurname(input.client_surname);
  if (typedName && !sameNameButAccents(match.client_name, typedName)) return true;
  if (typedSurname && !sameNameButAccents(match.client_surname, typedSurname)) return true;
  return false;
}

/** What the typed fields would change on `client`: empty contact/surname filled, accents added. */
function fillFor(client: MatchedClient, input: ClientInput): ClientFill {
  const typedSurname = normalizeClientSurname(input.client_surname);
  return {
    phone: client.client_phone ? null : canonicalPhone(input.client_phone),
    email: client.client_email ? null : canonicalEmail(input.client_email),
    surname: normalize(client.client_surname) ? accentUpgrade(client.client_surname, typedSurname) : typedSurname,
    name: accentUpgrade(client.client_name, normalizeClientName(input.client_name)),
  };
}

/**
 * The picked client, when the fields still describe them: same name (accents and case aside) — or
 * the same first name with a surname added to a client who had none — and no typed phone/email
 * that contradicts theirs. Otherwise the pick is stale (she picked someone, then typed somebody
 * else) and is ignored.
 */
async function loadPicked(
  db: Prisma.TransactionClient,
  input: ClientInput,
  phone: string | null,
  email: string | null,
): Promise<MatchedClient | null> {
  const id = input.client_picked_id?.trim();
  if (!id || !UUID.test(id)) return null;
  const client = await db.clients.findFirst({ where: { id, deleted_at: null }, select: CLIENT_SELECT });
  if (!client) return null;

  const typedFull = foldFullName(input.client_name, input.client_surname);
  const sameName =
    typedFull !== "" &&
    (typedFull === client.client_full_name_folded ||
      (!normalize(client.client_surname) &&
        !!normalize(input.client_surname) &&
        foldText(input.client_name) === client.client_name_folded));
  if (!sameName) return null;
  if (phone && client.client_phone && !samePhone(phone, client.client_phone)) return null;
  if (email && client.client_email && client.client_email.toLowerCase() !== email) return null;
  return client;
}

// Name tier for a name-only entry (companions, voucher recipients): reuse a contactless client
// with exactly this name + surname, so a name-only client isn't duplicated on every booking. Scoped
// to contactless clients, so it never folds a name-only entry into a contactable client.
async function findExactNameOnly(db: Prisma.TransactionClient, input: ClientInput) {
  const name = normalizeClientName(input.client_name);
  if (!name) return null;
  const surname = normalizeClientSurname(input.client_surname);
  return db.clients.findFirst({
    where: {
      deleted_at: null,
      client_email: null,
      client_phone: null,
      client_name: { equals: name, mode: "insensitive" },
      client_surname: surname ? { equals: surname, mode: "insensitive" } : null,
    },
    select: CLIENT_SELECT,
  });
}

/**
 * Contactless clients that may be the person being typed: same name ignoring accents/case, and no
 * phone or email. When a phone/email WAS typed, only candidates worth asking about are kept — the
 * recipient of a voucher with balance left (the gift recipient who comes in to use it) or a full
 * name with surname. Asking about every contactless "Marta" would mean a prompt most days, mostly
 * for different people, and receptionists would learn to dismiss it.
 */
async function findContactlessCandidates(
  db: Prisma.TransactionClient,
  input: ClientInput,
  contactTyped: boolean,
): Promise<{ clients: MatchedClient[]; candidates: ContactlessCandidate[] }> {
  const full = foldFullName(input.client_name, input.client_surname);
  if (!full) return { clients: [], candidates: [] };

  const rows = await db.clients.findMany({
    where: { deleted_at: null, client_phone: null, client_email: null, client_full_name_folded: full },
    select: { ...CLIENT_SELECT, created_at: true },
    take: 50,
  });
  if (rows.length === 0) return { clients: [], candidates: [] };
  const ids = rows.map((r) => r.id);

  const [vouchers, bookingStats] = await Promise.all([
    db.vouchers.findMany({
      where: { deleted_at: null, OR: [{ recipient_id: { in: ids } }, { buyer_id: { in: ids } }] },
      select: { code: true, balance: true, recipient_id: true, buyer_id: true, created_at: true },
      orderBy: { created_at: "desc" },
    }),
    db.bookings.groupBy({
      by: ["client_id"],
      where: { client_id: { in: ids }, deleted_at: null },
      _count: { _all: true },
      _max: { start_time: true },
    }),
  ]);

  const hasGiftBalance = (id: string) =>
    vouchers.some((v) => v.recipient_id === id && v.buyer_id !== id && Number(v.balance ?? 0) > 0);
  const kept = contactTyped ? rows.filter((r) => full.includes(" ") || hasGiftBalance(r.id)) : rows;
  if (kept.length === 0) return { clients: [], candidates: [] };

  // Names of the other party on each voucher (vouchers.buyer_id / recipient_id carry no FK).
  const otherIds = [...new Set(vouchers.flatMap((v) => [v.buyer_id, v.recipient_id]))].filter(
    (id): id is string => !!id && !ids.includes(id),
  );
  const others = otherIds.length
    ? await db.clients.findMany({
        where: { id: { in: otherIds } },
        select: { id: true, client_name: true, client_surname: true },
      })
    : [];
  const nameOf = (id: string | null) => {
    const c = others.find((o) => o.id === id);
    return c ? [c.client_name, c.client_surname].filter(Boolean).join(" ").trim() || null : null;
  };

  const candidates: ContactlessCandidate[] = kept.map((r) => {
    const stats = bookingStats.find((s) => s.client_id === r.id);
    return {
      id: r.id,
      name: r.client_name,
      surname: r.client_surname,
      created_at: r.created_at.toISOString(),
      bookings: stats?._count._all ?? 0,
      last_visit: stats?._max.start_time?.toISOString() ?? null,
      vouchers: vouchers
        .filter((v) => v.recipient_id === r.id || v.buyer_id === r.id)
        .map((v) => {
          const role: CandidateVoucher["role"] =
            v.recipient_id === r.id && v.buyer_id !== r.id ? "recipient" : "buyer";
          return {
            code: v.code,
            balance: Number(v.balance ?? 0),
            role,
            otherName: role === "recipient" ? nameOf(v.buyer_id) : nameOf(v.recipient_id),
          };
        }),
    };
  });

  // Gift recipients with balance first, then most recent activity.
  const activity = (c: ContactlessCandidate) => Math.max(Date.parse(c.created_at), c.last_visit ? Date.parse(c.last_visit) : 0);
  candidates.sort(
    (a, b) => Number(hasGiftBalance(b.id)) - Number(hasGiftBalance(a.id)) || activity(b) - activity(a),
  );
  const top = candidates.slice(0, MAX_CANDIDATES);
  return { clients: kept.filter((r) => top.some((c) => c.id === r.id)), candidates: top };
}

async function planClientSlot(
  db: Prisma.TransactionClient,
  slot: string,
  input: ClientInput,
  resolution?: ClientResolution,
): Promise<SlotPlan> {
  if (!hasClientInfo(input)) return { kind: "none" };
  const email = canonicalEmail(input.client_email);
  const phone = normalize(input.client_phone);
  const typed = {
    name: normalize(input.client_name),
    surname: normalize(input.client_surname),
    email,
    // Canonical, so the dialog doesn't present the same number in two spellings.
    phone: canonicalPhone(input.client_phone),
  };

  // 1. The phone/email already belongs to someone.
  const contact = await findContactMatch(db, email, phone);
  if (contact) {
    if (!nameDiffers(input, contact.client)) {
      return { kind: "existing", client: contact.client, fill: fillFor(contact.client, input) };
    }
    if (resolution === "use_existing") return { kind: "existing", client: contact.client, fill: NO_FILL };
    if (resolution === "update_existing") return { kind: "rename", client: contact.client };
    return {
      kind: "conflict",
      conflict: {
        kind: "contact",
        slot,
        matchedBy: contact.matchedBy,
        existing: {
          id: contact.client.id,
          name: contact.client.client_name,
          surname: contact.client.client_surname,
          email: contact.client.client_email,
          phone: contact.client.client_phone,
        },
        typed,
      },
    };
  }

  // 2. The client she picked from the list (or the booking's current client), still matching.
  const picked = await loadPicked(db, input, phone, email);
  if (picked) return { kind: "existing", client: picked, fill: fillFor(picked, input) };

  // 3. Name only, exactly as an existing contactless client.
  if (!email && !phone) {
    const exact = await findExactNameOnly(db, input);
    if (exact) return { kind: "existing", client: exact, fill: NO_FILL };
  }

  // 4. Possibly a contactless client already on file: ask, never link silently.
  const { clients, candidates } = await findContactlessCandidates(db, input, !!(email || phone));
  if (candidates.length > 0) {
    if (resolution === "create_new") return { kind: "new" };
    const linkId = resolution?.startsWith("link:") ? resolution.slice("link:".length) : null;
    const linked = linkId ? clients.find((c) => c.id === linkId) : undefined;
    if (linked) return { kind: "existing", client: linked, fill: fillFor(linked, input) };
    return { kind: "conflict", conflict: { kind: "contactless", slot, typed, candidates } };
  }

  return { kind: "new" };
}

// Detect a conflict for one slot: null when there's nothing to confirm, or when the supplied
// resolution already answers it.
export async function detectClientConflict(
  tx: Prisma.TransactionClient,
  slot: string,
  input: ClientInput,
  resolution?: ClientResolution,
): Promise<ClientConflict | null> {
  const plan = await planClientSlot(tx, slot, input, resolution);
  return plan.kind === "conflict" ? plan.conflict : null;
}

/** Read-only: what saving these client fields would do, for the live hint under the fields. */
export async function previewClientSlot(db: Prisma.TransactionClient, input: ClientInput): Promise<ClientPreview> {
  const plan = await planClientSlot(db, "primary", input);
  switch (plan.kind) {
    case "none":
      return { kind: "none" };
    case "new":
      return { kind: "new" };
    case "rename": // only reachable with a resolution, which a preview never passes
    case "existing": {
      const bookings = await db.bookings.count({ where: { client_id: plan.client.id, deleted_at: null } });
      return {
        kind: "existing",
        client: {
          id: plan.client.id,
          name: plan.client.client_name,
          surname: plan.client.client_surname,
          email: plan.client.client_email,
          phone: plan.client.client_phone,
          bookings,
        },
        fill: plan.kind === "existing" ? plan.fill : NO_FILL,
      };
    }
    case "conflict":
      return plan.conflict.kind === "contact"
        ? { kind: "contact_conflict", matchedBy: plan.conflict.matchedBy, existing: plan.conflict.existing }
        : { kind: "contactless_conflict", candidates: plan.conflict.candidates };
  }
}

// Apply one slot, returning the resolved client id (or null for no client info).
// May throw P2002 if a write collides with the unique phone/email index — callers run inside a
// transaction so the whole booking write rolls back.
export async function applyClientSlot(
  tx: Prisma.TransactionClient,
  input: ClientInput,
  resolution?: ClientResolution,
  opts: { requireContact?: boolean; party?: string } = {},
): Promise<string | null> {
  const { requireContact = true, party } = opts;
  if (!hasClientInfo(input)) return null;
  if (!input.client_name) throw new Error("Client name is required");
  if (isPlaceholderClientName(input.client_name))
    throw new PlaceholderNameError(
      "Placeholder names (e.g. \"walk-in\", \"anon\") aren't allowed. Enter the client's real name, or leave the client fields empty for an unknown client.",
    );
  if (requireContact && !input.client_email && !input.client_phone)
    throw new Error("Provide at least a phone or email for the client");

  const plan = await planClientSlot(tx, party ?? "primary", input, resolution);

  switch (plan.kind) {
    case "none":
      return null;

    // Callers detect conflicts first; this only fires if the data changed in between.
    case "conflict":
      throw new ClientConflictError([plan.conflict]);

    case "new": {
      const created = await tx.clients.create({
        data: {
          client_name: normalizeClientName(input.client_name),
          client_surname: normalizeClientSurname(input.client_surname),
          client_email: canonicalEmail(input.client_email),
          client_phone: canonicalPhone(input.client_phone),
        },
      });
      return created.id;
    }

    case "rename": {
      // The receptionist confirmed the typed name is a correction of the matched client's.
      // findContactMatch returns on the FIRST tier that hits, so a match found by email never
      // looked at the phone — yet this update writes both. Pre-checking here lets the dialog say
      // WHICH field and WHOSE; it has to be a pre-check because Postgres aborts the transaction
      // on a failed statement. The phone is only rewritten when it's a different number.
      const phoneWrite = resolvePhoneUpdate(input.client_phone, plan.client.client_phone);
      await assertContactFree(tx, {
        email: canonicalEmail(input.client_email),
        phone: phoneWrite.changed ? input.client_phone : null,
        excludeClientId: plan.client.id,
        party,
      });
      await tx.clients.update({
        where: { id: plan.client.id },
        data: {
          client_name: normalizeClientName(input.client_name),
          client_surname: normalizeClientSurname(input.client_surname),
          client_email: canonicalEmail(input.client_email),
          client_phone: phoneWrite.value,
          updated_at: new Date(),
        },
      });
      return plan.client.id;
    }

    case "existing": {
      const { fill } = plan;
      if (fill.phone || fill.email || fill.surname || fill.name) {
        await assertContactFree(tx, {
          email: fill.email,
          phone: fill.phone,
          excludeClientId: plan.client.id,
          party,
        });
        await tx.clients.update({
          where: { id: plan.client.id },
          data: {
            ...(fill.phone ? { client_phone: fill.phone } : {}),
            ...(fill.email ? { client_email: fill.email } : {}),
            ...(fill.surname ? { client_surname: fill.surname } : {}),
            ...(fill.name ? { client_name: fill.name } : {}),
            updated_at: new Date(),
          },
        });
      }
      return plan.client.id;
    }
  }
}
