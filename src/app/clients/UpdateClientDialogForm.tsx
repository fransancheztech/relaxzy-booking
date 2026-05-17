"use client";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
  Container,
  Typography,
} from "@mui/material";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ClientUpdateSchema,
  ClientUpdateSchemaType,
} from "@/schemas/client.schema";
import { useEffect, useState } from "react";
import UpdateClientFormFields from "./UpdateClientFormFields";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import handleSubmitUpdateClient from "@/handlers/handleSubmitUpdateClient";
import DialogConfirmDeleteClient from "./ConfirmDeleteClientDialog";
import DeleteIcon from "@mui/icons-material/Delete";
import { useTranslations } from "next-intl";
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
  const { submitting, guard } = useSubmitGuard();

  const methods = useForm<ClientUpdateSchemaType>({
    resolver: zodResolver(ClientUpdateSchema),
    defaultValues: defaultValuesClientForm,
  });

  // Load client data when dialog opens
  useEffect(() => {
    if (!open || !clientId) return;
    
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
      await handleSubmitUpdateClient({
        id: clientId,
        ...data,
      });
      onClose();
    });

  const onCancel = () => {
    methods.reset();
    onClose();
  };

  return (
    <>
      <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
        <DialogTitle>{t("editClient")}</DialogTitle>
        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit)} noValidate>
            <DialogContent
              sx={{
                opacity: loading ? 0.5 : 1,
                pointerEvents: loading ? "none" : "auto",
              }}
            >
              <Typography fontSize="small">{t("clientId")}: {clientId}</Typography>
              <UpdateClientFormFields />
            </DialogContent>
            <DialogActions
              sx={{ display: "flex", justifyContent: "space-between" }}
            >
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
                  onClick={onCancel}
                  disabled={submitting}
                >
                  {tCommon("cancel")}
                </Button>
                <Button startIcon={<SaveIcon />} color="success" type="submit" disabled={submitting}>
                  {tCommon("save")}
                </Button>
              </Container>
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
