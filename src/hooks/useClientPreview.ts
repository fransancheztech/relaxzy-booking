import { useEffect, useState } from "react";
import type { ClientPreview } from "@/types/clientConflict";
import { phoneValidator } from "@/utils/phoneValidator";
import { isPlaceholderClientName } from "@/utils/placeholderName";

type Params = {
  name?: string;
  surname?: string;
  phone?: string;
  email?: string;
  pickedId?: string;
  /** False hides the hint (read-only form, anonymous booking, …). */
  enabled?: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Live answer to "what will Save do with these client fields?": reuse an existing client, fill in
 * its missing phone/email, ask, or create a new client. Asks the server, which runs the same code
 * the save uses. Null while there's nothing meaningful to say (empty or invalid fields).
 */
export function useClientPreview({ name, surname, phone, email, pickedId, enabled = true }: Params) {
  const [preview, setPreview] = useState<ClientPreview | null>(null);

  useEffect(() => {
    const n = name?.trim() ?? "";
    const s = surname?.trim() ?? "";
    const p = phone?.trim() ?? "";
    const e = email?.trim() ?? "";
    const meaningful =
      enabled &&
      (n || s || p || e) &&
      (!p || phoneValidator(p)) &&
      (!e || EMAIL_RE.test(e)) &&
      !isPlaceholderClientName(n);
    if (!meaningful) {
      setPreview(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/clients/resolve-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_name: n,
            client_surname: s,
            client_phone: p,
            client_email: e,
            client_picked_id: pickedId || undefined,
          }),
          signal: controller.signal,
        });
        if (res.ok) setPreview(await res.json());
      } catch {
        // Aborted by a newer keystroke, or offline: keep the previous hint.
      }
    }, 450);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [name, surname, phone, email, pickedId, enabled]);

  return preview;
}
