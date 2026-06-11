import { useCallback, useEffect, useRef, useState } from "react";
import { Autocomplete, Box, CircularProgress, TextField, Tooltip, Typography } from "@mui/material";
import { Control, Controller, FieldValues, Path } from "react-hook-form";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatMoney } from "@/utils/formatMoney";
import { useTranslations } from "next-intl";

type VoucherOption = {
  id: string;
  code: string;
  balance: string | null;
  expiration_date: string | null;
  notes: string | null;
  source: string | null;
  external_reference: string | null;
  recipient_name: string | null;
  recipient_surname: string | null;
  recipient_phone: string | null;
  recipient_email: string | null;
  buyer_name: string | null;
  buyer_surname: string | null;
  buyer_phone: string | null;
  buyer_email: string | null;
};

function fullName(first: string | null, last: string | null): string {
  return [first, last].filter(Boolean).join(" ");
}

// Join a party's name + phone + email, dropping any that are absent.
function partyLine(
  first: string | null,
  last: string | null,
  phone: string | null,
  email: string | null,
): string {
  return [fullName(first, last), phone, email].filter(Boolean).join(" · ");
}

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
  const tv = useTranslations("Vouchers");
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

              const buyer = partyLine(option.buyer_name, option.buyer_surname, option.buyer_phone, option.buyer_email);
              const recipient = partyLine(option.recipient_name, option.recipient_surname, option.recipient_phone, option.recipient_email);
              const expires = option.expiration_date
                ? format(new Date(option.expiration_date), "dd/MM/yyyy", { locale: es })
                : null;
              const source = option.source
                ? tv(option.source === "online" ? "sourceOnline" : "sourcePhysical")
                : null;
              const externalRef = option.external_reference?.trim() || null;
              const notes = option.notes?.trim() || null;

              const hasInfo = !!(buyer || recipient || expires || source || externalRef || notes);
              const tooltip = (
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
                <Tooltip key={option.id} title={hasInfo ? tooltip : ""} placement="left" arrow>
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
                </Tooltip>
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
