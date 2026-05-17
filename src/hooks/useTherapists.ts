import { useEffect, useState } from "react";

export type TherapistOption = { id: string; full_name: string; off_days?: number[] };

export function useTherapists(): TherapistOption[] {
  const [therapists, setTherapists] = useState<TherapistOption[]>([]);

  useEffect(() => {
    fetch("/api/therapists/active")
      .then((r) => r.json())
      .then((d) => setTherapists(d.therapists ?? []))
      .catch(() => {});
  }, []);

  return therapists;
}

export function useTherapistsWithLoaded(): {
  therapists: TherapistOption[];
  loaded: boolean;
} {
  const [therapists, setTherapists] = useState<TherapistOption[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/therapists/active")
      .then((r) => r.json())
      .then((d) => {
        setTherapists(d.therapists ?? []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  return { therapists, loaded };
}
