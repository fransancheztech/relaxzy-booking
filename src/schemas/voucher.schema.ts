import { phoneValidator } from "@/utils/phoneValidator";
import * as z from "zod";

export const VoucherSchema = z.object({
    recipient_name: z.string().optional(),
    recipient_surname: z.string().optional(),
    recipient_phone: z.string().optional().refine((val) => !val || phoneValidator(val), {
        message: "Invalid phone number",
    }),
    recipient_email: z.string().optional().refine((val) => !val || z.email().safeParse(val).success, {
        message: "Invalid email address",
    }),
    buyer_name: z.string().optional(),
    buyer_surname: z.string().optional(),
    buyer_phone: z.string().optional().refine((val) => !val || phoneValidator(val), {
        message: "Invalid phone number",
    }),
    buyer_email: z.string().optional().refine((val) => !val || z.email().safeParse(val).success, {
        message: "Invalid email address",
    }),
    initial_balance: z.number().optional(),
    initial_payment_code: z.string().optional(),
    notes: z.string().optional(),
    expiration_date: z.date().optional(),
})

export type VoucherSchemaType = z.infer<typeof VoucherSchema>;