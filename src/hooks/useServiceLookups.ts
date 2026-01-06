// src/hooks/useServiceLookups.ts
import { useState, useEffect } from 'react';
import { services } from 'generated/prisma';

export const useServiceLookups = () => {
  const [availableServices, setAvailableServices] = useState<string[]>([]);
  const [availableDurations, setAvailableDurations] = useState<string[]>([]);

  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const res = await fetch('/api/services');
        if (!res.ok) throw new Error(res.statusText);

        const data = await res.json();

        const uniqueServices = [
          ...new Set(data.map((s: services) => String(s.name))),
        ].filter(Boolean) as string[];

        const uniqueDurations = [
          ...new Set(data.map((s: services) => String(s.duration ?? ''))),
        ].filter(Boolean) as string[];

        setAvailableServices(uniqueServices);
        setAvailableDurations(uniqueDurations);
      } catch (err) {
        console.error('Lookup fetch error', err);
      }
    };

    fetchLookups();
  }, []);

  return { availableServices, availableDurations };
};
