"use client";

import {
  CreditCard as CardIcon,
  LocalActivity as VoucherIcon,
  Payments as CashIcon,
} from "@mui/icons-material";
import { InputAdornment, TextField } from "@mui/material";
import type { TextFieldProps } from "@mui/material";

export type MethodKind = "cash" | "card" | "voucher";

/**
 * Method palette uses literal hex values rather than the MUI palette slots —
 * the project's theme overrides `primary` and `secondary` to dark green, which
 * would collapse card/voucher into the same color family as cash. These vivid,
 * distinct tones keep the three methods visually unmistakable.
 */
export const METHOD_COLORS: Record<MethodKind, string> = {
  cash:    "#16a34a", // vivid green
  card:    "#2563eb", // vivid blue
  voucher: "#9333ea", // vivid purple
};

const STYLE: Record<MethodKind, { color: string; Icon: typeof CashIcon }> = {
  cash:    { color: METHOD_COLORS.cash,    Icon: CashIcon },
  card:    { color: METHOD_COLORS.card,    Icon: CardIcon },
  voucher: { color: METHOD_COLORS.voucher, Icon: VoucherIcon },
};

type Props = Omit<TextFieldProps, "color"> & { kind: MethodKind };

/**
 * Amount input branded for a payment method (cash / card / voucher).
 * Adds an icon adornment, colors the outline and label, and gives the focused
 * state a thicker outline — so the eye lands on the right field at a glance
 * instead of having to read a small label.
 */
export default function MethodAmountField({ kind, sx, slotProps, ...rest }: Props) {
  const { color, Icon } = STYLE[kind];
  return (
    <TextField
      {...rest}
      variant="outlined"
      sx={{
        "& .MuiOutlinedInput-notchedOutline": { borderColor: color },
        "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": { borderColor: color },
        "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
          borderColor: color,
          borderWidth: 2,
        },
        "& .MuiInputLabel-root": { color, fontWeight: 600 },
        "& .MuiInputLabel-root.Mui-focused": { color },
        ...sx,
      }}
      slotProps={{
        ...slotProps,
        input: {
          ...((slotProps?.input as Record<string, any> | undefined) ?? {}),
          startAdornment: (
            <InputAdornment position="start">
              <Icon sx={{ color, fontSize: 20 }} />
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
