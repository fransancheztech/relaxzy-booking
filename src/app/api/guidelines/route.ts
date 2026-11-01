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

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const where =
    viewer.role === "admin"
      ? { deleted_at: null }
      : {
          deleted_at: null,
          target_roles: { has: viewer.role ?? "" },
        };

  const rows = await prisma.guidelines.findMany({
    // A guideline is shown through its language versions; one without any has nothing to show.
    where: { ...where, guideline_translations: { some: {} } },
    orderBy: { created_at: "desc" },
    include: {
      guideline_translations: { select: { language: true, title: true, content: true, updated_at: true } },
    },
  });

  // guidelines.title / content are the pre-translation backup and are no longer sent.
  const guidelines = rows.map(({ guideline_translations, title: _title, content: _content, ...g }) => ({
    ...g,
    translations: guideline_translations,
  }));

  return NextResponse.json({ guidelines });
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (viewer.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = GuidelineSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: formatZodError(parsed.error) },
      { status: 400 },
    );
  }

  const created = await prisma.guidelines.create({
    data: {
      author_id: viewer.id,
      target_roles: parsed.data.target_roles,
      guideline_translations: { create: filledTranslations(parsed.data.translations) },
    },
  });

  return NextResponse.json({ guideline: created });
}
