'use client';

import dynamic from "next/dynamic";
import { useLayout } from '../context/LayoutContext';
import { useEffect, useState } from 'react';
import NewBookingDialogForm from '@/components/Dialogs/NewBooking/DialogForm';
import UpdateBookingDialogForm from '@/components/Dialogs/UpdateBooking/DialogForm';

const CalendarUI = dynamic(
  () => import("./CalendarUI"),
  { ssr: false }
);

export default function CalendarPage() {
    const { setButtonLabel, setOnButtonClick, selectedBookingId} = useLayout();

    const [isOpenDialogFormNewBooking, setIsOpenDialogFormNewBooking] = useState(false);
    const [isOpenDialogFormUpdateBooking, setIsOpenDialogFormUpdateBooking] = useState(false);

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