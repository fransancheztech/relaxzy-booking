'use client';
import { createContext, useContext, useState, ReactNode, useMemo } from 'react';
import { LayoutContextType } from '@/types/layoutContextType';
import { BookingDTO } from '@/types/bookings';

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export function LayoutProvider({ children }: { children: ReactNode }) {
    const [buttonLabel, setButtonLabel] = useState('');
    const [onButtonClick, setOnButtonClick] = useState<(() => void) | null>(null);
    const [selectedBooking, setSelectedBooking] = useState<BookingDTO | null>(null);

    const value = useMemo(
        () => ({
            buttonLabel,
            setButtonLabel,
            onButtonClick,
            setOnButtonClick,
            selectedBooking,
            setSelectedBooking,
        }),
        [buttonLabel, onButtonClick, selectedBooking]
    );

    return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}

export function useLayout() {
    const ctx = useContext(LayoutContext);
    if (!ctx) throw new Error('useLayout debe usarse dentro de LayoutProvider');
    return ctx;
}
