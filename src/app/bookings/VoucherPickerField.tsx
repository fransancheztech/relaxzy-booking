import { useCallback, useEffect, useRef, useState } from "react";
import { Autocomplete, Box, CircularProgress, TextField, Typography } from "@mui/material";
import { Control, Controller, FieldValues, Path } from "react-hook-form";
import { formatMoney } from "@/utils/formatMoney";
import { useTranslations } from "next-intl";
import VoucherInfoTooltip, { type VoucherInfo } from "@/components/VoucherInfoTooltip";

type VoucherOption = VoucherInfo & {
  id: string;
  code: string;
  balance: string | null;
};

function getClientName(v: VoucherOption): string {
  const first = v.recipient_name ?? v.buyer_name;
  const last = v.recipient_surname ?? v.buyer_surname;
  return [first, last].filter(Boolean).join(" ");
}

type Props<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>;
  voucherCodeName: Path<TFieldValues>;
  remainingAmount: number;
  onSetVoucherPayment: (value: string) => void;
};

function VoucherPickerField<TFieldValues extends FieldValues>({
  control,
  voucherCodeName,
  remainingAmount,
  onSetVoucherPayment,
}: Props<TFieldValues>) {
  const t = useTranslations("BookingPayment");
  const [options, setOptions] = useState<VoucherOption[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchVouchers = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/vouchers/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setOptions(data.vouchers ?? []);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  useEffect(() => {
    fetchVouchers("");
  }, [fetchVouchers]);

  return (
    <Controller
      name={voucherCodeName}
      control={control}
      render={({ field, fieldState }) => {
        const selectedOption = options.find((o) => o.code === field.value) ?? null;

        return (
          <Autocomplete
            options={options}
            value={selectedOption}
            getOptionLabel={(o) => o.code}
            // Results are already filtered server-side (by code, name, phone, email,
            // notes, external ref). Disable MUI's local filter, which would otherwise
            // drop matches whose label (the code) doesn't contain the typed text.
            filterOptions={(x) => x}
            isOptionEqualToValue={(o, v) => o.code === v.code}
            loading={loading}
            clearOnBlur={false}
            // Keep the list anchored below the field: with the result cap removed the
            // popup can be tall, and Popper would otherwise flip it above the input.
            slotProps={{
              popper: {
                placement: "bottom-start",
                modifiers: [{ name: "flip", enabled: false }],
              },
            }}
            onInputChange={(_, value, reason) => {
              if (reason === "input") {
                fetchVouchers(value);
                field.onChange(value);
                if (!value) onSetVoucherPayment("0");
              } else if (reason === "clear") {
                fetchVouchers("");
                field.onChange("");
                onSetVoucherPayment("0");
              }
            }}
            onChange={(_, selected) => {
              if (!selected) {
                field.onChange("");
                onSetVoucherPayment("0");
              } else {
                field.onChange(selected.code);
                if (selected.balance != null) {
                  const auto = Math.min(Number(selected.balance), remainingAmount);
                  onSetVoucherPayment(auto > 0 ? String(auto) : "0");
                }
              }
            }}
            renderOption={(props, option) => {
              const name = getClientName(option);
              const balance = option.balance != null ? formatMoney(Number(option.balance)) : null;
              return (
                <VoucherInfoTooltip key={option.id} info={option}>
                  <Box component="li" {...props} key={option.id}>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>
                        {option.code}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {[balance, name].filter(Boolean).join(" · ")}
                      </Typography>
                    </Box>
                  </Box>
                </VoucherInfoTooltip>
              );
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                inputRef={field.ref}
                onBlur={field.onBlur}
                label={t("voucherCode")}
                size="small"
                fullWidth
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                slotProps={{
                  input: {
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loading && <CircularProgress size={16} />}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  },
                }}
              />
            )}
          />
        );
      }}
    />
  );
}

export default VoucherPickerField;
