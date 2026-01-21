import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const therapist = await prisma.therapists.findUnique({ where: { id } });
  if (!therapist) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(therapist);
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = await req.json();
  const { full_name, email, phone, notes } = body;
  const updated = await prisma.therapists.update({
    where: { id },
    data: { full_name, email, phone, notes },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  await prisma.therapists.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
