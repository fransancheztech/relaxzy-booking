import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // or wherever your prisma client is

export async function GET(req: NextRequest) {
  try {
    const therapists = await prisma.therapists.findMany({
      orderBy: { created_at: "desc" },
    });
    return NextResponse.json(therapists);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch therapists" }, { status: 500 });
  }
}

// Example for POST
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const therapist = await prisma.therapists.create({
      data: {
        full_name: body.full_name,
        email: body.email,
        phone: body.phone,
        notes: body.notes || "",
      },
    });
    return NextResponse.json(therapist);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create therapist" }, { status: 500 });
  }
}
