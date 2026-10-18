import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { UpdateTherapistSchema } from "@/schemas/therapist.schema";
import { formatZodError } from "@/utils/zodApiError";
import { canonicalPhone } from "@/utils/phone";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  
  const therapist = await prisma.therapists.findUnique({
    where: { id },
  });

  if (!therapist || therapist.deleted_at) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(therapist);
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = await req.json();
  const parsed = UpdateTherapistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }
  const { nickname, name, surname, email, phone, notes, active, off_days } = parsed.data;
  const norm = (v?: string) => (v && v.trim() !== "" ? v.trim() : null);
  const updated = await prisma.therapists.update({
    where: { id },
    data: {
      nickname: norm(nickname),
      name: norm(name),
      surname: norm(surname),
      email: norm(email),
      // Stored as E.164, the same rule as client phones. No unique index here, so there is
      // no duplicate-sibling case to protect and the value is always rewritten canonically.
      phone: canonicalPhone(phone),
      notes: norm(notes),
      ...(active !== undefined && { active }),
      ...(off_days !== undefined && { off_days }),
    },
  });
  return NextResponse.json(updated);
}

// Restore a soft-deleted therapist, reinstating them as active. Admin-only: archived
// therapists are only visible to admins, so only an admin can bring one back.
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const role = await getCurrentUserRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  const restored = await prisma.therapists.update({
    where: { id },
    data: { deleted_at: null, active: true },
  });

  return NextResponse.json(restored, { status: 200 });
}

// Admin-only: archiving hides the therapist from everyone, and only an admin can see the
// archived list or restore from it — so a non-admin could otherwise make a row disappear
// with no way to see or undo what they did.
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const role = await getCurrentUserRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  // Soft delete: just set deleted_at to now()
  const now = new Date();

  const softDeleted = await prisma.therapists.update({
    where: { id },
    data: { deleted_at: now },
  });

  return NextResponse.json(softDeleted, { status: 200 });
}
