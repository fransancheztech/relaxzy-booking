import * as z from "zod";

export const AGENDA_ROLES = ["admin", "receptionist", "therapist"] as const;
export type AgendaRole = (typeof AGENDA_ROLES)[number];

// A note belongs to a CALENDAR DAY, so it travels as a plain "YYYY-MM-DD" string and is never
// put through a timezone conversion. The column is DATE for the same reason.
export const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export const AgendaNoteSchema = z.object({
  note_date: z.string().regex(DATE_ONLY_RE, "Invalid date"),
  content: z.string().trim().min(1, "Content is required"),
  // At least one, always: under an overlap query an empty array matches nobody, so a note with
  // no audience would be silently invisible to everyone. Same guard guidelines already has.
  target_roles: z
    .array(z.enum(AGENDA_ROLES))
    .min(1, "Choose at least one audience"),
});

export type AgendaNoteSchemaType = z.infer<typeof AgendaNoteSchema>;
