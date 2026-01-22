"use client";

import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export default function ConfirmDeleteClientDialog({ open, onClose, onConfirm }: Props) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Delete client?</DialogTitle>
      <DialogContent>This action cannot be undone.</DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>
          Cancel
        </Button>
        <Button color="error" variant="contained" onClick={() => {
          onConfirm();
          onClose();
        }}>
          Confirm Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}
