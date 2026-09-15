export type DeleteBookingResult =
  | { status: "ok" }
  | { status: "completed" }
  | { status: "has_payments"; amount: number }
  | { status: "has_voucher_uses"; amount: number }
  | { status: "error" };

/**
 * Returns a result rather than toasting, so the caller can render the message in the user's own
 * language. The route used to return ready-made English sentences which were echoed straight into
 * a toast — the one place a Spanish receptionist was guaranteed to be shown English.
 */
const handleDeleteBooking = async (id: string): Promise<DeleteBookingResult> => {
  try {
    if (!id) return { status: "error" };

    const res = await fetch(`/api/bookings/${id}`, { method: "DELETE" });
    const result = await res.json().catch(() => ({}));

    if (!res.ok) {
      const amount = Number(result?.amount ?? 0);
      if (result?.error === "BOOKING_COMPLETED") return { status: "completed" };
      if (result?.error === "BOOKING_HAS_PAYMENTS") return { status: "has_payments", amount };
      if (result?.error === "BOOKING_HAS_VOUCHER_USES") return { status: "has_voucher_uses", amount };
      console.error("Booking delete error:", result);
      return { status: "error" };
    }

    return { status: "ok" };
  } catch (err) {
    console.error("Network or server error deleting booking", err);
    return { status: "error" };
  }
};

export default handleDeleteBooking;
