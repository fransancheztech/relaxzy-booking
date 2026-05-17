"use client";

import {
  Alert,
  Box,
  Button,
  CircularProgress,
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
  useForm,
  useFieldArray,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import SaveIcon from "@mui/icons-material/Save";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  BaseServiceSchema,
  BaseServiceSchemaType,
  BaseServiceSchemaTypeInput,
  BaseServiceSchemaTypeOutput,
  ServiceDurationPriceSchemaType,
} from "@/schemas/service.schema";
import handleSubmitUpdateService from "@/handlers/handleSubmitupdateService";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";

type Props = {
  open: boolean;
  onClose: () => void;
  serviceId: string;
  setIsOpenConfirmDelete: (open: boolean) => void;
};

const defaultValues: BaseServiceSchemaType = {
  name: "",
  short_name: "",
  notes: "",
  duration_prices: [{ duration: 60, price: 0 }],
};

const UpdateServiceDialogForm = ({
  open,
  onClose,
  serviceId,
  setIsOpenConfirmDelete,
}: Props) => {
  const t = useTranslations("Services");
  const tCommon = useTranslations("Common");

  const [loading, setLoading] = useState(false);
  const { submitting, guard } = useSubmitGuard();

  const methods = useForm<
    BaseServiceSchemaTypeInput,
    any,
    BaseServiceSchemaTypeOutput
  >({
    resolver: zodResolver(BaseServiceSchema),
    defaultValues,
  });

  const { control, reset, handleSubmit, formState } = methods;

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

  useEffect(() => {
    if (!open || !serviceId) return;

    const loadService = async () => {
      setLoading(true);
      try {
        const res: Response = await fetch(`/api/services/${serviceId}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to load service");

        const data: {
          name: string;
          short_name?: string;
          notes?: string;
          duration_prices: ServiceDurationPriceSchemaType[];
        } = await res.json();

        reset({
          name: data.name,
          short_name: data.short_name ?? "",
          notes: data.notes ?? "",
          duration_prices:
            data.duration_prices.length > 0
              ? data.duration_prices
              : [{ duration: 60, price: 0 }],
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadService();
  }, [open, serviceId]);

  const onSubmit = (data: BaseServiceSchemaType) =>
    guard(async () => {
      try {
        await handleSubmitUpdateService({
          id: serviceId,
          ...data,
        });
        reset();
        onClose();
      } catch (error) {
        console.error("Update failed:", error);
      }
    });

  const onCancel = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{t("updateService")}</DialogTitle>
      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <DialogContent
            sx={{
              opacity: loading ? 0.5 : 1,
              pointerEvents: loading ? "none" : "auto",
            }}
          >
            <Typography fontSize="small">{t("serviceId")}: {serviceId}</Typography>
            <Grid container spacing={{ xs: 1, xl: 2 }} sx={{ pt: 2 }}>
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
                  {t("durationsAndPrices")}:
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

              {formState.errors.duration_prices?.message && (
                <Container sx={{ marginBottom: 2 }}>
                  <Alert severity="error" variant="standard">
                    {formState.errors.duration_prices.message}
                  </Alert>
                </Container>
              )}

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

          <DialogActions
            sx={{ display: "flex", justifyContent: "space-between" }}
          >
            <Button
              startIcon={<DeleteIcon />}
              color="error"
              variant="contained"
              onClick={() => setIsOpenConfirmDelete(true)}
              disabled={submitting}
            >
              {tCommon("delete")}
            </Button>
            <Box>
              <Button
                startIcon={<CloseIcon />}
                color="error"
                onClick={onCancel}
                disabled={submitting}
              >
                {tCommon("cancel")}
              </Button>
              <Button startIcon={<SaveIcon />} color="success" type="submit" disabled={submitting}>
                {tCommon("saveChanges")}
              </Button>
            </Box>
          </DialogActions>
        </form>
      </FormProvider>

      {loading && (
        <CircularProgress
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />
      )}
    </Dialog>
  );
};

export default UpdateServiceDialogForm;
