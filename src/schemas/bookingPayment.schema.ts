// schemas/bookingPayment.schema.ts
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

export const BookingPaymentSchema = z
  .object({
    paidCash: z.number(),
    paidCard: z.number(),
    cashPayment: z.preprocess(
      moneyPreprocess,
      moneySchema
    ),
    cardPayment: z.preprocess(
      moneyPreprocess,
      moneySchema
    ),
    price: z.number().nonnegative().optional(),
  })
  .superRefine((data, ctx) => {
    const totalPayment = data.cashPayment + data.cardPayment;
    const totalPaid = data.paidCash + data.paidCard;

    if (totalPayment <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "You must register at least one payment",
        path: ["payment_form"],
      });
    }

    if (data.price !== undefined && totalPayment > data.price - totalPaid) {
      ctx.addIssue({
        code: "custom",
        message: "The payment exceeds the booking price",
        path: ["payment_form"],
      });
    }
  });

export type BookingPaymentFormInput = z.input<typeof BookingPaymentSchema>;

export type BookingPaymentFormOutput = z.output<typeof BookingPaymentSchema>;
