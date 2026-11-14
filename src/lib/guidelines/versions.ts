/**
 * Past versions of a guideline, read from guidelines_log (see the 2026-11-14 migration). Each log
 * row keeps the row before and after one change, so a language's versions are the "after" of
 * each save, plus the "before" of the oldest save: the text it had when the log started.
 * Free of server-only imports: the versions dialog builds its list with this.
 */

/** The day guidelines_log started recording. Nothing earlier was kept. */
export const GUIDELINE_HISTORY_START = "2026-11-14";

export type ChangeType = "INSERT" | "UPDATE" | "DELETE";

export type TextSnapshot = { title: string | null; content: string };

/** One guidelines_log row, as GET /api/guidelines/[id]/versions sends it (newest first). */
export type GuidelineLogEntry =
  | {
      kind: "text";
      id: string;
      change: ChangeType;
      language: string;
      at: string;
      /** Email of whoever saved it; null when not recorded. */
      by: string | null;
      /** The text before the save, and when that text had been saved. Null for a new language. */
      before: (TextSnapshot & { saved_at: string | null }) | null;
      /** The text after the save. Null when the save removed the language. */
      after: TextSnapshot | null;
    }
  | {
      kind: "guideline";
      id: string;
      change: ChangeType;
      at: string;
      by: string | null;
      roles_before: string[] | null;
      roles_after: string[] | null;
      deleted_before: boolean;
      deleted_after: boolean;
    };

/** A language's text as it is now. */
export type CurrentVersion = { language: string; title: string | null; content: string; updated_at: string };

export type VersionStatus = "created" | "edited" | "removed" | "baseline" | "unchanged";

export type TimelineItem =
  | {
      type: "version";
      key: string;
      status: VersionStatus;
      at: string | null;
      by: string | null;
      /** The text this save replaced: null when nothing earlier is on record. */
      before: TextSnapshot | null;
      /** The text after this save: null when it removed the language. */
      after: TextSnapshot | null;
      isCurrent: boolean;
    }
  | {
      type: "event";
      key: string;
      event: "created" | "audience" | "deleted" | "restored";
      at: string;
      by: string | null;
      roles_before: string[] | null;
      roles_after: string[] | null;
    };

const sameRoles = (a: string[] | null, b: string[] | null) =>
  [...(a ?? [])].sort().join(",") === [...(b ?? [])].sort().join(",");

/** Languages with a current text or any logged change, in GUIDELINE_LANGUAGES order. */
export function versionLanguages(entries: GuidelineLogEntry[], current: CurrentVersion[], order: readonly string[]) {
  const seen = new Set([
    ...current.map((c) => c.language),
    ...entries.flatMap((e) => (e.kind === "text" ? [e.language] : [])),
  ]);
  return order.filter((l) => seen.has(l));
}

/**
 * The versions list for one language, newest first: each save of its text, the text it had when
 * the log started, and the guideline's own changes (audience, deletion), which apply to every
 * language.
 */
export function buildTimeline(
  entries: GuidelineLogEntry[],
  current: CurrentVersion[],
  language: string,
): TimelineItem[] {
  const texts = entries.filter(
    (e): e is Extract<GuidelineLogEntry, { kind: "text" }> => e.kind === "text" && e.language === language,
  );
  const now = current.find((c) => c.language === language);

  const items: TimelineItem[] = texts.map((e) => ({
    type: "version",
    key: e.id,
    status: e.change === "INSERT" ? "created" : e.change === "DELETE" ? "removed" : "edited",
    at: e.at,
    by: e.by,
    before: e.before ? { title: e.before.title, content: e.before.content } : null,
    after: e.after,
    isCurrent: false,
  }));

  const oldest = texts[texts.length - 1];
  if (oldest?.before) {
    items.push({
      type: "version",
      key: `${oldest.id}-before`,
      status: "baseline",
      at: oldest.before.saved_at,
      by: null,
      before: null,
      after: { title: oldest.before.title, content: oldest.before.content },
      isCurrent: false,
    });
  }

  if (texts.length === 0 && now) {
    items.push({
      type: "version",
      key: `current-${language}`,
      status: "unchanged",
      at: now.updated_at,
      by: null,
      before: null,
      after: { title: now.title, content: now.content },
      isCurrent: true,
    });
  } else if (now && texts[0] && texts[0].change !== "DELETE") {
    const newest = items[0];
    if (newest.type === "version") newest.isCurrent = true;
  }

  for (const e of entries) {
    if (e.kind !== "guideline") continue;
    const base = { type: "event" as const, at: e.at, by: e.by, roles_before: e.roles_before, roles_after: e.roles_after };
    if (e.change === "INSERT") {
      items.push({ ...base, key: `${e.id}-created`, event: "created" });
      continue;
    }
    if (e.change === "UPDATE" && !sameRoles(e.roles_before, e.roles_after)) {
      items.push({ ...base, key: `${e.id}-audience`, event: "audience" });
    }
    if (!e.deleted_before && e.deleted_after) items.push({ ...base, key: `${e.id}-deleted`, event: "deleted" });
    if (e.deleted_before && !e.deleted_after) items.push({ ...base, key: `${e.id}-restored`, event: "restored" });
  }

  // Newest first; an undated version (none recorded) goes last. The sort is stable, so within one
  // save the text stays above the guideline's own change.
  const time = (i: TimelineItem) => (i.at ? new Date(i.at).getTime() : -Infinity);
  return items.sort((a, b) => time(b) - time(a));
}
