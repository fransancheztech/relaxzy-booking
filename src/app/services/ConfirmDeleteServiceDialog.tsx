import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

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
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Delete Service?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {serviceName
            ? <>Are you sure you want to delete <strong>{serviceName}</strong>? This action cannot be undone.</>
            : "Are you sure you want to delete this service? This action cannot be undone."}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          color="error"
          startIcon={<DeleteIcon />}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDeleteServiceDialog;
