import { z } from "zod";

const amountPreprocess = (v: unknown) => {
  if (v === "" || v === null || v === undefined) return NaN;
  if (typeof v === "string") {
    const normalized = v.replace(",", ".");
    return Number(normalized);
  }
  return v;
};

export const TipSchema = z.object({
  therapist_id: z.string().min(1, "Therapist is required"),
  amount: z.preprocess(
    amountPreprocess,
    z
      .number({ message: "Amount must be a number" })
      .positive({ message: "Amount must be positive" })
  ),
  payment_method: z.enum(["cash", "credit_card", "voucher"]),
  iva_applies: z.boolean(),
  notes: z.string().optional(),
});

export type TipFormInput = z.input<typeof TipSchema>;
export type TipFormOutput = z.output<typeof TipSchema>;
