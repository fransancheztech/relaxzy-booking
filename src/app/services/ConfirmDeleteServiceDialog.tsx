"use client";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { useTranslations } from "next-intl";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  serviceName?: string;
};

const ConfirmDeleteServiceDialog = ({
  open,
  onClose,
  onConfirm,
  serviceName,
}: Props) => {
  const t = useTranslations("Services");
  const tCommon = useTranslations("Common");
  const { submitting, guard } = useSubmitGuard();

  const handleConfirm = () => guard(async () => {
    onConfirm();
    onClose();
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t("deleteTitle")}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {serviceName
            ? t("deleteWithName", { name: serviceName })
            : t("deleteWithoutName")}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>{tCommon("cancel")}</Button>
        <Button
          variant="contained"
          color="error"
          startIcon={<DeleteIcon />}
          onClick={handleConfirm}
          disabled={submitting}
        >
          {tCommon("delete")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDeleteServiceDialog;
