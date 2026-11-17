import { foldText } from "@/utils/text";
import { SPANISH_ACCENTED } from "@/lib/review/spanishNames";
import type { AccentWord, MissingAccentDetails, NameProposal } from "@/lib/review/types";
import { applyNameChange, revertNameChange } from "./nameChange";
import type { Candidate, ReviewCheck } from "./types";

// A spelling seen on this many other clients counts as evidence even when it isn't in the Spanish
// list (e.g. a French "François"). A single client is not enough: it may be the typo itself
// ("Víctoria").
const MIN_SEEN = 2;

const WORD = /\p{L}+/gu;
const hasMark = (lowerWord: string) => foldText(lowerWord) !== lowerWord;

/** "Dario" + "darío" → "Darío": the accented letters, with the original word's capitals. */
function withCaseOf(original: string, accentedLower: string): string {
  const orig = Array.from(original);
  return Array.from(accentedLower)
    .map((ch, i) => (orig[i] && orig[i] !== orig[i].toLocaleLowerCase("es") ? ch.toLocaleUpperCase("es") : ch))
    .join("");
}

/**
 * Names and surnames written without the accent or ñ they normally have ("Dario" → "Darío",
 * "Munoz" → "Muñoz"). Evidence is the usual Spanish spelling, or the same name spelled with the
 * accent on other clients. One item per client; both fields are corrected together.
 */
export const clientMissingAccent: ReviewCheck = {
  source: "clients-check",

  async find(db) {
    const clients = await db.clients.findMany({
      where: { deleted_at: null },
      select: { id: true, client_name: true, client_surname: true, client_phone: true, client_email: true },
    });

    // folded word → lower-case spelling → number of clients that use it
    const spellings = new Map<string, Map<string, number>>();
    for (const c of clients) {
      const words = new Set(
        `${c.client_name ?? ""} ${c.client_surname ?? ""}`.normalize("NFC").toLocaleLowerCase("es").match(WORD) ?? [],
      );
      for (const w of words) {
        const f = foldText(w);
        const m = spellings.get(f) ?? new Map<string, number>();
        m.set(w, (m.get(w) ?? 0) + 1);
        spellings.set(f, m);
      }
    }

    const suggestionFor = (word: string): AccentWord | null => {
      const lower = word.toLocaleLowerCase("es");
      if (hasMark(lower)) return null;
      const f = foldText(lower);
      const seenOf = (s: string) => spellings.get(f)?.get(s) ?? 0;
      const sameLength = (s: string) => Array.from(s).length === Array.from(lower).length;

      const spanish = SPANISH_ACCENTED.get(f);
      if (spanish && sameLength(spanish)) {
        return { from: word, to: withCaseOf(word, spanish), source: "spanish", seen: seenOf(spanish) };
      }
      const best = [...(spellings.get(f) ?? new Map<string, number>()).entries()]
        .filter(([s, n]) => hasMark(s) && sameLength(s) && n >= MIN_SEEN)
        .sort((a, b) => b[1] - a[1])[0];
      return best ? { from: word, to: withCaseOf(word, best[0]), source: "clients", seen: best[1] } : null;
    };

    const candidates: Candidate[] = [];
    for (const c of clients) {
      const words: AccentWord[] = [];
      const fix = (value: string | null) => {
        if (!value) return value;
        return value.normalize("NFC").replace(WORD, (w) => {
          const s = suggestionFor(w);
          if (!s) return w;
          words.push(s);
          return s.to;
        });
      };
      const name = fix(c.client_name);
      const surname = fix(c.client_surname);
      if (words.length === 0 || !name) continue;

      const details: MissingAccentDetails = {
        client_name: c.client_name,
        client_surname: c.client_surname,
        client_phone: c.client_phone,
        client_email: c.client_email,
        words,
      };
      const proposal: NameProposal = { client_name: name, client_surname: surname };
      candidates.push({ item_key: c.id, client_id: c.id, details, proposal });
    }
    return candidates;
  },

  apply: applyNameChange,
  revert: revertNameChange,
};
