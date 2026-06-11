import { phoneValidator } from "@/utils/phoneValidator";
import * as z from "zod";

export const VoucherSchema = z.object({
    buyer_name: z.string().min(1, "Buyer name is required"),
    buyer_surname: z.string().optional(),
    buyer_phone: z.string().optional().refine((val) => !val || phoneValidator(val), {
        message: "Invalid phone. For a non-Spanish number, add the international prefix (e.g. +33 for France).",
    }),
    buyer_email: z.string().optional().refine((val) => !val || z.email().safeParse(val).success, {
        message: "Invalid email address",
    }),
    recipient_name: z.string().optional(),
    recipient_surname: z.string().optional(),
    recipient_phone: z.string().optional().refine((val) => !val || phoneValidator(val), {
        message: "Invalid phone. For a non-Spanish number, add the international prefix (e.g. +33 for France).",
    }),
    recipient_email: z.string().optional().refine((val) => !val || z.email().safeParse(val).success, {
        message: "Invalid email address",
    }),
    initial_balance: z.preprocess(
        (v) => {
            if (v === "" || v === null || v === undefined) return undefined;
            if (typeof v === "string") {
                const num = Number(v.replace(",", "."));
                return Number.isNaN(num) ? v : num;
            }
            return v;
        },
        z.number({ error: "Balance must be a number" }).positive("Balance must be greater than 0"),
    ),
    payment_method: z.enum(["cash", "credit_card"], { error: "Payment method is required" }),
    notes: z.string().optional(),
    source: z.enum(["physical", "online"], { error: "Source is required" }),
    external_reference: z.string().optional(),
    expiration_date: z.date({ error: "Expiration date is required" }),
    created_at: z.date().optional(),
}).superRefine((data, ctx) => {
    // Contact info (phone/email) is encouraged but not enforced here — the New Voucher
    // dialog warns the receptionist on submit instead of blocking. Names stay required.
    const hasRecipient = !!(data.recipient_name || data.recipient_surname || data.recipient_email || data.recipient_phone);

    if (hasRecipient && !data.recipient_name) {
        ctx.addIssue({
            code: "custom",
            message: "Recipient name is required",
            path: ["recipient_name"],
        });
    }
});

export type VoucherSchemaInput = z.input<typeof VoucherSchema>;
export type VoucherSchemaType = z.output<typeof VoucherSchema>;
