import { useEffect, useMemo, useState } from "react";
import debounce from "lodash.debounce";
import { ClientRow } from "./useSimilarClients";

export type FocusedClientField =
  | "client_name"
  | "client_surname"
  | "client_email"
  | "client_phone"
  | null;

type Params = {
  focusedField: FocusedClientField;
  name?: string;
  surname?: string;
  email?: string;
  phone?: string;
};

export function useClientSearch({ focusedField, name, surname, email, phone }: Params) {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(false);

  const debouncedFetch = useMemo(
    () =>
      debounce(
        async (payload: {
          field: Exclude<FocusedClientField, null>;
          value: string;
          others: {
            client_name?: string;
            client_surname?: string;
            client_email?: string;
            client_phone?: string;
          };
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
    if (!focusedField) {
      setClients([]);
      setLoading(false);
      debouncedFetch.cancel();
      return;
    }

    const valueByField: Record<Exclude<FocusedClientField, null>, string | undefined> = {
      client_name: name,
      client_surname: surname,
      client_email: email,
      client_phone: phone,
    };
    const value = (valueByField[focusedField] ?? "").trim();
    if (!value) {
      setClients([]);
      setLoading(false);
      debouncedFetch.cancel();
      return;
    }

    const others: Record<string, string | undefined> = { ...valueByField };
    delete others[focusedField];

    debouncedFetch({
      field: focusedField,
      value,
      others,
    });

    return () => debouncedFetch.cancel();
  }, [focusedField, name, surname, email, phone, debouncedFetch]);

  return { clients, loading, clear: () => setClients([]) };
}
