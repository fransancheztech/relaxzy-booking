import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createCustomServerClient } from "@/utils/supabase/server";
import { AgendaNoteSchema, DATE_ONLY_RE } from "@/schemas/agendaNote.schema";
import { formatZodError } from "@/utils/zodApiError";
import {
  assignableTargetsFor,
  canManageAgenda,
  dateOnlyToUtcDate,
  utcDateToDateOnly,
  visibleTargetsFor,
} from "@/lib/agenda/visibility";

async function getViewer() {
  const supabase = await createCustomServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return { id: user.id, role: (user.app_metadata?.role as string) ?? null };
}

/** Notes always leave the API with note_date as a plain "YYYY-MM-DD" string. */
function serialize(n: {
  id: string;
  note_date: Date;
  content: string;
  target_roles: string[];
  author_id: string;
  created_at: Date;
  updated_at: Date;
}) {
  return { ...n, note_date: utcDateToDateOnly(n.note_date) };
}

/**
 * GET /api/agenda?from=YYYY-MM-DD&to=YYYY-MM-DD   (inclusive range)
 *
 * Open to every signed-in role, including therapists: the page is hidden from them but the top
 * bar is not, and both read through here. What differs per role is which notes come back.
 */
export async function GET(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to || !DATE_ONLY_RE.test(from) || !DATE_ONLY_RE.test(to)) {
    return NextResponse.json(
      { error: "from and to are required as YYYY-MM-DD" },
      { status: 400 },
    );
  }

  const targets = visibleTargetsFor(viewer.role);
  if (targets.length === 0) return NextResponse.json({ notes: [] });

  const notes = await prisma.agenda_notes.findMany({
    where: {
      deleted_at: null,
      note_date: { gte: dateOnlyToUtcDate(from), lte: dateOnlyToUtcDate(to) },
      target_roles: { hasSome: [...targets] },
    },
    orderBy: [{ note_date: "asc" }, { created_at: "asc" }],
  });

  return NextResponse.json({
    notes: notes.map(serialize),
    can_manage: canManageAgenda(viewer.role),
    assignable_roles: assignableTargetsFor(viewer.role),
  });
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageAgenda(viewer.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = AgendaNoteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  // A receptionist must not be able to address admins by posting a crafted body.
  const allowed = assignableTargetsFor(viewer.role);
  if (parsed.data.target_roles.some((r) => !allowed.includes(r))) {
    return NextResponse.json({ error: "Forbidden audience" }, { status: 403 });
  }

  const note = await prisma.agenda_notes.create({
    data: {
      note_date: dateOnlyToUtcDate(parsed.data.note_date),
      content: parsed.data.content.trim(),
      target_roles: parsed.data.target_roles,
      author_id: viewer.id,
    },
  });

  return NextResponse.json({ note: serialize(note) }, { status: 201 });
}
