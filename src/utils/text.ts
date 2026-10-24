// Accent-insensitive comparison of names. Names are stored exactly as typed ("Rocío", "François");
// searching and matching compare a "folded" form instead: lower-case, accents removed, foreign letters
// spelled the way a Spanish keyboard would type them, spaces collapsed. "Rocio", "ROCÍO" and
// " rocío " all fold to "rocio".
//
// This MUST stay in step with the database's public.fold_text() (unaccent + lower), which fills the
// generated columns clients.client_name_folded / client_surname_folded / client_full_name_folded:
// the app folds the search term, the database folds the stored name, and the two are compared.
// Letters without a decomposed form are mapped by hand to unaccent's spelling.

const SPECIAL_LETTERS: Record<string, string> = {
  ß: "ss",
  æ: "ae",
  œ: "oe",
  ø: "o",
  ł: "l",
  đ: "d",
  ð: "d",
  þ: "th",
  ı: "i",
};
const SPECIAL_RE = new RegExp(`[${Object.keys(SPECIAL_LETTERS).join("")}]`, "g");

/** "  Rocío  Sotomayor" → "rocio sotomayor"; "Straße" → "strasse". Empty input → "". */
export function foldText(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(SPECIAL_RE, (ch) => SPECIAL_LETTERS[ch])
    .replace(/\s+/g, " ")
    .trim();
}

/** Folded "name surname", matching clients.client_full_name_folded. */
export function foldFullName(name: string | null | undefined, surname: string | null | undefined): string {
  return foldText(`${name ?? ""} ${surname ?? ""}`);
}
