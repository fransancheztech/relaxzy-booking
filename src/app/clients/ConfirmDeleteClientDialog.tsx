"use client";

import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { useTranslations } from "next-intl";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  clientName?: string;
};

export default function ConfirmDeleteClientDialog({ open, onClose, onConfirm, clientName }: Props) {
  const t = useTranslations("Clients");
  const tCommon = useTranslations("Common");

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t("deleteTitle")}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {clientName
            ? t("deleteWithName", { name: clientName })
            : t("deleteWithoutName")}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{tCommon("cancel")}</Button>
        <Button color="error" variant="contained" startIcon={<DeleteIcon />} onClick={() => {
          onConfirm();
          onClose();
        }}>
          {tCommon("delete")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
