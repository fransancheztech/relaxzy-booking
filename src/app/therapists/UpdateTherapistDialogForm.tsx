"use client";

import {
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
} from "@mui/material";
import { useForm, Controller, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import SaveIcon from "@mui/icons-material/Save";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { UpdateTherapistSchema, UpdateTherapistSchemaType } from "@/schemas/therapist.schema";

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
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [therapistName, setTherapistName] = useState("");

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
        });
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
      const res = await fetch(`/api/therapists/${therapistId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save therapist");
      toast.success("Therapist saved");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save therapist");
    } finally {
      setLoading(false);
      onClose();
    }
  };

  const handleDelete = async () => {
    setConfirmDeleteOpen(false);
    setLoading(true);
    try {
      const res = await fetch(`/api/therapists/${therapistId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete therapist");
      toast.success("Therapist deleted");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete therapist");
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
    <>
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

                <Grid size={12}>
                  <Controller
                    name="active"
                    control={methods.control}
                    render={({ field }) => (
                      <FormControlLabel
                        label="Active"
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
              </Grid>
            </DialogContent>

            <DialogActions sx={{ justifyContent: "space-between" }}>
              <Button
                startIcon={<DeleteIcon />}
                color="error"
                variant="contained"
                onClick={() => setConfirmDeleteOpen(true)}
              >
                Delete
              </Button>

              <div>
                <Button startIcon={<CloseIcon />} onClick={onCancel}>
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

      <Dialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Therapist</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete <strong>{therapistName}</strong>? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDeleteOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" startIcon={<DeleteIcon />} onClick={handleDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
