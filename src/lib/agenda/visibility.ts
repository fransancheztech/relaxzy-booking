import { AGENDA_ROLES, type AgendaRole } from "@/schemas/agendaNote.schema";

// Seniority: admin > receptionist > therapist. You see a note addressed to your level or below,
// so a therapist-only note ("Ana is off sick, cover her 3pm") still reaches the front desk, while
// an admin-only note stays private.
//
// Expressed as a visible-set per role rather than rank arithmetic, because it maps directly onto
// a single `target_roles hasSome [...]` query. Note this is deliberately NOT the rule guidelines
// uses (exact role match) — there, a therapist-targeted guideline is hidden from reception.
const VISIBLE_TARGETS: Record<string, readonly AgendaRole[]> = {
  admin: AGENDA_ROLES,
  receptionist: ["receptionist", "therapist"],
  therapist: ["therapist"],
};

/** Which target_roles values this viewer is allowed to see. Empty = sees nothing. */
export function visibleTargetsFor(role: string | null): readonly AgendaRole[] {
  return VISIBLE_TARGETS[role ?? ""] ?? [];
}

/** Therapists read the agenda through the top bar only; the page and all writes are closed to them. */
export function canManageAgenda(role: string | null): boolean {
  return role === "admin" || role === "receptionist";
}

/**
 * Which audiences this viewer may address a note to. A receptionist cannot write to admins —
 * they could not see the note afterwards, so it would vanish the moment it was saved.
 */
export function assignableTargetsFor(role: string | null): readonly AgendaRole[] {
  if (role === "admin") return AGENDA_ROLES;
  if (role === "receptionist") return ["receptionist", "therapist"];
  return [];
}

// --- DATE <-> "YYYY-MM-DD" -----------------------------------------------------------------
// Prisma surfaces a DATE column as a JS Date pinned to UTC midnight. Both directions below use
// UTC accessors on purpose: reading with local getters would shift the day for anyone west of
// Greenwich, which is exactly the class of bug the DATE column exists to avoid.

export function dateOnlyToUtcDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function utcDateToDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}
