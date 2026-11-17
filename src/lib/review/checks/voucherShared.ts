import type { Prisma } from "generated/prisma";
import { foldText } from "@/utils/text";
import type { SystemVoucherSummary } from "@/lib/review/types";

/** Every voucher in the system, deleted ones included, with buyer, recipient, payments and uses. */
export async function loadSystemVouchers(db: Prisma.TransactionClient): Promise<SystemVoucherSummary[]> {
  return db.$queryRaw<SystemVoucherSummary[]>`
    SELECT v.id, v.code, v.source::text AS source, v.external_reference,
           (v.created_at AT TIME ZONE 'Europe/Madrid')::date::text AS sold,
           v.deleted_at IS NOT NULL AS deleted,
           v.balance::float AS balance,
           v.notes,
           concat_ws(' ', b.client_name, b.client_surname) AS buyer,
           concat_ws(' ', r.client_name, r.client_surname) AS recipient,
           coalesce((
             SELECT sum(CASE WHEN pe.type = 'CHARGE' THEN pe.amount ELSE -pe.amount END)
             FROM payments p
             JOIN payment_events pe ON pe.payment_id = p.id AND pe.deleted_at IS NULL
             WHERE p.voucher_id = v.id AND p.deleted_at IS NULL
           ), 0)::float AS paid,
           coalesce((
             SELECT json_agg(json_build_object(
                      'date', (coalesce(bk.start_time, u.created_at) AT TIME ZONE 'Europe/Madrid')::date::text,
                      'amount', u.amount::float) ORDER BY u.created_at)
             FROM voucher_uses u
             LEFT JOIN bookings bk ON bk.id = u.booking_id
             WHERE u.voucher_id = v.id AND u.deleted_at IS NULL
           ), '[]'::json) AS uses
    FROM vouchers v
    LEFT JOIN clients b ON b.id = v.buyer_id
    LEFT JOIN clients r ON r.id = v.recipient_id
    ORDER BY v.created_at`;
}

/** The order number in an external reference: "#14" and "14" are both 14. */
export const referenceNumber = (ref: string | null) => {
  const digits = (ref ?? "").replace(/\D/g, "");
  return digits ? Number(digits) : null;
};

// Words that say nothing about who someone is.
const STOP = new Set(["y", "e", "de", "del", "la", "las", "los", "el", "and", "para", "mi", "tu", "tus", "su", "con", "todo", "amor", "vida"]);

const words = (s: string | null | undefined) =>
  foldText(s).replace(/[^a-z0-9 ]/g, " ").split(" ").filter((w) => w.length >= 2 && !STOP.has(w));

function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}

/**
 * How alike two names are, 0 to 1: the best match between any word of one and any word of the
 * other. Same word 1, one word starting the other 0.9 ("Rafa" / "Rafael"), otherwise by spelling
 * ("Susi" / "Suzie" 0.6). Accents and capitals don't count.
 */
export function nameSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  const wa = words(a);
  const wb = words(b);
  let best = 0;
  for (const x of wa) {
    for (const y of wb) {
      if (x === y) return 1;
      if (Math.min(x.length, y.length) >= 3 && (x.startsWith(y) || y.startsWith(x))) best = Math.max(best, 0.9);
      else if (Math.min(x.length, y.length) >= 3) best = Math.max(best, 1 - levenshtein(x, y) / Math.max(x.length, y.length));
    }
  }
  return best;
}

/** Whole days between two YYYY-MM-DD dates. */
export const daysBetween = (a: string, b: string) =>
  Math.abs(Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000));

export const asDate = (ymd: string | null | undefined) => (ymd && /^\d{4}-\d{2}-\d{2}/.test(ymd) ? new Date(`${ymd.slice(0, 10)}T00:00:00Z`) : null);
