import type { AgendaRole } from "@/schemas/agendaNote.schema";

export type AgendaNote = {
  id: string;
  note_date: string; // "YYYY-MM-DD" — a calendar day, never an instant
  content: string;
  target_roles: AgendaRole[];
  author_id: string;
  created_at: string;
  updated_at: string;
};

export type AgendaListResponse = {
  notes: AgendaNote[];
  can_manage: boolean;
  assignable_roles: AgendaRole[];
};
