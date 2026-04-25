import { useEffect, useMemo, useState } from "react";
import debounce from "lodash.debounce";
import { ClientRow } from "./useSimilarClients";

type Params = {
  name?: string;
  surname?: string;
  email?: string;
  phone?: string;
};

export function useClientSearch({ name, surname, email, phone }: Params) {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(false);

  const debouncedFetch = useMemo(
    () =>
      debounce(
        async (payload: {
          client_name?: string;
          client_surname?: string;
          client_email?: string;
          client_phone?: string;
        }) => {
          try {
            setLoading(true);
            const res = await fetch("/api/clients/find-similar", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            setClients(res.ok ? await res.json() : []);
          } catch {
            setClients([]);
          } finally {
            setLoading(false);
          }
        },
        400,
      ),
    [],
  );

  useEffect(() => {
    if (!name && !surname && !email && !phone) {
      setClients([]);
      setLoading(false);
      return;
    }
    debouncedFetch({
      client_name: name,
      client_surname: surname,
      client_email: email,
      client_phone: phone,
    });
    return () => debouncedFetch.cancel();
  }, [name, surname, email, phone, debouncedFetch]);

  return { clients, loading, clear: () => setClients([]) };
}
