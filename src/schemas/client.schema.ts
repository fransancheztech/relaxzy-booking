import { phoneValidator } from "@/utils/phoneValidator";
import { z } from "zod";

export const ClientUpdateSchema = z
  .object({
    client_name: z.string().min(1, "Name is required"),
    client_surname: z.string().min(1, "Surname is required"),
    client_email: z
      .string()
      .optional()
      .refine(
        (val) => !val || val.trim() === "" || z.email().safeParse(val).success,
        { message: "Invalid email address" }
      ),
    client_phone: z
      .string()
      .optional()
      .refine((val) => !val || phoneValidator(val), {
        message: "Invalid phone number",
      }),
    client_notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // ------------------------------
    // CLIENT VALIDATION
    // ------------------------------
    const hasAnyClientInfo = !!(
      data.client_name ||
      data.client_surname ||
      data.client_email ||
      data.client_phone
    );

    if (hasAnyClientInfo) {
      // Case: identified client → must have name + (phone or email)
      if (!data.client_name) {
        ctx.addIssue({
          code: "custom",
          message: "Client name is required if identifying a client",
          path: ["client_name"],
        });
      }
      if (!data.client_email && !data.client_phone) {
        ctx.addIssue({
          code: "custom",
          message: "Provide at least a phone or email for the client",
          path: ["booking_creation_form"],
        });
      }
    }
  });

export type ClientUpdateSchemaType = z.infer<typeof ClientUpdateSchema>;
