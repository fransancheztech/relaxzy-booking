import * as z from "zod";

export const GUIDELINE_ROLES = ["admin", "receptionist", "therapist"] as const;
export type GuidelineRole = (typeof GUIDELINE_ROLES)[number];

export const GuidelineSchema = z.object({
  title: z.string().optional(),
  content: z.string().min(1, "Content is required"),
  target_roles: z
    .array(z.enum(GUIDELINE_ROLES))
    .min(1, "Choose at least one audience"),
});

export type GuidelineSchemaType = z.infer<typeof GuidelineSchema>;
