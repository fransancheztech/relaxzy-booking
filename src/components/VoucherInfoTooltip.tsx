"use client";

import { ReactElement } from "react";
import { Box, Tooltip } from "@mui/material";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useTranslations } from "next-intl";

export type VoucherInfo = {
  buyer_name?: string | null;
  buyer_surname?: string | null;
  buyer_phone?: string | null;
  buyer_email?: string | null;
  recipient_name?: string | null;
  recipient_surname?: string | null;
  recipient_phone?: string | null;
  recipient_email?: string | null;
  expiration_date?: string | null;
  source?: string | null;
  external_reference?: string | null;
  notes?: string | null;
};

function fullName(first?: string | null, last?: string | null): string {
  return [first, last].filter(Boolean).join(" ");
}

// Join a party's name + phone + email, dropping any that are absent.
function partyLine(
  first?: string | null,
  last?: string | null,
  phone?: string | null,
  email?: string | null,
): string {
  return [fullName(first, last), phone, email].filter(Boolean).join(" · ");
}

type Props = {
  info: VoucherInfo;
  children: ReactElement;
  placement?: "top" | "bottom" | "left" | "right";
};

// Wraps `children` in a hover tooltip listing the voucher's buyer, recipient, expiry,
// source, external reference and notes — the shared format used by the voucher finder
// and the Manage Payments dialog. Renders children untouched when there's nothing to show.
export default function VoucherInfoTooltip({ info, children, placement = "left" }: Props) {
  const tv = useTranslations("Vouchers");

  const buyer = partyLine(info.buyer_name, info.buyer_surname, info.buyer_phone, info.buyer_email);
  const recipient = partyLine(info.recipient_name, info.recipient_surname, info.recipient_phone, info.recipient_email);
  const expires = info.expiration_date
    ? format(new Date(info.expiration_date), "dd/MM/yyyy", { locale: es })
    : null;
  const source = info.source
    ? tv(info.source === "online" ? "sourceOnline" : "sourcePhysical")
    : null;
  const externalRef = info.external_reference?.trim() || null;
  const notes = info.notes?.trim() || null;

  const hasInfo = !!(buyer || recipient || expires || source || externalRef || notes);
  if (!hasInfo) return children;

  const content = (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
      {buyer && <span>{tv("buyer")}: {buyer}</span>}
      {recipient && <span>{tv("recipient")}: {recipient}</span>}
      {expires && <span>{tv("expires")}: {expires}</span>}
      {source && <span>{tv("source")}: {source}</span>}
      {externalRef && <span>{tv("externalReference")}: {externalRef}</span>}
      {notes && <span>{tv("notes")}: {notes}</span>}
    </Box>
  );

  return (
    <Tooltip title={content} placement={placement} arrow>
      {children}
    </Tooltip>
  );
}
