'use client';
import { createContext, useContext, useState, ReactNode, useMemo } from 'react';
import { LayoutContextType } from '@/types/layoutContextType';

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export function LayoutProvider({ children }: { children: ReactNode }) {
    const [buttonLabel, setButtonLabel] = useState('');
    const [onButtonClick, setOnButtonClick] = useState<(() => void) | null>(null);
    const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);


    const value = useMemo(
        () => ({
            buttonLabel,
            setButtonLabel,
            onButtonClick,
            setOnButtonClick,
            selectedBookingId,
            setSelectedBookingId,
        }),
        [buttonLabel, onButtonClick, selectedBookingId]
    );

    return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
}

export function useLayout() {
    const ctx = useContext(LayoutContext);
    if (!ctx) throw new Error('useLayout debe usarse dentro de LayoutProvider');
    return ctx;
}
