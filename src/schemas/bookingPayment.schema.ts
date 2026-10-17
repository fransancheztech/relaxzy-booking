// schemas/bookingPayment.schema.ts
import { z } from "zod";

// Messages are stable CODES, not sentences: the dialog maps them through
// paymentErrorText() to BookingPayment.errors.<code> so the receptionist reads them in
// her own language. See src/lib/payments/paymentErrors.ts.

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
  .number({ message: "PAYMENT_NOT_A_NUMBER" })
  .nonnegative({ message: "PAYMENT_NEGATIVE" })
  .refine(
    (val) => Number.isInteger(Math.round(val * 100)),
    { message: "PAYMENT_MAX_2_DECIMALS" }
  );

export const BookingPaymentSchema = z
  .object({
    paidCash: z.number(),
    paidCard: z.number(),
    cashPayment: z.preprocess(moneyPreprocess, moneySchema),
    cardPayment: z.preprocess(moneyPreprocess, moneySchema),
    voucherPayment: z.preprocess(moneyPreprocess, moneySchema),
    voucherCode: z
      .string()
      .optional()
      .refine(
        (val) => !val?.trim() || /^V-\d{6}-\d+$/i.test(val.trim()),
        { message: "VOUCHER_CODE_FORMAT" }
      ),
    price: z.number().nonnegative().optional(),
  })
  .superRefine((data, ctx) => {
    const totalPayment = data.cashPayment + data.cardPayment + data.voucherPayment;
    const totalPaid = data.paidCash + data.paidCard;

    if (totalPayment <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "NO_PAYMENT_ENTERED",
        path: ["payment_form"],
      });
    }

    if (data.price !== undefined && totalPayment > data.price - totalPaid) {
      ctx.addIssue({
        code: "custom",
        message: "EXCEEDS_PRICE",
        path: ["payment_form"],
      });
    }

    if (data.voucherPayment > 0 && !data.voucherCode?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "VOUCHER_CODE_REQUIRED",
        path: ["voucherCode"],
      });
    }
  });

export type BookingPaymentFormInput = z.input<typeof BookingPaymentSchema>;

export type BookingPaymentFormOutput = z.output<typeof BookingPaymentSchema>;
