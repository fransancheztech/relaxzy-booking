import z from "zod";
import { phoneValidator } from "@/utils/phoneValidator";

export const UpdateTherapistSchema = z.object({
  full_name: z.string().min(1, "Full name is required"),
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
});

export type UpdateTherapistSchemaType = z.infer<typeof UpdateTherapistSchema>;
