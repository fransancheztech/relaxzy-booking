import { NextResponse } from "next/server";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { runReviewCheck } from "@/lib/review/items";
import { isReviewKind } from "@/lib/review/types";

// Runs one check of the review page against the current data ("Search again"). Admin-only.
export async function POST(request: Request) {
  const role = await getCurrentUserRole();
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { kind } = await request.json().catch(() => ({}));
  if (!isReviewKind(kind)) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });

  try {
    return NextResponse.json(await runReviewCheck(kind));
  } catch (err) {
    console.error("POST /api/review/find error", err);
    return NextResponse.json({ error: "FAILED" }, { status: 500 });
  }
}
