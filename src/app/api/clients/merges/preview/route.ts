import { NextResponse } from "next/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { loadClientSummaries } from "@/lib/clients/duplicates";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The two clients of a manual merge, with the activity shown when choosing what to keep.
// GET /api/clients/merges/preview?a=<id>&b=<id>. Admin-only, like merging itself.
export async function GET(request: Request) {
  const role = await getCurrentUserRole();
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const a = searchParams.get("a") ?? "";
  const b = searchParams.get("b") ?? "";
  if (!UUID.test(a) || !UUID.test(b) || a === b) {
    return NextResponse.json({ error: "INVALID_IDS" }, { status: 400 });
  }

  try {
    const clients = await loadClientSummaries([a, b]);
    if (clients.length !== 2) return NextResponse.json({ error: "STALE_GROUP" }, { status: 409 });
    return NextResponse.json({ clients });
  } catch (err) {
    console.error("GET /api/clients/merges/preview error", err);
    return NextResponse.json({ error: "Failed to load clients" }, { status: 500 });
  }
}
