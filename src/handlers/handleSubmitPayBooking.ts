// handlers/handleSubmitPayBooking.ts
import { BookingPaymentFormOutput } from "@/schemas/bookingPayment.schema";
import { toast } from "react-toastify";

const handleSubmitPayBooking = async (
  data: BookingPaymentFormOutput & { id: string }
) => {
  try {
    const res = await fetch(`/api/bookings/${data.id}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cashPayment: data.cashPayment,
        cardPayment: data.cardPayment,
        voucherPayment: data.voucherPayment,
        voucherCode: data.voucherCode,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      toast.error(result?.error || "Error registering payment");
      return;
    }

    toast.success("Payment registered successfully.");
    return true;
  } catch (error) {
    toast.error(`Unexpected error while registering payment: ${error}`);
    return false;
  }
};

export default handleSubmitPayBooking;
