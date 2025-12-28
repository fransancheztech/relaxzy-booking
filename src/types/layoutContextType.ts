import { BookingDTO, BookingEventModel } from './bookings';

export type LayoutContextType = {
    buttonLabel: string;
    setButtonLabel: (label: string) => void;
    onButtonClick: (() => void) | null;
    setOnButtonClick: (fn: (() => void) | null) => void;
    selectedBookingId: string | null;
    setSelectedBookingId: (bookingId: string | null) => void;
};
