import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getCurrentUserId } from "@/lib/auth/getCurrentUserId";
import { canonicalPhone, nationalDigits } from "@/utils/phone";
import { isPlaceholderClientName } from "@/utils/placeholderName";
import { canonicalEmail } from "@/utils/email";
import { normalizeClientName, normalizeClientSurname } from "@/utils/names";
import { isUniqueViolation } from "@/lib/clients/contactCollision";
import { isRawUniqueViolation, mergeErrorCode, oneDigitApart } from "@/lib/clients/duplicates";

type Body = {
  /** The record that stays. */
  keeperId?: string;
  /** The record folded into it. */
  otherId?: string;
  /** The number judged correct — one of the two, as E.164. */
  phone?: string;
  /** The kept client's final name. */
  name?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (code: string, status: number) => NextResponse.json({ error: code }, { status });

/** Every active client whose phone is this number, whatever the spelling. */
async function holdersOf(number: string): Promise<string[]> {
  const national = nationalDigits(number);
  if (!national) return [];
  const rows = await prisma.$queryRaw<{ id: string; client_phone: string }[]>`
    SELECT id::text AS id, client_phone FROM clients
    WHERE deleted_at IS NULL
      AND regexp_replace(coalesce(client_phone, ''), '[^0-9]', '', 'g') LIKE ${"%" + national}`;
  return rows.filter((r) => canonicalPhone(r.client_phone) === number).map((r) => r.id);
}

/**
 * Merges a "possible phone typo" pair: two clients whose numbers differ by one digit, judged by the
 * reviewer to be one person. The kept client ends up with the number the reviewer chose as correct
 * — which may be the other record's — through merge_clients(), so the merge is logged and undoable.
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
  const otherId = body.otherId ?? "";
  if (!UUID.test(keeperId) || !UUID.test(otherId) || keeperId === otherId) return fail("INVALID_IDS", 400);

  try {
    const rows = await prisma.clients.findMany({
      where: { id: { in: [keeperId, otherId] }, deleted_at: null },
      select: {
        id: true,
        client_name: true,
        client_surname: true,
        client_phone: true,
        client_email: true,
        client_notes: true,
      },
    });
    const keeper = rows.find((r) => r.id === keeperId);
    const other = rows.find((r) => r.id === otherId);
    const keeperNumber = canonicalPhone(keeper?.client_phone);
    const otherNumber = canonicalPhone(other?.client_phone);

    // Still exactly the pair the reviewer saw: both active, numbers one digit apart, and each
    // number held by that one client only. Anything else changed since the page loaded.
    if (!keeper || !other || !keeperNumber || !otherNumber || !oneDigitApart(keeperNumber, otherNumber)) {
      return fail("STALE_GROUP", 409);
    }
    const [keeperHolders, otherHolders] = await Promise.all([holdersOf(keeperNumber), holdersOf(otherNumber)]);
    if (keeperHolders.join() !== keeperId || otherHolders.join() !== otherId) {
      return fail("STALE_GROUP", 409);
    }

    const phone = body.phone ?? "";
    if (phone !== keeperNumber && phone !== otherNumber) return fail("INVALID_PHONE", 400);

    const name = (body.name ?? keeper.client_name ?? "").trim();
    if (!name || name.length > 100 || isPlaceholderClientName(name)) return fail("INVALID_NAME", 400);

    const firstFilled = (field: "client_surname" | "client_email") =>
      keeper[field]?.trim() || other[field]?.trim() || null;
    const notes = [keeper.client_notes?.trim(), other.client_notes?.trim()]
      .filter((n, i, list): n is string => !!n && list.indexOf(n) === i)
      .join(" · ");

    const actor = await getCurrentUserId();
    const details = {
      client_name: normalizeClientName(name),
      client_phone: phone,
      client_surname: normalizeClientSurname(firstFilled("client_surname")),
      client_email: canonicalEmail(firstFilled("client_email")),
      client_notes: notes || null,
    };
    // merge_clients retires the other record before writing the keeper's details, so the other
    // record's number is free to become the keeper's when it's the one judged correct.
    const result = await prisma.$queryRaw<{ id: string }[]>`
      SELECT merge_clients(
        ${keeperId}::uuid,
        ${[otherId]}::uuid[],
        ${JSON.stringify(details)}::jsonb,
        ${actor}::uuid
      )::text AS id`;

    return NextResponse.json({ mergeId: result[0]?.id ?? null });
  } catch (err) {
    const code = mergeErrorCode(err);
    if (code) return fail(code, code.endsWith("NOT_FOUND") ? 409 : 400);
    if (isUniqueViolation(err) || isRawUniqueViolation(err)) return fail("CONTACT_TAKEN", 409);
    console.error("POST /api/clients/duplicates/resolve-typo error", err);
    return fail("RESOLVE_FAILED", 500);
  }
}
