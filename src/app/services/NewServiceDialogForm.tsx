"use client";

import {
  Alert,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  TextField,
  Typography,
} from "@mui/material";
import {
  Controller,
  FormProvider,
  useFieldArray,
  useForm,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import CloseIcon from "@mui/icons-material/Close";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  BaseServiceSchema,
  BaseServiceSchemaType,
  BaseServiceSchemaTypeInput,
  BaseServiceSchemaTypeOutput,
} from "@/schemas/service.schema";
import handleSubmitCreateService from "@/handlers/handleSubmitCreateService";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";

type Props = {
  open: boolean;
  onClose: () => void;
};

const defaultValues: BaseServiceSchemaType = {
  name: "",
  short_name: "",
  notes: "",
  duration_prices: [{ duration: 60, price: 0 }], // sensible default
};

const NewServiceDialogForm = ({ open, onClose }: Props) => {
  const t = useTranslations("Services");
  const tCommon = useTranslations("Common");

  const methods = useForm<
    BaseServiceSchemaTypeInput,
    any,
    BaseServiceSchemaTypeOutput
  >({
    resolver: zodResolver(BaseServiceSchema),
    defaultValues,
  });

  const { control, formState, reset, handleSubmit } = methods;
  const { submitting, guard } = useSubmitGuard();

  const { fields, append, remove } = useFieldArray({
    control,
    name: "duration_prices",
  });

  const addDuration = () => {
    const durations = methods
      .getValues("duration_prices")
      .map((d) => d.duration);

    let next = 30;
    while (durations.includes(next)) next += 30;

    append({ duration: next, price: 0 });
  };

  const onSubmit = (data: BaseServiceSchemaType) =>
    guard(async () => {
      data.duration_prices.sort((a, b) => a.duration - b.duration);
      await handleSubmitCreateService(data);
      reset(defaultValues);
      onClose();
    });

  const onCancel = () => {
    reset(defaultValues);
    onClose();
  };

  useEffect(() => {
    if (open) reset(defaultValues);
  }, [open]);

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{t("addService")}</DialogTitle>
      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <DialogContent>
            <Grid
              container
              sx={{ paddingTop: "1rem" }}
              spacing={{ xs: 1, xl: 2 }}
            >
              <Grid size={12}>
                <Controller
                  name="name"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label={t("serviceNameLabel")}
                      fullWidth
                      size="small"
                      error={!!formState.errors.name}
                      helperText={formState.errors.name?.message}
                    />
                  )}
                />
              </Grid>

              <Grid size={12}>
                <Controller
                  name="short_name"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label={t("shortNameLabel")}
                      fullWidth
                      size="small"
                      error={!!formState.errors.short_name}
                      helperText={formState.errors.short_name?.message}
                    />
                  )}
                />
              </Grid>

              <Grid size={12}>
                <Controller
                  name="notes"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label={tCommon("notes")}
                      fullWidth
                      multiline
                      rows={3}
                      size="small"
                      error={!!formState.errors.notes}
                      helperText={formState.errors.notes?.message}
                    />
                  )}
                />
              </Grid>
              <Grid size={12}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  {t("durationsAndPrices")}
                </Typography>
              </Grid>
              {fields.map((field, index) => (
                <Grid container spacing={1} key={field.id}>
                  <Grid size={5}>
                    <Controller
                      name={`duration_prices.${index}.duration`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          value={field.value === 0 ? "" : field.value}
                          label={tCommon("minutes")}
                          type="number"
                          size="small"
                          fullWidth
                          error={
                            !!formState.errors.duration_prices?.[index]
                              ?.duration
                          }
                          helperText={
                            formState.errors.duration_prices?.[index]?.duration
                              ?.message
                          }
                        />
                      )}
                    />
                  </Grid>

                  <Grid size={5}>
                    <Controller
                      name={`duration_prices.${index}.price`}
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          value={field.value === 0 ? "" : field.value}
                          label={t("priceEur")}
                          type="number"
                          size="small"
                          fullWidth
                          error={
                            !!formState.errors.duration_prices?.[index]?.price
                          }
                          helperText={
                            formState.errors.duration_prices?.[index]?.price
                              ?.message
                          }
                        />
                      )}
                    />
                  </Grid>

                  <Grid size={2} sx={{ display: "flex", alignItems: "center" }}>
                    <IconButton
                      color="error"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                    >
                      <CloseIcon />
                    </IconButton>
                  </Grid>
                </Grid>
              ))}

              <Grid size={12}>
                <Button
                  size="small"
                  startIcon={<AddCircleIcon />}
                  onClick={addDuration}
                >
                  {t("addDuration")}
                </Button>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={onCancel} startIcon={<CloseIcon />} disabled={submitting}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" color="success" startIcon={<AddCircleIcon />} disabled={submitting}>
              {t("addService")}
            </Button>
          </DialogActions>
        </form>
      </FormProvider>
    </Dialog>
  );
};

export default NewServiceDialogForm;
