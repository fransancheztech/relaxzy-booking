"use client";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
  Container,
} from "@mui/material";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ClientUpdateSchema,
  ClientUpdateSchemaType,
} from "@/schemas/client.schema";
import { useState } from "react";
import UpdateClientFormFields from "./NewClientFormFields";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
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

const NewClientDialogForm = ({ open, onClose }: Props) => {
  const [loading, setLoading] = useState(false);

  const methods = useForm<ClientUpdateSchemaType>({
    resolver: zodResolver(ClientUpdateSchema),
    defaultValues: defaultValuesClientForm,
  });

  const onSubmit = async (data: ClientUpdateSchemaType) => {
    setLoading(true);

    await handleSubmitCreateClient(data);
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
        <DialogTitle>New Client</DialogTitle>
        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit)} noValidate>
            <DialogContent
              sx={{
                opacity: loading ? 0.5 : 1,
                pointerEvents: loading ? "none" : "auto",
              }}
            >
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
                <Button startIcon={<SaveIcon />} color="success" type="submit">
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

export default NewClientDialogForm;
