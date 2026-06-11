import { z } from "zod";
import { phoneValidator } from "@/utils/phoneValidator";

const optionalEmail = z
  .string()
  .optional()
  .refine(
    (val) => !val || val.trim() === "" || z.email().safeParse(val).success,
    { message: "Invalid email address" }
  );

const optionalPhone = z
  .string()
  .optional()
  .refine((val) => !val || phoneValidator(val), {
    message: "Invalid phone. For a non-Spanish number, add the international prefix (e.g. +33 for France).",
  });

/** Validates only the contact fields shared by booking/voucher payloads. */
export const ClientContactSchema = z.object({
  client_name: z.string().optional(),
  client_surname: z.string().optional(),
  client_phone: optionalPhone,
  client_email: optionalEmail,
});

export const VoucherContactSchema = z.object({
  buyer_name: z.string().optional(),
  buyer_surname: z.string().optional(),
  buyer_phone: optionalPhone,
  buyer_email: optionalEmail,
  recipient_name: z.string().optional(),
  recipient_surname: z.string().optional(),
  recipient_phone: optionalPhone,
  recipient_email: optionalEmail,
});
