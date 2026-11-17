import { DELETE_REASON_PREFIX, softDeleteClient } from "@/lib/clients/softDeleteClient";
import type { InactiveDetails } from "@/lib/review/types";
import type { Candidate, ReviewCheck } from "./types";

const DEFAULT_REASON = "No bookings, vouchers or voucher uses (old-data review)";

type Row = {
  id: string;
  client_name: string | null;
  client_surname: string | null;
  client_phone: string | null;
  client_email: string | null;
  client_notes: string | null;
  created_at: Date;
  deleted_bookings: number;
  last_deleted_booking: Date | null;
  moved_bookings: number;
  deleted_vouchers: number;
};

/**
 * Active clients with nothing left: no live bookings, no vouchers as buyer or recipient, no voucher
 * uses. "Apply" retires the client with the same soft delete as the Clients page, which refuses if
 * the client got a booking or voucher since the check ran.
 */
export const clientInactive: ReviewCheck = {
  source: "clients-check",

  async find(db) {
    const rows = await db.$queryRaw<Row[]>`
      WITH idle AS (
        SELECT c.* FROM clients c
        WHERE c.deleted_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.client_id = c.id AND b.deleted_at IS NULL)
          AND NOT EXISTS (SELECT 1 FROM vouchers v
                           WHERE (v.buyer_id = c.id OR v.recipient_id = c.id) AND v.deleted_at IS NULL)
          AND NOT EXISTS (SELECT 1 FROM voucher_uses u WHERE u.recipient_id = c.id AND u.deleted_at IS NULL)
      ),
      moved AS (
        SELECT h.client_id, count(DISTINCT h.booking_id)::int AS n
        FROM bookings_history h
        JOIN idle ON idle.id = h.client_id
        JOIN bookings b ON b.id = h.booking_id
        WHERE b.deleted_at IS NULL AND b.client_id IS DISTINCT FROM h.client_id
        GROUP BY h.client_id
      )
      SELECT i.id, i.client_name, i.client_surname, i.client_phone, i.client_email, i.client_notes, i.created_at,
             (SELECT count(*)::int FROM bookings b WHERE b.client_id = i.id AND b.deleted_at IS NOT NULL) AS deleted_bookings,
             (SELECT max(b.start_time) FROM bookings b WHERE b.client_id = i.id AND b.deleted_at IS NOT NULL) AS last_deleted_booking,
             coalesce(m.n, 0) AS moved_bookings,
             (SELECT count(*)::int FROM vouchers v
               WHERE (v.buyer_id = i.id OR v.recipient_id = i.id) AND v.deleted_at IS NOT NULL) AS deleted_vouchers
      FROM idle i
      LEFT JOIN moved m ON m.client_id = i.id
      ORDER BY i.created_at`;

    return rows.map((r): Candidate => {
      const details: InactiveDetails = {
        client_name: r.client_name,
        client_surname: r.client_surname,
        client_phone: r.client_phone,
        client_email: r.client_email,
        client_notes: r.client_notes,
        created_at: r.created_at.toISOString(),
        deleted_bookings: r.deleted_bookings,
        last_deleted_booking: r.last_deleted_booking ? r.last_deleted_booking.toISOString() : null,
        moved_bookings: r.moved_bookings,
        deleted_vouchers: r.deleted_vouchers,
      };
      return { item_key: r.id, client_id: r.id, details, proposal: null };
    });
  },

  async apply(tx, item, input) {
    if (!item.client_id) return { error: "CLIENT_NOT_FOUND", status: 404 };
    const reason = input.note?.trim() || DEFAULT_REASON;
    const failure = await softDeleteClient(tx, item.client_id, reason);
    if (failure) return { error: failure.error, status: failure.status };
    return { decision: { action: "apply", reason } };
  },

  async revert(tx, item) {
    if (!item.client_id) return { error: "CLIENT_NOT_FOUND", status: 404 };
    const client = await tx.clients.findUnique({
      where: { id: item.client_id },
      select: { deleted_at: true, client_notes: true },
    });
    if (!client) return { error: "CLIENT_NOT_FOUND", status: 404 };
    if (!client.deleted_at) return null;

    // Take back the "Reason of delete: …" the retirement appended, if it is still the last thing there.
    const reason = (item.decision as { reason?: string } | null)?.reason;
    const suffix = reason ? `${DELETE_REASON_PREFIX}${reason}` : null;
    const notes = client.client_notes ?? "";
    const restoredNotes = suffix && notes.endsWith(suffix) ? notes.slice(0, -suffix.length).trim() || null : client.client_notes;

    // A phone or email taken by another client since then makes this throw a unique violation,
    // which the route reports as CONTACT_TAKEN.
    await tx.clients.update({
      where: { id: item.client_id },
      data: { deleted_at: null, client_notes: restoredNotes, updated_at: new Date() },
    });
    return null;
  },
};
