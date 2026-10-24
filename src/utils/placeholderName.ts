import { PLACEHOLDER_CLIENT_NAMES } from "@/constants";
import { foldText } from "@/utils/text";

// Normalize a name for comparison: fold it like the database does (accents and foreign letters,
// see foldText), then collapse any run of non-alphanumeric characters into a single space. So
// "Walk-In", "ANONIMO", "n/a" and "Straße" become "walk in", "anonimo", "n a" and "strasse".
export function normalizeNameForCompare(raw: string): string {
  return foldText(raw)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Form error for a placeholder name in the client and voucher forms (bookings have their own). */
export const PLACEHOLDER_NAME_ERROR =
  "This looks like a placeholder (\"-\", \".\", \"walk in\"…), not a name. Enter the client's real name.";

// True when a name is a placeholder for an unknown client: a known placeholder token,
// or a value made up entirely of punctuation/symbols (e.g. "-", "...", "??") that
// normalizes to nothing. An empty/whitespace name is NOT a placeholder (no name typed).
export function isPlaceholderClientName(raw: string | null | undefined): boolean {
  if (!raw || raw.trim() === "") return false;
  const normalized = normalizeNameForCompare(raw);
  if (normalized === "") return true;
  return PLACEHOLDER_CLIENT_NAMES.has(normalized);
}
