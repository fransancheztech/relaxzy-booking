import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  TextField,
  Typography,
} from "@mui/material";
import { Controller, FormProvider, useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import SaveIcon from "@mui/icons-material/Save";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import { useEffect, useState } from "react";
import { BaseServiceSchema, BaseServiceSchemaType, ServiceDurationPriceSchemaType } from "@/schemas/service.schema";
import handleSubmitUpdateService from "@/handlers/handleSubmitupdateService";

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

const UpdateServiceDialogForm = ({ open, onClose, serviceId, setIsOpenConfirmDelete }: Props) => {
  const [loading, setLoading] = useState(false);

  const methods = useForm<BaseServiceSchemaType>({
    resolver: zodResolver(BaseServiceSchema),
    defaultValues,
  });

  const { control, reset, handleSubmit, formState } = methods;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "duration_prices",
  });

  const addDuration = () => {
    const durations = methods.getValues("duration_prices").map((d) => d.duration);
    let next = 30;
    while (durations.includes(next)) next += 30;
    append({ duration: next, price: 0 });
  };

  useEffect(() => {
    if (!open || !serviceId) return;

    const loadService = async () => {
      setLoading(true);
      try {
        const res: Response = await fetch(`/api/services/${serviceId}`, { cache: "no-store" });
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
          duration_prices: data.duration_prices.length > 0 ? data.duration_prices : [{ duration: 60, price: 0 }],
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadService();
  }, [open, serviceId]);

  const onSubmit = async (data: BaseServiceSchemaType) => {
    setLoading(true);
    await handleSubmitUpdateService({
      id: serviceId,
      ...data,
    });
    reset();
    setLoading(false);
    onClose();
  };

  const onCancel = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>Update Service</DialogTitle>
      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <DialogContent
            sx={{
              opacity: loading ? 0.5 : 1,
              pointerEvents: loading ? "none" : "auto",
            }}
          >
            <Typography fontSize="small">Service ID: {serviceId}</Typography>
            <Grid container spacing={{ xs: 1, xl: 2 }} sx={{ pt: 2 }}>
              <Grid size={12}>
                <Controller
                  name="name"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label="Service name"
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
                      label="Short name"
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
                      label="Notes"
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
                  Durations & Prices:
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
                          label="Minutes"
                          type="number"
                          size="small"
                          fullWidth
                          error={!!formState.errors.duration_prices?.[index]?.duration}
                          helperText={formState.errors.duration_prices?.[index]?.duration?.message}
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
                          label="Price (€)"
                          type="number"
                          size="small"
                          fullWidth
                          error={!!formState.errors.duration_prices?.[index]?.price}
                          helperText={formState.errors.duration_prices?.[index]?.price?.message}
                        />
                      )}
                    />
                  </Grid>

                  <Grid size={2} sx={{ display: "flex", alignItems: "center" }}>
                    <IconButton color="error" onClick={() => remove(index)} disabled={fields.length === 1}>
                      <CloseIcon />
                    </IconButton>
                  </Grid>
                </Grid>
              ))}

              <Grid size={12}>
                <Button size="small" startIcon={<AddCircleIcon />} onClick={addDuration}>
                  Add duration
                </Button>
              </Grid>
            </Grid>
          </DialogContent>

          <DialogActions sx={{ display: "flex", justifyContent: "space-between" }}>
            <Button startIcon={<DeleteIcon />} color="error" variant="contained" onClick={() =>setIsOpenConfirmDelete(true)}>
              Delete
            </Button>
            <div>
              <Button startIcon={<CloseIcon />} color="error" onClick={onCancel}>
                Cancel
              </Button>
              <Button startIcon={<SaveIcon />} color="success" type="submit">
                Save Changes
              </Button>
            </div>
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
