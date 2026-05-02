// src/hooks/useServiceLookups.ts
import { useState, useEffect, useCallback } from "react";

interface ServiceDuration {
  service_details_id: string;
  duration_id: string;
  duration_minutes: number;
  duration_notes?: string | null;
  price: number;
  notes?: string | null;
}

interface ServiceItem {
  id: string;
  name: string;
  short_name?: string | null;
  notes?: string | null;
  durations: ServiceDuration[];
}

export const useServiceLookups = () => {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [availableServices, setAvailableServices] = useState<string[]>([]);
  const [availableDurations, setAvailableDurations] = useState<string[]>([]);

  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const res = await fetch("/api/services");
        if (!res.ok) throw new Error(res.statusText);

        const data: ServiceItem[] = await res.json();
        setServices(data);

        const uniqueServices = [
          ...new Set(data.map((s) => s.name).filter(Boolean)),
        ];

        const allDurations = data.flatMap((s) =>
          s.durations.map((d) => String(d.duration_minutes))
        );

        const uniqueDurations = [...new Set(allDurations)].filter(Boolean);

        setAvailableServices(uniqueServices);
        setAvailableDurations(uniqueDurations);
      } catch (err) {
        console.error("Lookup fetch error", err);
      }
    };

    fetchLookups();
  }, []);

  const lookupPrice = useCallback(
    (serviceName: string, durationMinutes: number): number | undefined =>
      services
        .find((s) => s.name === serviceName)
        ?.durations.find((d) => d.duration_minutes === durationMinutes)?.price,
    [services]
  );

  const lookupDuration = useCallback(
    (serviceName: string, price: number): number | undefined =>
      services
        .find((s) => s.name === serviceName)
        ?.durations.find((d) => d.price === price)?.duration_minutes,
    [services]
  );

  return { availableServices, availableDurations, lookupPrice, lookupDuration };
};
