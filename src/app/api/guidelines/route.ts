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

  const guidelines = await prisma.guidelines.findMany({
    where,
    orderBy: { created_at: "desc" },
  });

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
      title: parsed.data.title?.trim() || null,
      content: parsed.data.content.trim(),
      target_roles: parsed.data.target_roles,
    },
  });

  return NextResponse.json({ guideline: created });
}
