"use client";

import { Box, FormHelperText, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  CreditCard as CardIcon,
  LocalActivity as VoucherIcon,
  Payments as CashIcon,
} from "@mui/icons-material";
import { useTranslations } from "next-intl";
import { METHOD_COLORS, type MethodKind } from "./MethodAmountField";

/** Payment methods as stored in the database. */
export type StoredMethod = "cash" | "credit_card" | "voucher";

const KIND: Record<StoredMethod, MethodKind> = { cash: "cash", credit_card: "card", voucher: "voucher" };
const ICON: Record<MethodKind, typeof CashIcon> = { cash: CashIcon, card: CardIcon, voucher: VoucherIcon };

type Props = {
  value: StoredMethod | "" | null | undefined;
  onChange: (method: StoredMethod) => void;
  /** Which methods to offer, in order. Default: cash and card. */
  methods?: StoredMethod[];
  label?: string;
  error?: string;
  disabled?: boolean;
};

/**
 * Big Cash / Card (/ Voucher) buttons in the method colours, replacing a dropdown. A method is
 * picked by tapping it — the colour fills in — so it can't be left on a value nobody looked at:
 * receptionists kept recording cash as card and vice versa when the choice was a small dropdown,
 * sometimes pre-set to the wrong method. Pass no value to force a choice.
 */
export default function MethodPicker({ value, onChange, methods = ["cash", "credit_card"], label, error, disabled }: Props) {
  const t = useTranslations("PaymentMethod");
  return (
    <Box>
      {label && (
        <Typography variant="caption" color={error ? "error" : "text.secondary"} component="div" sx={{ mb: 0.5 }}>
          {label}
        </Typography>
      )}
      <ToggleButtonGroup
        exclusive
        size="small"
        value={value || null}
        disabled={disabled}
        onChange={(_, v: StoredMethod | null) => { if (v) onChange(v); }}
        sx={{ display: "flex", gap: 1, "& .MuiToggleButtonGroup-grouped": { border: 0, borderRadius: "6px !important", m: 0 } }}
      >
        {methods.map((m) => {
          const color = METHOD_COLORS[KIND[m]];
          const Icon = ICON[KIND[m]];
          return (
            <ToggleButton
              key={m}
              value={m}
              sx={{
                flex: 1,
                gap: 0.75,
                textTransform: "none",
                fontWeight: 600,
                color,
                outline: `1.5px solid ${alpha(color, 0.6)}`,
                "&:hover": { bgcolor: alpha(color, 0.08) },
                "&.Mui-selected, &.Mui-selected:hover": { bgcolor: color, color: "#fff", outlineColor: color },
              }}
            >
              <Icon fontSize="small" />
              {t(m)}
            </ToggleButton>
          );
        })}
      </ToggleButtonGroup>
      {error && <FormHelperText error>{error}</FormHelperText>}
    </Box>
  );
}
