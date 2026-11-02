"use client";

import { Alert, AlertTitle } from "@mui/material";
import { useTranslations } from "next-intl";
import type { ClientPreview } from "@/types/clientConflict";

/** The notes of the existing client the fields resolve to, if any. */
export function previewNotes(preview: ClientPreview | null): string | null {
  return preview?.kind === "existing" ? preview.client.notes : null;
}

/**
 * The client's notes in full, under the client fields of a booking or voucher, so reception sees
 * them every time the client is picked or recognised. Notes are rare (a handful of clients), so
 * the box appears only when there is something to read; nothing is shown otherwise.
 */
const ClientNotesAlert = ({ notes }: { notes: string | null | undefined }) => {
  const t = useTranslations("Common");
  const text = notes?.trim();
  if (!text) return null;
  return (
    <Alert severity="warning" sx={{ py: 0.5 }}>
      <AlertTitle sx={{ mb: 0.25, fontSize: "0.85rem" }}>{t("clientNotes")}</AlertTitle>
      <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{text}</span>
    </Alert>
  );
};

export default ClientNotesAlert;
