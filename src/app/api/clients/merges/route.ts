import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { getCurrentUserId } from "@/lib/auth/getCurrentUserId";
import { canonicalPhone } from "@/utils/phone";
import { canonicalEmail } from "@/utils/email";
import { isPlaceholderClientName } from "@/utils/placeholderName";
import { isUniqueViolation } from "@/lib/clients/contactCollision";
import { isRawCheckViolation, isRawUniqueViolation, mergeErrorCode } from "@/lib/clients/duplicates";

type Body = {
  /** The record that stays. */
  keeperId?: string;
  /** The record folded into it and retired. */
  otherId?: string;
  name?: string;
  surname?: string | null;
  /** One of the two records' phones (E.164), or null when neither has one. */
  phone?: string | null;
  /** One of the two records' emails, or null when neither has one. */
  email?: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (code: string, status: number) => NextResponse.json({ error: code }, { status });

/**
 * Merges any two active clients that an admin has judged to be one person: the "Voucher
 * recipients" review tab and "Merge into another client…" on the Clients page. The kept record
 * ends up with the chosen name and the chosen phone/email — which may be the other record's —
 * through merge_clients(), so the merge is logged and can be undone from Recent merges.
 *
 * Phone and email can only be picked from what the two records already hold: a merge never
 * invents contact data and never silently drops the only phone or email either of them had.
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
      select: { id: true, client_phone: true, client_email: true, client_notes: true },
    });
    const keeper = rows.find((r) => r.id === keeperId);
    const other = rows.find((r) => r.id === otherId);
    if (!keeper || !other) return fail("STALE_GROUP", 409);

    const name = (body.name ?? "").trim();
    if (!name || name.length > 100 || isPlaceholderClientName(name)) return fail("INVALID_NAME", 400);
    const surname = (body.surname ?? "").trim() || null;
    if (surname && surname.length > 100) return fail("INVALID_NAME", 400);

    const phones = [...new Set([keeper.client_phone, other.client_phone].map(canonicalPhone).filter(Boolean))];
    const phone = body.phone ? canonicalPhone(body.phone) : null;
    if (phones.length ? !phone || !phones.includes(phone) : phone !== null) return fail("INVALID_PHONE", 400);

    const emails = [...new Set([keeper.client_email, other.client_email].map(canonicalEmail).filter(Boolean))];
    const email = canonicalEmail(body.email);
    if (emails.length ? !email || !emails.includes(email) : email !== null) return fail("INVALID_EMAIL", 400);

    const notes = [keeper.client_notes?.trim(), other.client_notes?.trim()]
      .filter((n, i, list): n is string => !!n && list.indexOf(n) === i)
      .join(" · ");

    const actor = await getCurrentUserId();
    const details = {
      client_name: name,
      client_surname: surname,
      client_phone: phone,
      client_email: email,
      client_notes: notes || null,
    };
    // merge_clients retires the other record before writing the keeper's details, so a phone or
    // email moving from the other record to the keeper doesn't collide with itself.
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
    if (isRawCheckViolation(err)) return fail("INVALID_FORMAT", 400);
    console.error("POST /api/clients/merges error", err);
    return fail("RESOLVE_FAILED", 500);
  }
}
