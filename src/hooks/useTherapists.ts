import { useEffect, useState } from "react";

export type TherapistOption = { id: string; full_name: string };

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
