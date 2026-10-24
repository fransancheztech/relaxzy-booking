import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasUsage, loadClientUsage } from "@/lib/clients/clientUsage";

// Whether a client can be deleted, asked when the delete confirmation opens so the receptionist
// sees why it's blocked before typing a reason. The delete route checks again on its own.
export async function GET(_req: Request, { params }: { params: Promise<{ clientId: string }> }) {
  try {
    const { clientId } = await params;
    const usage = await loadClientUsage(prisma, clientId);
    return NextResponse.json({ ...usage, deletable: !hasUsage(usage) });
  } catch (err) {
    console.error("GET /api/clients/[clientId]/usage error", err);
    return NextResponse.json({ error: "Failed to check client usage" }, { status: 500 });
  }
}
