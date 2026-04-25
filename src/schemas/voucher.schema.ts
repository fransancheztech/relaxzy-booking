import { phoneValidator } from "@/utils/phoneValidator";
import * as z from "zod";

export const VoucherSchema = z.object({
    buyer_name: z.string().min(1, "Buyer name is required"),
    buyer_surname: z.string().optional(),
    buyer_phone: z.string().optional().refine((val) => !val || phoneValidator(val), {
        message: "Invalid phone number",
    }),
    buyer_email: z.string().optional().refine((val) => !val || z.email().safeParse(val).success, {
        message: "Invalid email address",
    }),
    recipient_name: z.string().optional(),
    recipient_surname: z.string().optional(),
    recipient_phone: z.string().optional().refine((val) => !val || phoneValidator(val), {
        message: "Invalid phone number",
    }),
    recipient_email: z.string().optional().refine((val) => !val || z.email().safeParse(val).success, {
        message: "Invalid email address",
    }),
    initial_balance: z.number({ error: "Balance must be a number" }).positive("Balance must be greater than 0"),
    initial_payment_code: z.string().optional(),
    notes: z.string().optional(),
    expiration_date: z.date({ error: "Expiration date is required" }),
}).superRefine((data, ctx) => {
    if (!data.buyer_email && !data.buyer_phone) {
        ctx.addIssue({
            code: "custom",
            message: "Provide at least a phone or email for the buyer",
            path: ["buyer_phone"],
        });
    }

    const hasRecipient = !!(data.recipient_name || data.recipient_surname || data.recipient_email || data.recipient_phone);

    if (hasRecipient && !data.recipient_name) {
        ctx.addIssue({
            code: "custom",
            message: "Recipient name is required",
            path: ["recipient_name"],
        });
    }

    if (hasRecipient && !data.recipient_email && !data.recipient_phone) {
        ctx.addIssue({
            code: "custom",
            message: "Provide at least a phone or email for the recipient",
            path: ["recipient_phone"],
        });
    }
});

export type VoucherSchemaType = z.infer<typeof VoucherSchema>;
