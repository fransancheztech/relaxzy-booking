import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import type { ChangeType, CurrentVersion, GuidelineLogEntry, TextSnapshot } from "@/lib/guidelines/versions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type LoggedRow = Record<string, unknown> | null;

const text = (row: LoggedRow): TextSnapshot | null =>
  row ? { title: (row.title as string | null) ?? null, content: (row.content as string | null) ?? "" } : null;

// Every logged change of one guideline, newest first, plus its texts as they are now.
// Admin-only, like editing: the log holds every text ever saved, deleted ones included.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const role = await getCurrentUserRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  if (!UUID.test(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const guideline = await prisma.guidelines.findFirst({ where: { id, deleted_at: null }, select: { id: true } });
    if (!guideline) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [rows, translations] = await Promise.all([
      prisma.$queryRaw<
        {
          id: string;
          entity: string;
          language: string | null;
          change_type: ChangeType;
          old_data: LoggedRow;
          new_data: LoggedRow;
          changed_at: Date;
          email: string | null;
        }[]
      >`
        SELECT l.id::text AS id, l.entity, l.language, l.change_type::text AS change_type,
               l.old_data, l.new_data, l.changed_at, u.email
          FROM guidelines_log l
          LEFT JOIN auth.users u ON u.id = l.changed_by
         WHERE l.guideline_id = ${id}::uuid
         ORDER BY l.changed_at DESC, l.id`,
      prisma.guideline_translations.findMany({
        where: { guideline_id: id },
        select: { language: true, title: true, content: true, updated_at: true },
      }),
    ]);

    const entries: GuidelineLogEntry[] = rows.map((r) => {
      const base = { id: r.id, change: r.change_type, at: r.changed_at.toISOString(), by: r.email };
      if (r.entity === "translation") {
        const before = text(r.old_data);
        return {
          ...base,
          kind: "text",
          language: r.language ?? "",
          before: before && { ...before, saved_at: (r.old_data?.updated_at as string | undefined) ?? null },
          after: text(r.new_data),
        };
      }
      return {
        ...base,
        kind: "guideline",
        roles_before: (r.old_data?.target_roles as string[] | undefined) ?? null,
        roles_after: (r.new_data?.target_roles as string[] | undefined) ?? null,
        deleted_before: r.old_data?.deleted_at != null,
        deleted_after: r.new_data?.deleted_at != null,
      };
    });

    const current: CurrentVersion[] = translations.map((tr) => ({ ...tr, updated_at: tr.updated_at.toISOString() }));

    return NextResponse.json({ entries, current });
  } catch (err) {
    console.error("GET /api/guidelines/[id]/versions error", err);
    return NextResponse.json({ error: "Failed to load versions" }, { status: 500 });
  }
}
