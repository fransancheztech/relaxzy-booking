import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createCustomServerClient } from "@/utils/supabase/server";
import { AgendaNoteSchema } from "@/schemas/agendaNote.schema";
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

/**
 * Guard for both writes: the note must exist AND be one this viewer can see. Without the
 * visibility check a receptionist could edit or delete an admin-only note by id, despite it
 * never appearing anywhere in their UI.
 */
async function findWritableNote(id: string, role: string | null) {
  const targets = visibleTargetsFor(role);
  if (targets.length === 0) return null;
  return prisma.agenda_notes.findFirst({
    where: { id, deleted_at: null, target_roles: { hasSome: [...targets] } },
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageAgenda(viewer.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const parsed = AgendaNoteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
  }

  const allowed = assignableTargetsFor(viewer.role);
  if (parsed.data.target_roles.some((r) => !allowed.includes(r))) {
    return NextResponse.json({ error: "Forbidden audience" }, { status: 403 });
  }

  const existing = await findWritableNote(id, viewer.role);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const note = await prisma.agenda_notes.update({
    where: { id },
    data: {
      note_date: dateOnlyToUtcDate(parsed.data.note_date),
      content: parsed.data.content.trim(),
      target_roles: parsed.data.target_roles,
      updated_at: new Date(),
    },
  });

  return NextResponse.json({ note: { ...note, note_date: utcDateToDateOnly(note.note_date) } });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageAgenda(viewer.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const existing = await findWritableNote(id, viewer.role);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.agenda_notes.update({
    where: { id },
    data: { deleted_at: new Date() },
  });

  return NextResponse.json({ ok: true });
}
