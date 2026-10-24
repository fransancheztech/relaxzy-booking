import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getCurrentUserId } from "@/lib/auth/getCurrentUserId";
import { canonicalPhone, nationalDigits } from "@/utils/phone";
import { isPlaceholderClientName } from "@/utils/placeholderName";
import { canonicalEmail } from "@/utils/email";
import { normalizeClientName, normalizeClientSurname } from "@/utils/names";
import { isUniqueViolation } from "@/lib/clients/contactCollision";
import { isRawUniqueViolation, mergeErrorCode } from "@/lib/clients/duplicates";

type Body = {
  keeperId?: string;
  /** Same person as the keeper: folded into it by merge_clients (logged, undoable). */
  mergeIds?: string[];
  /** A different person who shared the number: keeps their bookings, gives up the number. */
  separateIds?: string[];
  /** The kept client's final name, chosen from the names in the group. */
  name?: string;
  /** Written into a separated client's notes, in the reviewer's language, so the number isn't lost. */
  separationNote?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const fail = (code: string, status: number) => NextResponse.json({ error: code }, { status });

/**
 * Resolves one duplicate group in a single transaction:
 *   1. every "different person" gives up the shared number (it moves into their notes) — two
 *      active clients can't hold the same number under clients_phone_active_unique;
 *   2. every "same person" is folded into the keeper by merge_clients();
 *   3. the keeper ends up with the number in E.164 and the chosen name.
 */
export async function POST(request: Request) {
  const role = await getCurrentUserRole();
  if (role !== "admin") return fail("Forbidden", 403);

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return fail("INVALID_BODY", 400);
  }

  const keeperId = body.keeperId ?? "";
  const mergeIds = [...new Set(body.mergeIds ?? [])];
  const separateIds = [...new Set(body.separateIds ?? [])];
  const all = [keeperId, ...mergeIds, ...separateIds];

  if (!all.every((id) => UUID.test(id))) return fail("INVALID_IDS", 400);
  if (new Set(all).size !== all.length) return fail("INVALID_IDS", 400);   // overlap or keeper repeated
  if (mergeIds.length + separateIds.length === 0) return fail("NOTHING_TO_DO", 400);

  const separationNote = (body.separationNote ?? "").trim();
  if (separateIds.length > 0 && (!separationNote || separationNote.length > 200)) {
    return fail("INVALID_NOTE", 400);
  }

  try {
    const rows = await prisma.clients.findMany({
      where: { id: { in: all }, deleted_at: null },
      select: {
        id: true,
        client_name: true,
        client_surname: true,
        client_phone: true,
        client_email: true,
        client_notes: true,
      },
    });

    // The group must still be exactly what the reviewer saw: all present, all one number — and
    // EVERY active client holding that number must be in the request. A resolution that missed
    // one would leave a duplicate behind, or collide with it on the unique index. Anything else
    // means the group changed since the page loaded (another tab, an edit): reload.
    const keeper = rows.find((r) => r.id === keeperId);
    const number = canonicalPhone(keeper?.client_phone);
    if (!keeper || !number || rows.length !== all.length || rows.some((r) => canonicalPhone(r.client_phone) !== number)) {
      return fail("STALE_GROUP", 409);
    }
    const national = nationalDigits(number);
    const candidates = await prisma.$queryRaw<{ id: string; client_phone: string }[]>`
      SELECT id::text AS id, client_phone FROM clients
      WHERE deleted_at IS NULL
        AND regexp_replace(coalesce(client_phone, ''), '[^0-9]', '', 'g') LIKE ${"%" + national}`;
    const holders = candidates.filter((c) => canonicalPhone(c.client_phone) === number).map((c) => c.id);
    if (holders.length !== all.length || !holders.every((id) => all.includes(id))) {
      return fail("STALE_GROUP", 409);
    }

    const name = (body.name ?? keeper.client_name ?? "").trim();
    if (!name || name.length > 100 || isPlaceholderClientName(name)) return fail("INVALID_NAME", 400);

    const merged = rows.filter((r) => mergeIds.includes(r.id));
    const firstFilled = (field: "client_surname" | "client_email") =>
      keeper[field]?.trim() || merged.map((r) => r[field]?.trim()).find(Boolean) || null;
    // Notes are combined rather than chosen: on the live data only one group had any.
    const notes = [keeper, ...merged]
      .map((r) => r.client_notes?.trim())
      .filter((n, i, list): n is string => !!n && list.indexOf(n) === i)
      .join(" · ");

    const actor = await getCurrentUserId();

    const mergeId = await prisma.$transaction(async (tx) => {
      for (const id of separateIds) {
        const row = rows.find((r) => r.id === id)!;
        await tx.clients.update({
          where: { id },
          data: {
            client_phone: null,
            client_notes: [row.client_notes?.trim(), separationNote].filter(Boolean).join(" · "),
            updated_at: new Date(),
          },
        });
      }

      if (merged.length === 0) {
        // Nobody to fold in: just leave the keeper holding the number canonically.
        await tx.clients.update({
          where: { id: keeperId },
          data: { client_name: normalizeClientName(name), client_phone: number, updated_at: new Date() },
        });
        return null;
      }

      const details = {
        client_name: normalizeClientName(name),
        client_phone: number,
        client_surname: normalizeClientSurname(firstFilled("client_surname")),
        client_email: canonicalEmail(firstFilled("client_email")),
        client_notes: notes || null,
      };
      const result = await tx.$queryRaw<{ id: string }[]>`
        SELECT merge_clients(
          ${keeperId}::uuid,
          ${mergeIds}::uuid[],
          ${JSON.stringify(details)}::jsonb,
          ${actor}::uuid
        )::text AS id`;
      return result[0]?.id ?? null;
    });

    // Merged rows' bookings now belong to the keeper: refresh any open list.
    return NextResponse.json({ mergeId });
  } catch (err) {
    const code = mergeErrorCode(err);
    if (code) return fail(code, code.endsWith("NOT_FOUND") ? 409 : 400);
    if (isUniqueViolation(err) || isRawUniqueViolation(err)) return fail("CONTACT_TAKEN", 409);
    console.error("POST /api/clients/duplicates/resolve error", err);
    return fail("RESOLVE_FAILED", 500);
  }
}
