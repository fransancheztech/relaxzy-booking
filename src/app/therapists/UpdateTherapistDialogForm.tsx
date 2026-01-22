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
} from "@mui/material";
import { useForm, Controller, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import SaveIcon from "@mui/icons-material/Save";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import { useState, useEffect } from "react";
import { z } from "zod";

type Props = {
  open: boolean;
  onClose: () => void;
  therapistId: string;
};

const UpdateTherapistSchema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email").optional(),
  phone: z.string().optional(),
  notes: z.string().max(500).optional(),
});

export type UpdateTherapistSchemaType = z.infer<typeof UpdateTherapistSchema>;

const defaultValues: UpdateTherapistSchemaType = {
  full_name: "",
  email: "",
  phone: "",
  notes: "",
};

export default function UpdateTherapistDialogForm({
  open,
  onClose,
  therapistId,
}: Props) {
  const methods = useForm<UpdateTherapistSchemaType>({
    resolver: zodResolver(UpdateTherapistSchema),
    defaultValues,
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !therapistId) return;

    const loadTherapist = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/therapists/${therapistId}`);
        if (!res.ok) throw new Error("Failed to load therapist");
        const data = await res.json();
        methods.reset(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadTherapist();
  }, [open, therapistId]);

  const onSubmit = async (data: UpdateTherapistSchemaType) => {
    setLoading(true);
    try {
      await fetch(`/api/therapists/${therapistId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      onClose();
    }
  };

  const onCancel = () => {
    methods.reset(defaultValues);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>Update Therapist</DialogTitle>
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
                      label="Full Name"
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
                      label="Email"
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
                      label="Phone"
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
                      label="Notes"
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
            <Button
              startIcon={<DeleteIcon />}
              color="error"
              onClick={async () => {
                setLoading(true);
                try {
                  await fetch(`/api/therapists/${therapistId}`, { method: "DELETE" });
                } catch (err) {
                  console.error(err);
                } finally {
                  setLoading(false);
                  onClose();
                }
              }}
            >
              Delete
            </Button>

            <div>
              <Button startIcon={<CloseIcon />} color="error" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" startIcon={<SaveIcon />} color="success">
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
}
