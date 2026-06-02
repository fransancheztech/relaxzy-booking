import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { UpdateTherapistSchema } from "@/schemas/therapist.schema";
import { formatZodError } from "@/utils/zodApiError";

const normalize = (v?: string) => (v && v.trim() !== "" ? v.trim() : null);

export async function POST(req: Request) {
  const role = await getCurrentUserRole();
  if (role !== "admin" && role !== "receptionist") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = UpdateTherapistSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }
  const { nickname, name, surname, email, phone, notes, off_days } = parsed.data;

  try {
    // Therapists are plain records (no per-therapist login under the shared-account
    // model), so the id is generated and the therapist is created active/bookable.
    const therapist = await prisma.therapists.create({
      data: {
        nickname: normalize(nickname),
        name: normalize(name),
        surname: normalize(surname),
        email: normalize(email),
        phone: normalize(phone),
        notes: normalize(notes),
        active: true,
        ...(off_days !== undefined && { off_days }),
      },
    });
    return NextResponse.json({ success: true, therapist });
  } catch (err) {
    console.error("POST /api/therapists/add error", err);
    return NextResponse.json({ error: "Failed to add therapist" }, { status: 500 });
  }
}
