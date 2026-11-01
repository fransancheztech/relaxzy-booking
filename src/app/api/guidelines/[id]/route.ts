import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createCustomServerClient } from "@/utils/supabase/server";
import { GuidelineSchema } from "@/schemas/guideline.schema";
import { formatZodError } from "@/utils/zodApiError";
import { filledTranslations } from "@/lib/guidelines/languages";

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

  const wanted = filledTranslations(parsed.data.translations);

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const guideline = await tx.guidelines.update({
        where: { id, deleted_at: null },
        data: { target_roles: parsed.data.target_roles, updated_at: now },
      });

      // A language emptied in the editor loses its version.
      await tx.guideline_translations.deleteMany({
        where: { guideline_id: id, language: { notIn: wanted.map((w) => w.language) } },
      });

      // Only versions that actually changed get a new updated_at.
      const existing = await tx.guideline_translations.findMany({ where: { guideline_id: id } });
      for (const w of wanted) {
        const current = existing.find((e) => e.language === w.language);
        if (!current) {
          await tx.guideline_translations.create({ data: { guideline_id: id, ...w } });
        } else if (current.title !== w.title || current.content !== w.content) {
          await tx.guideline_translations.update({
            where: { id: current.id },
            data: { title: w.title, content: w.content, updated_at: now },
          });
        }
      }
      return guideline;
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
