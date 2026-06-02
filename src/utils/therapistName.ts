// A therapist's display name. The DB stores nickname / name / surname, with a
// constraint guaranteeing at least one of nickname or name is present. The name
// shown everywhere in the app is the nickname when present, otherwise the name
// (surname is kept only as a defensive last resort).
export function therapistDisplayName(t: {
  nickname?: string | null;
  name?: string | null;
  surname?: string | null;
}): string {
  return (
    t.nickname?.trim() ||
    t.name?.trim() ||
    t.surname?.trim() ||
    "—"
  );
}

// Equivalent SQL expression for raw queries (Postgres). Pass the therapist table
// alias, e.g. therapistDisplayNameSql("th") → use inside SELECT with an alias.
export function therapistDisplayNameSql(alias: string): string {
  return `COALESCE(NULLIF(BTRIM(${alias}.nickname), ''), NULLIF(BTRIM(${alias}.name), ''), NULLIF(BTRIM(${alias}.surname), ''), '—')`;
}
