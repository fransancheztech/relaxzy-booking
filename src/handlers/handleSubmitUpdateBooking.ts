import { BookingUpdateSchemaType } from "@/schemas/booking.schema";
import { toast } from "react-toastify";
import {
  CLIENT_CONTACT_TAKEN,
  CLIENT_NAME_CONFLICT,
  type BookingSubmitResult,
  type ClientResolution,
} from "@/types/clientConflict";

const handleSubmitUpdateBooking = async (
  data: BookingUpdateSchemaType & { id: string },
  clientResolution?: ClientResolution,
): Promise<BookingSubmitResult> => {
  try {
    const start = new Date(data.start_time!);
    const end = data.duration
      ? new Date(start.getTime() + data.duration * 60 * 1000)
      : undefined;

    const res = await fetch(`/api/bookings/${data.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        end_time: end,
        updated_at: new Date(),
        clientResolution,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      // Name conflicts and contact collisions are handled by the caller (dialog).
      if (res.status === 409 && result?.error === CLIENT_NAME_CONFLICT) {
        return { status: "conflict", conflicts: result.conflicts ?? [] };
      }
      if (res.status === 409 && result?.error === CLIENT_CONTACT_TAKEN) {
        return { status: "contact_taken" };
      }
      toast.error(result?.error || "Error editing booking");
      return { status: "error" };
    }

    toast.success("The booking has been updated successfully.");
    return { status: "ok" };
  } catch (err) {
    toast.error("Unexpected error while updating booking");
    return { status: "error" };
  }
};

export default handleSubmitUpdateBooking;
