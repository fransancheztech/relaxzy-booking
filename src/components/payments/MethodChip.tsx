"use client";

import { Chip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  CreditCard as CardIcon,
  LocalActivity as VoucherIcon,
  Payments as CashIcon,
} from "@mui/icons-material";
import { useTranslations } from "next-intl";
import { METHOD_COLORS, type MethodKind } from "./MethodAmountField";

const KIND: Record<string, MethodKind> = { cash: "cash", credit_card: "card", voucher: "voucher" };
const ICON: Record<MethodKind, typeof CashIcon> = { cash: CashIcon, card: CardIcon, voucher: VoucherIcon };

/**
 * A payment method in a list (payment events, refunds), in the method's colour and icon — the same
 * language as the payment fields and the calendar bar. Unknown or missing methods show "—".
 */
export default function MethodChip({ method }: { method: string | null | undefined }) {
  const t = useTranslations("PaymentMethod");
  const kind = method ? KIND[method] : undefined;
  if (!kind || !method) return <>—</>;
  const color = METHOD_COLORS[kind];
  const Icon = ICON[kind];
  return (
    <Chip
      size="small"
      variant="outlined"
      icon={<Icon sx={{ fontSize: 14, color: `${color} !important` }} />}
      label={t(method as "cash" | "credit_card" | "voucher")}
      sx={{
        height: 20,
        fontSize: "0.7rem",
        fontWeight: 600,
        color,
        borderColor: alpha(color, 0.6),
        bgcolor: alpha(color, 0.06),
      }}
    />
  );
}
