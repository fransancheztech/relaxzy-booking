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
import UpdateClientFormFields from "./NewClientFormFields";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import handleSubmitCreateClient from "@/handlers/handleSubmitCreateClient";
import { useTranslations } from "next-intl";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";

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
  const t = useTranslations("Clients");
  const tCommon = useTranslations("Common");
  const { submitting: loading, guard } = useSubmitGuard();

  const methods = useForm<ClientUpdateSchemaType>({
    resolver: zodResolver(ClientUpdateSchema),
    defaultValues: defaultValuesClientForm,
  });

  const onSubmit = (data: ClientUpdateSchemaType) =>
    guard(async () => {
      await handleSubmitCreateClient(data);
      onClose();
    });

  const onCancel = () => {
    methods.reset();
    onClose();
  };

  return (
    <>
      <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
        <DialogTitle>{t("newClient")}</DialogTitle>
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
                  disabled={loading}
                >
                  {tCommon("cancel")}
                </Button>
                <Button startIcon={<SaveIcon />} color="success" type="submit" disabled={loading}>
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
    </>
  );
};

export default NewClientDialogForm;
