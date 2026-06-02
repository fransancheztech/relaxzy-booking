"use client";

import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  TextField,
  Typography,
} from "@mui/material";
import { useForm, Controller, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";
import { UpdateTherapistSchema, UpdateTherapistSchemaType } from "@/schemas/therapist.schema";

type Props = {
  open: boolean;
  onClose: () => void;
};

const defaultValues: UpdateTherapistSchemaType = {
  nickname: "",
  name: "",
  surname: "",
  email: "",
  phone: "",
  notes: "",
};

export default function AddTherapistDialogForm({ open, onClose }: Props) {
  const t = useTranslations("Therapists");
  const tCommon = useTranslations("Common");

  const methods = useForm<UpdateTherapistSchemaType>({
    resolver: zodResolver(UpdateTherapistSchema),
    defaultValues,
  });

  const { submitting: loading, guard } = useSubmitGuard();

  const onSubmit = (data: UpdateTherapistSchemaType) =>
    guard(async () => {
      try {
        const res = await fetch("/api/therapists/add", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to add therapist");
        }
        toast.success(t("therapistAdded"));
      } catch (err) {
        console.error(err);
        toast.error(err instanceof Error ? err.message : t("addTherapist"));
      } finally {
        methods.reset(defaultValues);
        onClose();
      }
    });

  const onCancel = () => {
    methods.reset(defaultValues);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{t("addTherapist")}</DialogTitle>
      <FormProvider {...methods}>
        <form onSubmit={methods.handleSubmit(onSubmit)} noValidate>
          <DialogContent>
            <Grid container spacing={2} sx={{ pt: 1 }}>
              <Grid size={12} sx={{ pb: 0, mb: -1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic" }}>
                  {t("nameOrNicknameRequired")}
                </Typography>
              </Grid>
              <Grid size={12}>
                <Controller
                  name="nickname"
                  control={methods.control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label={t("nickname")}
                      fullWidth
                      size="small"
                      error={!!methods.formState.errors.nickname}
                      helperText={methods.formState.errors.nickname?.message}
                    />
                  )}
                />
              </Grid>

              <Grid size={6}>
                <Controller
                  name="name"
                  control={methods.control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label={t("name")}
                      fullWidth
                      size="small"
                      error={!!methods.formState.errors.name}
                      helperText={methods.formState.errors.name?.message}
                    />
                  )}
                />
              </Grid>

              <Grid size={6}>
                <Controller
                  name="surname"
                  control={methods.control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label={t("surname")}
                      fullWidth
                      size="small"
                      error={!!methods.formState.errors.surname}
                      helperText={methods.formState.errors.surname?.message}
                    />
                  )}
                />
              </Grid>

              <Grid size={12}>
                <Controller
                  name="email"
                  control={methods.control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label={tCommon("email")}
                      fullWidth
                      size="small"
                      error={!!methods.formState.errors.email}
                      helperText={methods.formState.errors.email?.message}
                    />
                  )}
                />
              </Grid>

              <Grid size={12}>
                <Controller
                  name="phone"
                  control={methods.control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label={tCommon("phone")}
                      fullWidth
                      size="small"
                      error={!!methods.formState.errors.phone}
                      helperText={methods.formState.errors.phone?.message}
                    />
                  )}
                />
              </Grid>

              <Grid size={12}>
                <Controller
                  name="notes"
                  control={methods.control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      label={tCommon("notes")}
                      fullWidth
                      multiline
                      rows={3}
                      size="small"
                      error={!!methods.formState.errors.notes}
                      helperText={methods.formState.errors.notes?.message}
                    />
                  )}
                />
              </Grid>
            </Grid>
          </DialogContent>

          <DialogActions sx={{ justifyContent: "space-between" }}>
            <Button startIcon={<CloseIcon />} onClick={onCancel}>
              {tCommon("cancel")}
            </Button>
            <Button
              type="submit"
              startIcon={<SaveIcon />}
              color="success"
              disabled={loading}
            >
              {loading ? tCommon("saving") : tCommon("save")}
            </Button>
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
}
