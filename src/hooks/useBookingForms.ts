import { useState } from 'react';
import { toast } from 'react-toastify';
import { BookingModel } from '@/types/bookings';

const initialStateBookingForm: BookingModel = {
    client_name: '',
    client_surname: '',
    client_phone: '',
    client_email: '',
    start_time: '',
    end_time: '',
    duration: '',
    service_name: '',
    notes: '',
    status: '',
    created_at: '',
    updated_at: '',
    price: ''
};

type BookingFormMode = 'new' | 'edit';

interface UseBookingFormOptions {
    mode?: BookingFormMode;
    initialData?: BookingModel | null;
}

export const useBookingForm = ({ mode = 'new', initialData }: UseBookingFormOptions = {}) => {
    const [isOpenBookingDialog, setIsOpenBookingDialog] = useState(false);
    const [bookingFormData, setBookingFormData] = useState<BookingModel>(initialData || initialStateBookingForm);

    const [isEditable, setIsEditable] = useState(mode === 'new');
    const toggleEditMode = () => setIsEditable((prev) => !prev);

    const handleAccept = async () => {
        try {
            const isEditing = mode === 'edit';
            const url = isEditing
                ? `/api/bookings/${bookingFormData.id}`
                : '/api/bookings/new';

            const method = isEditing ? 'PUT' : 'POST';

            // 🔥 PREPARAR EL PAYLOAD **ANTES** DE setState
            let payload: BookingModel = { ...bookingFormData };

            if (isEditing) {
                const start = new Date(bookingFormData.start_time!);
                const end = bookingFormData.duration
                    ? new Date(start.getTime() + parseInt(bookingFormData.duration) * 60 * 1000)
                    : undefined;

                payload = {
                    ...payload,
                    end_time: end ? end.toISOString() : '',
                    updated_at: new Date().toISOString(),
                };
            }

            // 🧪 Debug opcional
            console.log("PAYLOAD SENT:", payload);

            setIsOpenBookingDialog(false);
            setBookingFormData(initialStateBookingForm);

            // 🔥 ENVIAR EL PAYLOAD **CORRECTO**
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (!res.ok) {
                console.error(`Booking ${mode} error:`, data);
                toast.error(data?.error || `Error ${isEditing ? 'updating' : 'creating'} booking`);
                return;
            }

            toast.success(isEditing ? 'The booking has been updated successfully.' : 'The booking has been created successfully.');

            // Reset + close dialog
            setIsEditable(mode === 'new');

            // Refresh calendar
            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('refreshCalendarData'));
            }, 500);

        } catch (err) {
            console.error(`Network or server error ${mode} booking`, err);
            toast.error('Network or server error');
        }
    };

    const handleDelete = async () => {
        try {
            if (!bookingFormData.id) {
                toast.error('Missing booking ID');
                return;
            }

            setIsOpenBookingDialog(false);
            setBookingFormData(initialStateBookingForm);

            const res = await fetch(`/api/bookings/${bookingFormData.id}`, {
                method: 'DELETE'
            });

            const data = await res.json();

            if (!res.ok) {
                console.error('Booking delete error:', data);
                toast.error(data?.error || 'Error deleting booking');
                return;
            }

            toast.success('The booking has been deleted successfully.');

            setIsEditable(mode === 'new');

            setTimeout(() => {
                window.dispatchEvent(new CustomEvent('refreshCalendarData'));
            }, 500);

        } catch (err) {
            console.error('Network or server error deleting booking', err);
            toast.error('Network or server error');
        }
    };

    const handleCancel = () => {
        setIsOpenBookingDialog(false);
        setBookingFormData(initialStateBookingForm);
        setIsEditable(mode === 'new');
    };

    const isProtected = () => mode === 'edit';

    return {
        mode,
        isOpenBookingDialog,
        setIsOpenBookingDialog,
        bookingFormData,
        setBookingFormData,
        isEditable,
        setIsEditable,
        toggleEditMode,
        handleAccept,
        handleDelete,
        handleCancel,
        isProtected
    };
};
