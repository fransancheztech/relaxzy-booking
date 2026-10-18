import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

// Phone numbers are stored in E.164 ("+34689590123"): one spelling per number, so the unique
// index on clients.client_phone can actually tell two clients apart. Before this, every write path
// stored whatever was typed, and "+34 689 59 01 23", "+34689590123" and "689590123" became three
// different clients for the same person.
//
// The canonical form must come from libphonenumber, never from a regex: 31 stored numbers carry a
// national trunk "0" after the country code ("+44 07368…", "+33 06…"), which libphonenumber drops
// and a digits-only rule would keep — so a regex key would fail to match those as the same number.
//
// Isomorphic: the same rules run in route handlers and in the browser (display, highlighting).
// libphonenumber-js is already in the client bundle through phoneValidator.

const DEFAULT_COUNTRY: CountryCode = "ES";

const parse = (raw: string) => {
  try {
    return parsePhoneNumberFromString(raw, DEFAULT_COUNTRY);
  } catch {
    return undefined;
  }
};

/**
 * The stored form of a phone: E.164 for a valid number, null when empty. An invalid value is
 * returned trimmed rather than dropped — every write path validates first, so this only matters
 * as a no-data-loss fallback.
 */
export function canonicalPhone(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const parsed = parse(trimmed);
  return parsed?.isValid() ? parsed.number : trimmed;
}

/** True when two values are the same number, however each one is formatted. */
export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const ca = canonicalPhone(a);
  return ca !== null && ca === canonicalPhone(b);
}

/**
 * The spellings a stored row could hold for this input: exactly what was typed, and the canonical
 * form. Lookups use both, so they find rows written before normalisation existed as well as rows
 * written after it.
 */
export function phoneLookupValues(raw: string | null | undefined): string[] {
  const trimmed = raw?.trim();
  if (!trimmed) return [];
  const canonical = canonicalPhone(trimmed);
  return canonical && canonical !== trimmed ? [trimmed, canonical] : [trimmed];
}

/**
 * How an UPDATE should write a phone, given what the row currently stores.
 *
 * When the typed value is the same number as the stored one, the stored string is kept untouched
 * and `changed` is false, so the caller skips the collision check. Without this, editing anything
 * on a client whose legacy-format number is shared with a duplicate sibling would rewrite it into
 * the sibling's canonical value and fail with "phone already taken" — making 148 rows uneditable
 * until the duplicate merge. Existing duplicates are the merge's job; this only stops new ones.
 */
export function resolvePhoneUpdate(
  typed: string | null | undefined,
  stored: string | null | undefined,
): { value: string | null; changed: boolean } {
  const next = canonicalPhone(typed);
  const current = stored?.trim() || null;
  if (next === null) return { value: null, changed: current !== null };
  if (current && samePhone(next, current)) return { value: current, changed: false };
  return { value: next, changed: true };
}

/** Digits only — for substring search, so typing "689 59 01" finds "+34689590123". */
export function phoneDigits(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

/**
 * Substrings to look for in a stored phone, for a search query: its digits alone (finds the
 * E.164 rows whatever spacing was typed) and the query as typed (still finds a legacy row stored
 * with spaces, e.g. a duplicate kept as-is until the merge). Digits are only used once there are
 * `minDigits` of them, so a free-text search like "Room 2" doesn't match every number with a 2.
 */
export function phoneSearchTerms(raw: string | null | undefined, minDigits = 1): string[] {
  const typed = raw?.trim() ?? "";
  const digits = phoneDigits(typed);
  const terms = new Set<string>();
  if (typed) terms.add(typed);
  if (digits.length >= minDigits) terms.add(digits);
  return [...terms];
}

/** International display format ("+34 689 59 01 23"); the value as-is if it does not parse. */
export function formatPhone(raw: string | null | undefined): string {
  const trimmed = raw?.trim();
  if (!trimmed) return "";
  const parsed = parse(trimmed);
  return parsed?.isValid() ? parsed.formatInternational() : trimmed;
}

/**
 * Where the digits of `query` occur inside `text`, as a [start, end) range over `text`. Lets a
 * search highlight span the spaces of a formatted number ("689 59" inside "+34 689 59 01 23").
 * Null when the query has no digits or they don't occur.
 */
export function phoneDigitRange(text: string, query: string | null | undefined): [number, number] | null {
  const wanted = phoneDigits(query);
  if (!wanted) return null;
  const positions: number[] = [];
  let digits = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch >= "0" && ch <= "9") {
      positions.push(i);
      digits += ch;
    }
  }
  const at = digits.indexOf(wanted);
  if (at < 0) return null;
  return [positions[at], positions[at + wanted.length - 1] + 1];
}
