import { payment_methods } from "generated/prisma";
import { z } from "zod";

export const PaymentRefundSchema = z.object({
  amount: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? 0 : Number(v)),
    z
      .number({ message: "Payment in cash must be a number" })
      .positive({ message: "Payment in cash must be a positive number" })
  ),
  // amount: z
  //   .number("Amount is required")
  //   .positive("Refund amount must be greater than 0"),
  method: z.enum(payment_methods),
  notes: z.string().optional(),
});

export type PaymentRefundFormInput = z.input<typeof PaymentRefundSchema>;
export type PaymentRefundFormOutput = z.output<typeof PaymentRefundSchema>;
