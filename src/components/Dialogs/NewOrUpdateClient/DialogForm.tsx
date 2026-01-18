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
import UpdateClientFormFields from "./FormFieldsClients";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import handleSubmitUpdateClient from "@/handlers/handleSubmitUpdateClient";
import handleSubmitCreateClient from "@/handlers/handleSubmitCreateClient";

type Props = {
  open: boolean;
  onClose: () => void;
  clientId?: string | null;
};

export const defaultValuesClientForm: Partial<ClientUpdateSchemaType> = {
  client_name: "",
  client_surname: "",
  client_email: "",
  client_phone: "",
  client_notes: "",
};

const DialogForm = ({ open, onClose, clientId = null }: Props) => {
  const [loading, setLoading] = useState(false);

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
        if (!res.ok) throw new Error("Failed to load client");
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

  const onSubmit = async (data: ClientUpdateSchemaType) => {
    if (!clientId) return;

    setLoading(true);
    if (!clientId) {
      await handleSubmitCreateClient(data);
    } else {
      await handleSubmitUpdateClient({ ...data, id: clientId });
    }
    setLoading(false);
    onClose();
  };

  const onCancel = () => {
    methods.reset();
    onClose();
  };

  return (
    <>
      <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Client</DialogTitle>
        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit)} noValidate>
            <DialogContent
              sx={{
                opacity: loading ? 0.5 : 1,
                pointerEvents: loading ? "none" : "auto",
              }}
            >
              <Typography fontSize="small">Client ID: {clientId}</Typography>
              <UpdateClientFormFields />
            </DialogContent>
            <DialogActions
              sx={{ display: "flex", justifyContent: "space-between" }}
            >
              <Container sx={{ display: "flex", justifyContent: "flex-end" }}>
                <Button
                  startIcon={<CloseIcon />}
                  color="error"
                  onClick={onCancel}
                >
                  Cancel
                </Button>
                <Button
                  startIcon={<SaveIcon />}
                  color="success"
                  type="submit"
                >
                  Save
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
    </>
  );
};

export default DialogForm;
