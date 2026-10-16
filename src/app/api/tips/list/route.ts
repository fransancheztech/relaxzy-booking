import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { therapistDisplayName } from "@/utils/therapistName";

const IVA_RATE = 0.21;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const therapist_id = searchParams.get("therapist_id");
  const start_date = searchParams.get("start_date");
  const end_date = searchParams.get("end_date");

  const role = await getCurrentUserRole();
  const isAdmin = role === "admin";

  // Non-admins may never see released tips regardless of query params
  const status = isAdmin ? (searchParams.get("status") ?? "all") : "pending";

  // Which therapists' tips this role may see. Former staff (active = false) are part of
  // the admin's monthly reconciliation, so admins see them; receptionists and therapists
  // must not see tips of people who have left. Soft-deleted therapist records are hidden
  // from everyone. Enforced here, not in the UI, so passing a former therapist's id as
  // `therapist_id` still returns nothing for a non-admin.
  const rosterScope = isAdmin
    ? { deleted_at: null }
    : { active: true, deleted_at: null };

  try {
    const tips = await prisma.tips.findMany({
      where: {
        deleted_at: null,
        therapists: rosterScope,
        ...(status === "pending" ? { payout_id: null } : {}),
        ...(status === "released" ? { payout_id: { not: null } } : {}),
        ...(therapist_id ? { therapist_id } : {}),
        // A tip's date is its booking's appointment date (start_time). Half-open window:
        // [start_date, end_date) — the client sends Madrid business-day bounds.
        ...(start_date || end_date
          ? {
              bookings: {
                start_time: {
                  ...(start_date ? { gte: new Date(start_date) } : {}),
                  ...(end_date ? { lt: new Date(end_date) } : {}),
                },
              },
            }
          : {}),
      },
      include: {
        therapists: { select: { id: true, nickname: true, name: true, surname: true } },
        bookings: {
          select: {
            id: true,
            start_time: true,
            deleted_at: true,
            clients: { select: { client_name: true, client_surname: true } },
            services_names: { select: { name: true, short_name: true } },
          },
        },
      },
      orderBy: { bookings: { start_time: "desc" } },
      take: 500,
    });

    // Options for the page's therapist filter: everyone in scope who has at least one
    // tip. Deliberately independent of the therapist_id and date filters, so the dropdown
    // does not collapse to the current selection when one is applied.
    const optionRows = await prisma.therapists.findMany({
      where: { ...rosterScope, tips: { some: { deleted_at: null } } },
      select: { id: true, nickname: true, name: true, surname: true, active: true },
    });
    const therapistOptions = optionRows
      .map((th) => ({ id: th.id, full_name: therapistDisplayName(th), active: th.active }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));

    return NextResponse.json({
      therapists: therapistOptions,
      tips: tips.map((tip) => {
        const gross = Number(tip.amount);
        const iva = tip.iva_applies ? Math.round(gross * IVA_RATE * 100) / 100 : 0;
        const b = tip.bookings;
        return {
          id: tip.id,
          therapist_id: tip.therapist_id,
          therapist_name: therapistDisplayName(tip.therapists),
          iva_applies: tip.iva_applies,
          payment_method: tip.payment_method,
          notes: tip.notes,
          date: b?.start_time ?? null,
          payout_id: tip.payout_id,
          gross,
          iva,
          net: Math.round((gross - iva) * 100) / 100,
          booking: b
            ? {
                id: b.id,
                start_time: b.start_time,
                client_name:
                  [b.clients?.client_name, b.clients?.client_surname].filter(Boolean).join(" ") || null,
                service_name: b.services_names?.short_name ?? b.services_names?.name ?? null,
                deleted: b.deleted_at != null,
              }
            : null,
        };
      }),
    });
  } catch (err) {
    console.error("GET /api/tips/list error", err);
    return NextResponse.json({ error: "Failed to fetch tips" }, { status: 500 });
  }
}
