import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const clients = await prisma.clients.findMany({
      where: { deleted_at: null },
      orderBy: { client_name: "asc" },
    });
    return NextResponse.json({ clients });
  } catch (err) {
    console.error("Fetch clients error:", err);
    return NextResponse.json({ error: "Error fetching clients" }, { status: 500 });
  }
}
