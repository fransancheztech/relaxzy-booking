/**
 * Languages a guideline can be written in. The order is also the fallback order: a reader sees
 * the version in the app's language, or else the first of these that exists.
 * Free of server-only imports: the guideline pages and dialog use it too.
 */
export const GUIDELINE_LANGUAGES = ["es", "en", "th"] as const;
export type GuidelineLanguage = (typeof GUIDELINE_LANGUAGES)[number];

/** Each language's own name for itself, for the editor tabs and the language switch. */
export const GUIDELINE_LANGUAGE_NATIVE: Record<GuidelineLanguage, string> = {
  es: "Español",
  en: "English",
  th: "ไทย",
};

export function isGuidelineLanguage(value: unknown): value is GuidelineLanguage {
  return (GUIDELINE_LANGUAGES as readonly unknown[]).includes(value);
}

export interface GuidelineTranslation {
  language: GuidelineLanguage;
  title: string | null;
  content: string;
}

/** The version to show for `wanted`: that language if it exists, else the first by priority. */
export function pickTranslation<T extends { language: string }>(translations: T[], wanted: string): T | null {
  const find = (language: string) => translations.find((t) => t.language === language);
  return find(wanted) ?? GUIDELINE_LANGUAGES.map(find).find(Boolean) ?? translations[0] ?? null;
}

/**
 * The editor's per-language fields, reduced to the versions to save: those with text. A language
 * left empty has no version (and loses the one it had, when editing).
 */
export function filledTranslations(
  translations: Partial<Record<GuidelineLanguage, { title?: string; content?: string }>>,
): GuidelineTranslation[] {
  return GUIDELINE_LANGUAGES.flatMap((language) => {
    const content = translations[language]?.content?.trim();
    if (!content) return [];
    return [{ language, title: translations[language]?.title?.trim() || null, content }];
  });
}
