// How client names and surnames are stored (agreed 2026-10-24):
//   1. one Unicode form (NFC), trimmed, single spaces;
//   2. a word typed ALL in lower case gets its first letter capitalised — "ana" → "Ana";
//   3. a word that already has a capital is left exactly as typed: McDonald, DiCaprio, JC, MT;
//   4. Spanish/European particles stay lower case unless they start the name: "maria del carmen"
//      → "Maria del Carmen", "esperanza y monica" → "Esperanza y Monica". In the surname field they
//      stay lower case even first, since the surname is shown after the name ("Ana de la Fuente");
//   5. each part of a hyphenated or apostrophe name is capitalised: "ana-belén" → "Ana-Belén",
//      "o'brien" → "O'Brien";
//   6. accents are never added or removed: "jesus" → "Jesus".
// Only words that are entirely lower case are touched, so a deliberate spelling is never "fixed".

const PARTICLES = new Set([
  "de", "del", "la", "las", "los", "y", "e", "da", "di", "van", "von", "der", "du", "dos", "das",
]);

const hasLetter = (s: string) => /\p{L}/u.test(s);
const isAllLower = (s: string) => hasLetter(s) && s === s.toLocaleLowerCase("es");

/** Capitalise the first letter of each hyphen / apostrophe-separated part: "o'brien" → "O'Brien". */
function capitaliseWord(word: string): string {
  return word
    .split(/([-'’])/)
    .map((part) => part.replace(/\p{L}/u, (ch) => ch.toLocaleUpperCase("es")))
    .join("");
}

/**
 * The stored form of a client's name or surname (see the rules above). Empty input → null, so
 * callers can write it straight to a nullable column.
 */
export function normalizeClientName(
  raw: string | null | undefined,
  { surname = false }: { surname?: boolean } = {},
): string | null {
  const cleaned = raw?.normalize("NFC").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned
    .split(" ")
    .map((word, i) => {
      if (!isAllLower(word)) return word;
      if (PARTICLES.has(word) && (surname || i > 0)) return word;
      return capitaliseWord(word);
    })
    .join(" ");
}

/** normalizeClientName for the surname field. */
export const normalizeClientSurname = (raw: string | null | undefined) => normalizeClientName(raw, { surname: true });
