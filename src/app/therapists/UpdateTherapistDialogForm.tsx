"use client";

import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  Grid,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useForm, Controller, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import SaveIcon from "@mui/icons-material/Save";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { UpdateTherapistSchema, UpdateTherapistSchemaType } from "@/schemas/therapist.schema";
import { useTranslations } from "next-intl";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";

type Props = {
  open: boolean;
  onClose: () => void;
  therapistId: string;
};

const defaultValues: UpdateTherapistSchemaType = {
  full_name: "",
  email: "",
  phone: "",
  notes: "",
  active: true,
  off_days: [],
};

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
const DOW_KEYS: Record<number, string> = {
  1: "dowMon",
  2: "dowTue",
  3: "dowWed",
  4: "dowThu",
  5: "dowFri",
  6: "dowSat",
  7: "dowSun",
};

export default function UpdateTherapistDialogForm({
  open,
  onClose,
  therapistId,
}: Props) {
  const t = useTranslations("Therapists");
  const tCommon = useTranslations("Common");

  const methods = useForm<UpdateTherapistSchemaType>({
    resolver: zodResolver(UpdateTherapistSchema),
    defaultValues,
  });

  const [loading, setLoading] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [therapistName, setTherapistName] = useState("");
  const { submitting, guard } = useSubmitGuard();

  useEffect(() => {
    if (!open || !therapistId) return;

    const loadTherapist = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/therapists/${therapistId}`);
        if (!res.ok) throw new Error("Failed to load therapist");
        const data = await res.json();
        setTherapistName(data.full_name ?? "");
        methods.reset({
          full_name: data.full_name ?? "",
          email: data.email ?? "",
          phone: data.phone ?? "",
          notes: data.notes ?? "",
          active: data.active ?? true,
          off_days: Array.isArray(data.off_days) ? data.off_days : [],
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadTherapist();
  }, [open, therapistId]);

  const onSubmit = (data: UpdateTherapistSchemaType) =>
    guard(async () => {
      try {
        const res = await fetch(`/api/therapists/${therapistId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("Failed to save therapist");
        toast.success(t("therapistSaved"));
      } catch (err) {
        console.error(err);
        toast.error(t("updateTherapist"));
      } finally {
        onClose();
      }
    });

  const handleDelete = () =>
    guard(async () => {
      setConfirmDeleteOpen(false);
      try {
        const res = await fetch(`/api/therapists/${therapistId}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete therapist");
        toast.success(t("therapistDeleted"));
      } catch (err) {
        console.error(err);
        toast.error(t("deleteTitle"));
      } finally {
        onClose();
      }
    });

  const onCancel = () => {
    methods.reset(defaultValues);
    onClose();
  };

  return (
    <>
      <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
        <DialogTitle>{t("updateTherapist")}</DialogTitle>
        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit)} noValidate>
            <DialogContent sx={{ opacity: loading ? 0.5 : 1, pointerEvents: loading ? "none" : "auto" }}>
              <Grid container spacing={2} sx={{ pt: 1 }}>
                <Grid size={12}>
                  <Controller
                    name="full_name"
                    control={methods.control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label={t("fullName")}
                        required
                        fullWidth
                        size="small"
                        error={!!methods.formState.errors.full_name}
                        helperText={methods.formState.errors.full_name?.message}
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

                <Grid size={12}>
                  <Controller
                    name="active"
                    control={methods.control}
                    render={({ field }) => (
                      <FormControlLabel
                        label={t("active")}
                        control={
                          <Switch
                            checked={field.value ?? true}
                            onChange={(e) => field.onChange(e.target.checked)}
                          />
                        }
                      />
                    )}
                  />
                </Grid>

                <Grid size={12}>
                  <Controller
                    name="off_days"
                    control={methods.control}
                    render={({ field }) => (
                      <Box>
                        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1.5, mb: 0.5 }}>
                          <Typography variant="body2" color="text.secondary">
                            {t("daysOff")}
                          </Typography>
                          <Typography variant="caption" color="text.disabled">
                            {t("daysOffHint")}
                          </Typography>
                        </Box>
                        <ToggleButtonGroup
                          size="small"
                          value={field.value ?? []}
                          onChange={(_, newValue: number[]) => field.onChange(newValue)}
                          aria-label={t("daysOff")}
                          sx={{
                            "& .MuiToggleButton-root": {
                              px: 1.5,
                              minWidth: 52,
                              fontWeight: 600,
                              color: "success.main",
                              borderColor: "rgba(46, 125, 50, 0.4)",
                              bgcolor: "rgba(76, 175, 80, 0.08)",
                              "&:hover": { bgcolor: "rgba(76, 175, 80, 0.18)" },
                            },
                            "& .MuiToggleButton-root.Mui-selected": {
                              color: "error.main",
                              borderColor: "rgba(211, 47, 47, 0.4)",
                              bgcolor: "rgba(244, 67, 54, 0.12)",
                              textDecoration: "line-through",
                              "&:hover": { bgcolor: "rgba(244, 67, 54, 0.22)" },
                            },
                          }}
                        >
                          {WEEKDAYS.map((day) => (
                            <ToggleButton key={day} value={day}>
                              {t(DOW_KEYS[day] as Parameters<typeof t>[0])}
                            </ToggleButton>
                          ))}
                        </ToggleButtonGroup>
                      </Box>
                    )}
                  />
                </Grid>
              </Grid>
            </DialogContent>

            <DialogActions sx={{ justifyContent: "space-between" }}>
              <Button
                startIcon={<DeleteIcon />}
                color="error"
                variant="contained"
                onClick={() => setConfirmDeleteOpen(true)}
                disabled={submitting}
              >
                {tCommon("delete")}
              </Button>

              <div>
                <Button startIcon={<CloseIcon />} onClick={onCancel} disabled={submitting}>
                  {tCommon("cancel")}
                </Button>
                <Button type="submit" startIcon={<SaveIcon />} color="success" disabled={submitting}>
                  {tCommon("saveChanges")}
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

      <Dialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t("deleteTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t("deleteMessage", { name: therapistName })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteOpen(false)} disabled={submitting}>{tCommon("cancel")}</Button>
          <Button color="error" variant="contained" startIcon={<DeleteIcon />} onClick={handleDelete} disabled={submitting}>
            {tCommon("delete")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
