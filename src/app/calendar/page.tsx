'use client';

import dynamic from "next/dynamic";
import { useLayout } from '../context/LayoutContext';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import NewBookingDialogForm from '@/app/bookings/NewBookingDialogForm';
import UpdateBookingDialogForm from '@/app/bookings/UpdateBookingDialogForm';
import { defaultStartFromCalendarRange } from '@/lib/bookings/defaultStart';

const CalendarUI = dynamic(
  () => import("./CalendarUI"),
  { ssr: false }
);

type NewBookingDefaults = { start?: Date; therapistId?: string };

export default function CalendarPage() {
    const { setButtonLabel, setOnButtonClick, selectedBookingId} = useLayout();
    const t = useTranslations('Bookings');

    const [isOpenDialogFormNewBooking, setIsOpenDialogFormNewBooking] = useState(false);
    const [isOpenDialogFormUpdateBooking, setIsOpenDialogFormUpdateBooking] = useState(false);
    const [newBookingDefaults, setNewBookingDefaults] = useState<NewBookingDefaults>({});

    // The range on screen, read when the button is pressed (a ref, so the button handler
    // registered once in the layout always sees the latest view).
    const rangeRef = useRef<{ start: Date; end: Date } | null>(null);
    const handleRangeChange = useCallback((range: { start: Date; end: Date }) => {
        rangeRef.current = range;
    }, []);

    // A clicked empty slot opens New Booking at that exact time, in that therapist's column.
    const handleSlotClick = useCallback((start: Date, therapistId?: string) => {
        setNewBookingDefaults({ start, therapistId });
        setIsOpenDialogFormNewBooking(true);
    }, []);

    useEffect(() => {
        setButtonLabel(t('newBooking'));
        setOnButtonClick(() => () => {
            setNewBookingDefaults({ start: defaultStartFromCalendarRange(rangeRef.current) });
            setIsOpenDialogFormNewBooking((prev) => !prev);
        });
        return () => {
            setButtonLabel('');
            setOnButtonClick(null);
        };
    }, [setButtonLabel, setOnButtonClick, setIsOpenDialogFormNewBooking, t]);

    return (
        <main className='p-4'>
            <CalendarUI
                setIsOpenBookingDialog={setIsOpenDialogFormUpdateBooking}
                onRangeChange={handleRangeChange}
                onSlotClick={handleSlotClick}
            />
            <NewBookingDialogForm
                open={isOpenDialogFormNewBooking}
                onClose={() => setIsOpenDialogFormNewBooking(false)}
                defaultStart={newBookingDefaults.start}
                defaultTherapistId={newBookingDefaults.therapistId}
            />
            <UpdateBookingDialogForm open={isOpenDialogFormUpdateBooking} onClose={() => setIsOpenDialogFormUpdateBooking(false)} bookingId={selectedBookingId!} />
        </main>
    );
}
