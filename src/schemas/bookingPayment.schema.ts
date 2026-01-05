// schemas/bookingPayment.schema.ts
import { z } from "zod";

export const BookingPaymentSchema = z
  .object({
    paidCash: z.number(),
    paidCard: z.number(),

    cashPayment: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? 0 : Number(v)),
      z.number({message: "Payment in cash must be a number"})
        .nonnegative({ message: "Payment in cash must be a positive number" })
    ),

    cardPayment: z.preprocess(
      (v) => (v === "" || v === null || v === undefined ? 0 : Number(v)),
      z.number({message: "Payment in credit card must be a number"})
        .nonnegative({ message: "Payment in credit card must be a positive number" })
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
        path: ["form"],
      });
    }

    if (data.price === undefined || totalPayment > data.price - totalPaid) {
      ctx.addIssue({
        code: "custom",
        message: "The payment exceeds the booking price",
        path: ["form"],
      });
    }
  });


export type BookingPaymentFormInput =
  z.input<typeof BookingPaymentSchema>;

export type BookingPaymentFormOutput =
  z.output<typeof BookingPaymentSchema>;

