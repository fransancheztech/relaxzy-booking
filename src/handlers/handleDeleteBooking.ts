import { toast } from "react-toastify";

const handleDeleteBooking = async (id: string) => {
    try {
        if (!id) {
            toast.error('Missing booking ID');
            return;
        }
        const res = await fetch(`/api/bookings/${id}`, {
            method: 'DELETE'
        });
        const result = await res.json();
        if (!res.ok) {
            console.error('Booking delete error:', result);
            toast.error(result?.error || 'Error deleting booking');
            return;
        }
        toast.success('The booking has been deleted successfully.');
        setTimeout(() => {
            window.dispatchEvent(new CustomEvent('refreshCalendarData'));
        }, 500);

    } catch (err) {
        console.error('Network or server error deleting booking', err);
        toast.error('Network or server error');
    }
};

export default handleDeleteBooking