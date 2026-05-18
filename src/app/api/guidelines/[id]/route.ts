import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createCustomServerClient } from "@/utils/supabase/server";
import { GuidelineSchema } from "@/schemas/guideline.schema";
import { formatZodError } from "@/utils/zodApiError";

async function getViewer() {
  const supabase = await createCustomServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return {
    id: user.id,
    role: (user.app_metadata?.role as string) ?? null,
  };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (viewer.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json();
  const parsed = GuidelineSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: formatZodError(parsed.error) },
      { status: 400 },
    );
  }

  try {
    const updated = await prisma.guidelines.update({
      where: { id, deleted_at: null },
      data: {
        title: parsed.data.title?.trim() || null,
        content: parsed.data.content.trim(),
        target_roles: parsed.data.target_roles,
        updated_at: new Date(),
      },
    });
    return NextResponse.json({ guideline: updated });
  } catch (err: any) {
    if (err.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("PATCH /api/guidelines/[id] error", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (viewer.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    await prisma.guidelines.update({
      where: { id, deleted_at: null },
      data: { deleted_at: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err.code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("DELETE /api/guidelines/[id] error", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
