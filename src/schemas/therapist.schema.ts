import z from "zod";
import { phoneValidator } from "@/utils/phoneValidator";

export const UpdateTherapistSchema = z
  .object({
    nickname: z.string().optional(),
    name: z.string().optional(),
    surname: z.string().optional(),
    email: z
      .string()
      .optional()
      .refine(
        (val) => !val || val.trim() === "" || z.email().safeParse(val).success,
        { message: "Invalid email address" }
      ),
    phone: z
      .string()
      .optional()
      .refine((val) => !val || phoneValidator(val), {
        message: "Invalid phone number",
      }),
    notes: z.string().max(500).optional(),
    active: z.boolean().optional(),
    off_days: z.array(z.number().int().min(1).max(7)).optional(),
  })
  // Mirrors the DB CHECK: a therapist must have at least a nickname or a name.
  .refine((d) => !!(d.nickname?.trim() || d.name?.trim()), {
    message: "Enter a nickname or a name",
    path: ["nickname"],
  });

export type UpdateTherapistSchemaType = z.infer<typeof UpdateTherapistSchema>;
