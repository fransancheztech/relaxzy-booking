// src/hooks/useServiceLookups.ts
import { useState, useEffect } from "react";

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
  const [availableServices, setAvailableServices] = useState<string[]>([]);
  const [availableDurations, setAvailableDurations] = useState<string[]>([]);

  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const res = await fetch("/api/services");
        if (!res.ok) throw new Error(res.statusText);

        const data: ServiceItem[] = await res.json();

        // Extract unique service names
        const uniqueServices = [
          ...new Set(data.map((s) => s.name).filter(Boolean)),
        ];

        // Extract all durations across all services
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

  return { availableServices, availableDurations };
};
