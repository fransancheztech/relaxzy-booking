import { foldText } from "@/utils/text";
import { normalizeClientName, normalizeClientSurname } from "@/utils/names";
import { COMPOUND_NAME_PARTS } from "@/lib/review/spanishNames";
import type { NameProposal, SurnameInNameDetails } from "@/lib/review/types";
import { applyNameChange, revertNameChange } from "./nameChange";
import type { Candidate, ReviewCheck } from "./types";

const PARTICLES = new Set(["de", "del", "la", "las", "los", "da", "di", "van", "von", "der", "du", "dos", "das"]);

// Names of several people or of a company ("Mamá y Ana", "Silvia, Conso y Sonia", "You Work 2",
// "Juan (Marcus)") are not a name plus surname, so this check leaves them out. So are the
// "From"/"To" lines of gift vouchers typed in as a client ("Tus Amigas del Cole", "De Todos Tus
// Amigos", "Para Hermana de Silvia", "Familia García Tuñón"): no real first name starts that way.
const GROUP_CHARS = /[0-9()[\]{},;:&+/]/;
const GROUP_WORDS = new Set(["y", "e", "and", "und", "et"]);
const NOT_A_FIRST_NAME = new Set([
  "tu", "tus", "mi", "mis", "su", "sus", "para", "de", "del", "la", "el", "los", "las", "familia", "equipo", "gran",
]);

const isPart = (w: string) => COMPOUND_NAME_PARTS.has(foldText(w));
const isParticle = (w: string) => PARTICLES.has(foldText(w));

/**
 * Where the first name ends: after the first word, plus any word that usually continues a Spanish
 * compound first name ("José María", "Mari Carmen", "María del Mar"). At least one word is left
 * for the surname.
 */
function surnameStart(words: string[]): number {
  let i = 1;
  while (i < words.length) {
    if (isPart(words[i])) { i++; continue; }
    let j = i;
    while (j < words.length && isParticle(words[j])) j++;
    if (j > i && j < words.length && isPart(words[j])) { i = j + 1; continue; }
    break;
  }
  return Math.min(i, words.length - 1);
}

/** The whole value is a compound first name ("Miguel Ángel", "María del Carmen"): nothing to split. */
function isCompoundFirstName(words: string[]): boolean {
  if (!isPart(words[0]) || !isPart(words[words.length - 1])) return false;
  return words.slice(1).every((w) => isPart(w) || isParticle(w));
}

/**
 * Clients whose name field holds name and surname while the surname field is empty
 * ("Rocío Sotomayor"). The proposal splits off the surname; the reviewer confirms or edits it.
 */
export const clientSurnameInName: ReviewCheck = {
  source: "clients-check",

  async find(db) {
    const clients = await db.clients.findMany({
      where: { deleted_at: null, OR: [{ client_surname: null }, { client_surname: "" }] },
      select: { id: true, client_name: true, client_surname: true, client_phone: true, client_email: true },
    });

    const candidates: Candidate[] = [];
    for (const c of clients) {
      const value = c.client_name?.normalize("NFC").trim() ?? "";
      const words = value.split(/\s+/).filter(Boolean);
      if (words.length < 2) continue;
      if (GROUP_CHARS.test(value) || words.some((w) => GROUP_WORDS.has(w.toLocaleLowerCase("es")))) continue;
      if (NOT_A_FIRST_NAME.has(foldText(words[0]))) continue;
      if (isCompoundFirstName(words)) continue;

      const at = surnameStart(words);
      const name = normalizeClientName(words.slice(0, at).join(" "));
      const surname = normalizeClientSurname(words.slice(at).join(" "));
      if (!name || !surname) continue;

      const details: SurnameInNameDetails = {
        client_name: c.client_name,
        client_surname: c.client_surname,
        client_phone: c.client_phone,
        client_email: c.client_email,
      };
      const proposal: NameProposal = { client_name: name, client_surname: surname };
      candidates.push({ item_key: c.id, client_id: c.id, details, proposal });
    }
    return candidates;
  },

  apply: applyNameChange,
  revert: revertNameChange,
};
