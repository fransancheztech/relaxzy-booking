'use client';

import { DialogForm } from '@/components/DialogForm';
import CalendarUI from './CalendarUI';
import { useBookingForm } from '@/hooks/useBookingForms';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import CloseIcon from '@mui/icons-material/Close';
import { BookingModel } from '@/types/bookings';
import { FORM_FIELDS_EDIT_BOOKING } from '@/constants';
import { FormFieldConfigModel } from '@/types/formFieldConfig';
import { useLayout } from '../context/LayoutContext';
import { useEffect, useState } from 'react';
import { useSimilarClients } from '@/hooks/useSimilarClients';
import { usePriceCalculator } from '@/hooks/usePriceCalculator';
import { Button } from '@mui/material';
import DialogDeletion from '@/components/DialogDeletion';
import AmountPaidInput from './AmountPaidInput';
import NewBookingDialogForm from '@/components/Dialogs/NewBooking/DialogForm';
import UpdateBookingDialogForm from '@/components/Dialogs/UpdateBooking/DialogForm';

export default function Bookings() {
    const { setButtonLabel, setOnButtonClick, selectedBookingId} = useLayout();

    const [isOpenDialogFormNewBooking, setIsOpenDialogFormNewBooking] = useState(false);
    const [isOpenDialogFormUpdateBooking, setIsOpenDialogFormUpdateBooking] = useState(false);

    const newBookingForm = useBookingForm({ mode: 'new' });

    const { clients, loading, error } = useSimilarClients({
        client_name: (newBookingForm.bookingFormData as BookingModel).client_name,
        client_surname: (newBookingForm.bookingFormData as BookingModel).client_surname,
        client_email: (newBookingForm.bookingFormData as BookingModel).client_email,
        client_phone: (newBookingForm.bookingFormData as BookingModel).client_phone
    });

    // Calculate price based on service_name and duration
    const { price } = usePriceCalculator(
        (newBookingForm.bookingFormData as BookingModel).service_name,
        (newBookingForm.bookingFormData as BookingModel).duration
    );

    // Auto-update price field when price is calculated
    useEffect(() => {
        if (price !== null && price !== undefined) {
            newBookingForm.setBookingFormData((prev) => ({
                ...prev,
                price: price
            }));
        }
    }, [price]);

    useEffect(() => {
        setButtonLabel('New Booking');
        setOnButtonClick(() => () => setIsOpenDialogFormNewBooking((prev) => !prev));
        return () => {
            setButtonLabel('');
            setOnButtonClick(null);
        };
    }, [setButtonLabel, setOnButtonClick, setIsOpenDialogFormNewBooking]);

    return (
        <main className='p-4'>
            <CalendarUI
                setIsOpenBookingDialog={setIsOpenDialogFormUpdateBooking}
            />
            <NewBookingDialogForm open={isOpenDialogFormNewBooking} onClose={() => setIsOpenDialogFormNewBooking(false)} />
            <UpdateBookingDialogForm open={isOpenDialogFormUpdateBooking} onClose={() => setIsOpenDialogFormUpdateBooking(false)} bookingId={selectedBookingId!} />
        </main>
    );
}
