import { NextResponse } from "next/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { importReviewItems } from "@/lib/review/items";
import { IMPORT_FILES, isReviewKind } from "@/lib/review/types";

// Upload of an imported kind's file (tarjetas.json, pedidos_online.json): the client data in it
// goes straight into review_items and never into the repository. Admin-only.
export async function POST(request: Request) {
  const role = await getCurrentUserRole();
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const kind = body?.kind;
  if (!isReviewKind(kind) || !IMPORT_FILES[kind] || !Array.isArray(body?.items)) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  try {
    const result = await importReviewItems(kind, body.items);
    if ("error" in result) return NextResponse.json(result, { status: 400 });
    return NextResponse.json(result);
  } catch (err) {
    console.error("POST /api/review/import error", err);
    return NextResponse.json({ error: "FAILED" }, { status: 500 });
  }
}
