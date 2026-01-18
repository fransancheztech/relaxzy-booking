import { BookingSchemaType } from "@/schemas/booking.schema";
import { toast } from "react-toastify";

const handleSubmitCreateBooking = async (data: BookingSchemaType) => {
  try {
    const res = await fetch("/api/bookings/new", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await res.json();

    if (!res.ok) {
      toast.error(result?.error || `Error creating booking`);
      return;
    }

    toast.success("The booking has been created successfully.");

    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("refreshCalendarData"));
    }, 500);
  } catch (err) {
    console.error(`Network or server error creating booking`, err);
    toast.error("Network or server error creating booking");
  }
};

export default handleSubmitCreateBooking;
