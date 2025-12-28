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
import NewBookingDialogForm from '@/components/Dialogs/NewBookingDialogForm';

export default function Bookings() {
    const { setButtonLabel, setOnButtonClick, selectedBooking} = useLayout();
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

    const [isOpenDialogFormNewBooking, setIsOpenDialogFormNewBooking] = useState(false);

    const newBookingForm = useBookingForm({ mode: 'new' });
    const editBookingForm = useBookingForm({ mode: 'edit', initialData: selectedBooking });

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
                setBookingFormData={editBookingForm.setBookingFormData}
                setIsOpenBookingDialog={editBookingForm.setIsOpenBookingDialog}
                setIsEditable={editBookingForm.setIsEditable}
            />
            <NewBookingDialogForm open={isOpenDialogFormNewBooking} onClose={() => setIsOpenDialogFormNewBooking(false)} />
            <DialogForm<BookingModel>
                open={editBookingForm.isOpenBookingDialog}
                title='Booking Details'
                formFields={FORM_FIELDS_EDIT_BOOKING as FormFieldConfigModel<BookingModel>[]}
                formData={editBookingForm.bookingFormData}
                setFormData={editBookingForm.setBookingFormData}
                handleCancel={editBookingForm.handleCancel}
                moreInputs={[
                    <AmountPaidInput
                        moneyType="paidCard"
                        value={editBookingForm.bookingFormData.paidCard}
                        setFormData={editBookingForm.setBookingFormData}
                    />,
                    <AmountPaidInput
                        moneyType="paidCash"
                        value={editBookingForm.bookingFormData.paidCash}
                        setFormData={editBookingForm.setBookingFormData}
                    />
                ]}
                deleteButton={
                    <Button
                        color='error'
                        sx={{
                            gap: 1
                        }}
                        variant='contained'
                        onClick={() => setConfirmDeleteOpen(true)}>
                        <>
                            <DeleteIcon />
                            Delete
                        </>
                    </Button>
                }
                cancelButton={
                    <Button
                        sx={{ color: 'primary.main', gap: 1 }}
                        onClick={() => {
                            editBookingForm.handleCancel();
                        }}>
                        {
                            <>
                                <CloseIcon />
                                Close
                            </>
                        }
                    </Button>
                }
                acceptButton={
                    <Button
                        sx={{ color: 'primary.main', gap: 1 }}
                        onClick={() => {
                            editBookingForm.handleAccept();
                        }}>
                        {
                            <>
                                <SaveIcon />
                                Save
                            </>
                        }
                    </Button>
                }
            />
            <DialogDeletion
                confirmDeleteOpen={confirmDeleteOpen}
                setConfirmDeleteOpen={setConfirmDeleteOpen}
                handleDelete={editBookingForm.handleDelete}
            />
        </main>
    );
}
