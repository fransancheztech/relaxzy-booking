// handlers/handleSubmitPayBooking.ts
import { BookingPaymentFormOutput } from "@/schemas/bookingPayment.schema";

export type PayBookingResult =
  | { status: "ok" }
  | { status: "error"; code?: string };

/**
 * Registers a booking payment. Deliberately does NOT toast: the route answers with a
 * stable error code (see src/lib/payments/paymentErrors.ts) and only a component can
 * translate it, so the caller owns the message.
 */
const handleSubmitPayBooking = async (
  data: BookingPaymentFormOutput & { id: string; paymentDate?: string }
): Promise<PayBookingResult> => {
  try {
    const res = await fetch(`/api/bookings/${data.id}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cashPayment: data.cashPayment,
        cardPayment: data.cardPayment,
        voucherPayment: data.voucherPayment,
        voucherCode: data.voucherCode,
        paymentDate: data.paymentDate,
      }),
    });

    const result = await res.json().catch(() => ({}));

    if (!res.ok) return { status: "error", code: result?.error };
    return { status: "ok" };
  } catch (error) {
    console.error("Error registering payment", error);
    return { status: "error" };
  }
};

export default handleSubmitPayBooking;
