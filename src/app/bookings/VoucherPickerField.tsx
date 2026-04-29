import { useCallback, useEffect, useRef, useState } from "react";
import { Autocomplete, Box, CircularProgress, TextField, Typography } from "@mui/material";
import { Control, Controller, UseFormSetValue } from "react-hook-form";
import { BookingPaymentFormInput } from "@/schemas/bookingPayment.schema";
import { formatMoney } from "@/utils/formatMoney";

type VoucherOption = {
  id: string;
  code: string;
  balance: string | null;
  recipient_name: string | null;
  recipient_surname: string | null;
  buyer_name: string | null;
  buyer_surname: string | null;
};

function getClientName(v: VoucherOption): string {
  const first = v.recipient_name ?? v.buyer_name;
  const last = v.recipient_surname ?? v.buyer_surname;
  return [first, last].filter(Boolean).join(" ");
}

type Props = {
  control: Control<BookingPaymentFormInput>;
  setValue: UseFormSetValue<BookingPaymentFormInput>;
  remainingAmount: number;
};

const VoucherPickerField = ({ control, setValue, remainingAmount }: Props) => {
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
      name="voucherCode"
      control={control}
      render={({ field, fieldState }) => {
        const selectedOption = options.find((o) => o.code === field.value) ?? null;

        return (
          <Autocomplete
            options={options}
            value={selectedOption}
            getOptionLabel={(o) => o.code}
            isOptionEqualToValue={(o, v) => o.code === v.code}
            loading={loading}
            clearOnBlur={false}
            disablePortal
            onInputChange={(_, value, reason) => {
              if (reason === "input") {
                fetchVouchers(value);
                field.onChange(value);
                if (!value) (setValue as any)("voucherPayment", "0");
              } else if (reason === "clear") {
                fetchVouchers("");
                field.onChange("");
                (setValue as any)("voucherPayment", "0");
              }
            }}
            onChange={(_, selected) => {
              if (!selected) {
                field.onChange("");
                (setValue as any)("voucherPayment", "0");
              } else {
                field.onChange(selected.code);
                if (selected.balance != null) {
                  const auto = Math.min(Number(selected.balance), remainingAmount);
                  (setValue as any)("voucherPayment", auto > 0 ? String(auto) : "0");
                }
              }
            }}
            renderOption={(props, option) => {
              const name = getClientName(option);
              const balance = option.balance != null ? formatMoney(Number(option.balance)) : null;
              return (
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
              );
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                inputRef={field.ref}
                onBlur={field.onBlur}
                label="Voucher Code"
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
};

export default VoucherPickerField;
