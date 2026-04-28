"use client";

import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  clientName?: string;
};

export default function ConfirmDeleteClientDialog({ open, onClose, onConfirm, clientName }: Props) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Delete Client?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {clientName
            ? <>Are you sure you want to delete <strong>{clientName}</strong>? This action cannot be undone.</>
            : "Are you sure you want to delete this client? This action cannot be undone."}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button color="error" variant="contained" startIcon={<DeleteIcon />} onClick={() => {
          onConfirm();
          onClose();
        }}>
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}
