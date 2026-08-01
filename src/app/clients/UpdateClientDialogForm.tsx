"use client";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  CircularProgress,
  Container,
  IconButton,
  Tooltip,
} from "@mui/material";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ClientUpdateSchema,
  ClientUpdateSchemaType,
} from "@/schemas/client.schema";
import { useEffect, useState } from "react";
import UpdateClientFormFields from "./UpdateClientFormFields";
import ClientHistorySection from "./ClientHistorySection";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import EditIcon from "@mui/icons-material/Edit";
import handleSubmitUpdateClient from "@/handlers/handleSubmitUpdateClient";
import DialogConfirmDeleteClient from "./ConfirmDeleteClientDialog";
import DeleteIcon from "@mui/icons-material/Delete";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";

type Props = {
  open: boolean;
  onClose: () => void;
  clientId?: string | null;
  confirmDeleteOpen: boolean;
  onConfirmDelete: () => void;
  closeDeleteDialog: () => void;
  setConfirmDeleteOpen: (open: boolean) => void;
};

export const defaultValuesClientForm: Partial<ClientUpdateSchemaType> = {
  client_name: "",
  client_surname: "",
  client_email: "",
  client_phone: "",
  client_notes: "",
};

const UpdateClientDialogForm = ({
  open,
  onClose,
  clientId = null,
  confirmDeleteOpen,
  onConfirmDelete,
  closeDeleteDialog,
  setConfirmDeleteOpen,
}: Props) => {
  const t = useTranslations("Clients");
  const tCommon = useTranslations("Common");
  const [loading, setLoading] = useState(false);
  // The dialog opens in view mode; the pencil switches to edit.
  const [editMode, setEditMode] = useState(false);
  const { submitting, guard } = useSubmitGuard();

  const methods = useForm<ClientUpdateSchemaType>({
    resolver: zodResolver(ClientUpdateSchema),
    defaultValues: defaultValuesClientForm,
  });

  // Load client data when dialog opens (always land in view mode)
  useEffect(() => {
    if (!open || !clientId) return;
    setEditMode(false);

    const loadClient = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/clients/${clientId}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Failed to load client: ${res.status}, ${res.statusText}`);
        const data = await res.json();
        methods.reset({
          client_name: data.client_name ?? "",
          client_surname: data.client_surname ?? "",
          client_email: data.client_email ?? "",
          client_phone: data.client_phone ?? "", // CRITICAL
          client_notes: data.client_notes ?? "",
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadClient();
  }, [open, clientId]);

  const onSubmit = (data: ClientUpdateSchemaType) =>
    guard(async () => {
      if (!clientId) {
        throw new Error("Client ID is required for updating a client");
      }
      const result = await handleSubmitUpdateClient({
        id: clientId,
        ...data,
      });

      if (result.status === "contact_taken") {
        // The contact the receptionist entered already belongs to another client.
        const msg = result.name
          ? result.field === "email"
            ? t("contactTakenEmail", { name: result.name })
            : t("contactTakenPhone", { name: result.name })
          : t("contactTaken");
        toast.error(msg);
        return; // keep the dialog open so the contact can be corrected
      }
      if (result.status === "error") return; // already surfaced by the handler

      // Back to view mode showing the saved data (keep the dialog + history open).
      setEditMode(false);
    });

  // Close the whole dialog.
  const handleClose = () => {
    methods.reset();
    onClose();
  };

  // Leave edit mode, discarding changes (revert to the loaded values).
  const handleCancelEdit = () => {
    methods.reset();
    setEditMode(false);
  };

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pr: 1 }}>
          {editMode ? t("editClient") : t("viewClient")}
          {!editMode && (
            <Tooltip title={tCommon("edit")}>
              <IconButton size="small" onClick={() => setEditMode(true)}>
                <EditIcon fontSize="small" color="primary" />
              </IconButton>
            </Tooltip>
          )}
        </DialogTitle>
        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit)} noValidate>
            <DialogContent
              sx={{
                opacity: loading ? 0.5 : 1,
                pointerEvents: loading ? "none" : "auto",
              }}
            >
              <UpdateClientFormFields readOnly={!editMode} />
              <ClientHistorySection clientId={clientId} open={open} />
            </DialogContent>
            <DialogActions
              sx={{ display: "flex", justifyContent: "space-between" }}
            >
              {editMode ? (
                <>
                  <Button
                    startIcon={<DeleteIcon />}
                    color="error"
                    variant="contained"
                    onClick={() => setConfirmDeleteOpen(true)}
                    disabled={submitting}
                  >
                    {tCommon("delete")}
                  </Button>
                  <Container sx={{ display: "flex", justifyContent: "flex-end" }}>
                    <Button
                      startIcon={<CloseIcon />}
                      onClick={handleCancelEdit}
                      disabled={submitting}
                    >
                      {tCommon("cancel")}
                    </Button>
                    <Button startIcon={<SaveIcon />} color="success" type="submit" disabled={submitting}>
                      {tCommon("save")}
                    </Button>
                  </Container>
                </>
              ) : (
                <Box sx={{ display: "flex", justifyContent: "flex-end", width: "100%" }}>
                  <Button startIcon={<CloseIcon />} onClick={handleClose}>
                    {tCommon("close")}
                  </Button>
                </Box>
              )}
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
      <DialogConfirmDeleteClient
        open={confirmDeleteOpen}
        onClose={closeDeleteDialog}
        onConfirm={onConfirmDelete}
        clientName={[methods.watch("client_name"), methods.watch("client_surname")].filter(Boolean).join(" ")}
      />
    </>
  );
};

export default UpdateClientDialogForm;
