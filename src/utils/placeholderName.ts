import { PLACEHOLDER_CLIENT_NAMES } from "@/constants";

// Normalize a name for comparison: strip diacritics, lowercase, collapse any run of
// non-alphanumeric characters into a single space, and trim. So "Walk-In", "ANONIMO"
// and "n/a" become "walk in", "anonimo" and "n a".
export function normalizeNameForCompare(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// True when a name is a placeholder for an unknown client: a known placeholder token,
// or a value made up entirely of punctuation/symbols (e.g. "-", "...", "??") that
// normalizes to nothing. An empty/whitespace name is NOT a placeholder (no name typed).
export function isPlaceholderClientName(raw: string | null | undefined): boolean {
  if (!raw || raw.trim() === "") return false;
  const normalized = normalizeNameForCompare(raw);
  if (normalized === "") return true;
  return PLACEHOLDER_CLIENT_NAMES.has(normalized);
}
