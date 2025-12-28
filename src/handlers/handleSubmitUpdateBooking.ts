import { BookingUpdateSchemaType } from "@/schemas/booking.schema";
import { toast } from "react-toastify";

const handleSubmitUpdateBooking = async (data: (BookingUpdateSchemaType & {id:string})) => {
    try {
        const start = new Date(data.start_time!);
        const end = data.duration
            ? new Date(start.getTime() + data.duration * 60 * 1000)
            : undefined;

        const res = await fetch(`/api/bookings/${data.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...data,
                end_time: end,
                updated_at: new Date(),
            }),
        });

        const result = await res.json();

        if (!res.ok) {
            toast.error(result?.error || 'Error editing booking');
            return;
        }
    }
    catch (err) {

    }
}

export default handleSubmitUpdateBooking