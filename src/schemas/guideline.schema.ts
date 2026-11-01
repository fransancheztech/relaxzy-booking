import * as z from "zod";
import { GUIDELINE_LANGUAGES } from "@/lib/guidelines/languages";

export const GUIDELINE_ROLES = ["admin", "receptionist", "therapist"] as const;
export type GuidelineRole = (typeof GUIDELINE_ROLES)[number];

const TranslationFieldsSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
});

export const GuidelineSchema = z
  .object({
    // One set of fields per language; the ones left empty are simply not saved.
    translations: z.object({
      es: TranslationFieldsSchema,
      en: TranslationFieldsSchema,
      th: TranslationFieldsSchema,
    }),
    target_roles: z
      .array(z.enum(GUIDELINE_ROLES))
      .min(1, "Choose at least one audience"),
  })
  .superRefine((data, ctx) => {
    const withText = GUIDELINE_LANGUAGES.filter((l) => data.translations[l].content?.trim());
    if (withText.length === 0) {
      ctx.addIssue({ code: "custom", path: ["translations"], message: "Write the guideline in at least one language" });
    }
    // A title alone would be dropped on save without a word: ask for the text instead.
    for (const l of GUIDELINE_LANGUAGES) {
      if (data.translations[l].title?.trim() && !data.translations[l].content?.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["translations", l, "content"],
          message: "Write the text for this title, or clear the title",
        });
      }
    }
  });

export type GuidelineSchemaType = z.infer<typeof GuidelineSchema>;
