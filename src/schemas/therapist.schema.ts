import z from "zod";

export const UpdateTherapistSchema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email").optional(),
  phone: z.string().optional(),
  notes: z.string().max(500).optional(),
});

export type UpdateTherapistSchemaType = z.infer<typeof UpdateTherapistSchema>;