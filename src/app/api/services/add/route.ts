import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Body = {
  name: string;
  short_name: string;
  price?: number;
};

export async function POST(request: Request) {
  try {
    const body: Body = await request.json();

    if (!body.name) return NextResponse.json({ error: "Service name is required" }, { status: 400 });
    if (!body.short_name) return NextResponse.json({ error: "Service short name is required" }, { status: 400 });

    const existing = await prisma.services_names.findFirst({
      where: { name: body.name, deleted_at: null },
    });
    if (existing) return NextResponse.json({ error: "Service already exists", service: existing }, { status: 409 });

    const service = await prisma.services_names.create({
      data: {
        name: body.name,
        short_name: body.short_name ?? null,
      },
    });

    return NextResponse.json({ service });
  } catch (err) {
    console.error("Add service error:", err);
    return NextResponse.json({ error: "Error adding service" }, { status: 500 });
  }
}