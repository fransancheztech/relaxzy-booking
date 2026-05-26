import { BookingSchemaType } from "@/schemas/booking.schema";
import { toast } from "react-toastify";

type PaymentData = {
  cashPayment?: number;
  cardPayment?: number;
  voucherPayment?: number;
  voucherCode?: string;
};

const registerPaymentForBooking = async (bookingId: string, payment: PaymentData) => {
  try {
    const res = await fetch(`/api/bookings/${bookingId}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cashPayment: payment.cashPayment ?? 0,
        cardPayment: payment.cardPayment ?? 0,
        voucherPayment: payment.voucherPayment ?? 0,
        voucherCode: payment.voucherCode,
      }),
    });
    const result = await res.json();
    if (!res.ok) {
      toast.error(result?.error || "Error registering payment");
    }
  } catch (err) {
    console.error("Error registering payment", err);
    toast.error("Error registering payment");
  }
};

const hasPayment = (p: PaymentData) =>
  (p.cashPayment ?? 0) > 0 || (p.cardPayment ?? 0) > 0 || (p.voucherPayment ?? 0) > 0;

const handleSubmitCreateBooking = async (data: BookingSchemaType) => {
  try {
    // Strip payment fields before sending to booking creation API
    const {
      cashPayment,
      cardPayment,
      voucherPayment,
      voucherCode,
      companions,
      ...bookingData
    } = data;

    const strippedCompanions = companions?.map(
      ({ cashPayment: cp, cardPayment: ca, voucherPayment: vp, voucherCode: vc, ...rest }) => rest
    );

    const res = await fetch("/api/bookings/new", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...bookingData, companions: strippedCompanions }),
    });

    const result = await res.json();

    if (!res.ok) {
      toast.error(result?.error || `Error creating booking`);
      return;
    }

    toast.success("The booking has been created successfully.");

    // Register payments in parallel for those that have payment data
    const paymentTasks: Promise<void>[] = [];

    if (hasPayment({ cashPayment, cardPayment, voucherPayment })) {
      paymentTasks.push(
        registerPaymentForBooking(result.booking.id, { cashPayment, cardPayment, voucherPayment, voucherCode })
      );
    }

    companions?.forEach((companion, i) => {
      if (hasPayment(companion) && result.companionBookings?.[i]) {
        paymentTasks.push(
          registerPaymentForBooking(result.companionBookings[i].id, {
            cashPayment: companion.cashPayment,
            cardPayment: companion.cardPayment,
            voucherPayment: companion.voucherPayment,
            voucherCode: companion.voucherCode,
          })
        );
      }
    });

    await Promise.all(paymentTasks);

    // Explicit refresh needed here: payment writes don't touch the bookings table
    // so the SSE stream won't fire for them — calendar would show 0€ paid without this.
    window.dispatchEvent(new CustomEvent("refreshCalendarData"));
  } catch (err) {
    console.error(`Network or server error creating booking`, err);
    toast.error("Network or server error creating booking");
  }
};

export default handleSubmitCreateBooking;
