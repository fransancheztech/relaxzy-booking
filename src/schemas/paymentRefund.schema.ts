import { payment_methods } from "generated/prisma";
import { z } from "zod";

const moneyPreprocess = (v: unknown) => {
  if (v === "" || v === null || v === undefined) return 0;

  if (typeof v === "string") {
    const normalized = v.replace(",", ".");
    const num = Number(normalized);
    return Number.isNaN(num) ? v : num;
  }

  return v;
};

const moneySchema = z
  .number({ message: "Payment must be a number" })
  .nonnegative({ message: "Payment must be a positive number" })
  .refine(
    (val) => Number.isInteger(Math.round(val * 100)),
    { message: "Max 2 decimal places allowed" }
  );

export const PaymentRefundSchema = z.object({
  amount: z.preprocess(
        moneyPreprocess,
        moneySchema
      ),
  method: z.enum(payment_methods),
  // Required: a refund moves real money back out and permanently reduces reported revenue,
  // so it must record why. The UI shows a localized message in place of this one.
  notes: z.string().trim().min(1, { message: "A reason for the refund is required" }),
});

export type PaymentRefundFormInput = z.input<typeof PaymentRefundSchema>;
export type PaymentRefundFormOutput = z.output<typeof PaymentRefundSchema>;
