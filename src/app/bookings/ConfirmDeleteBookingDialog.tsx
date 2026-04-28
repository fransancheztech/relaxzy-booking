import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import React from 'react';

type DialogConfirmProps = {
    confirmDeleteOpen: boolean;
    setConfirmDeleteOpen: React.Dispatch<React.SetStateAction<boolean>>;
    handleDelete: () => void;
    clientName?: string;
}

const ConfirmDeleteBookingDialog = ({confirmDeleteOpen, setConfirmDeleteOpen, handleDelete, clientName}: DialogConfirmProps) => {
    return (
        <Dialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} maxWidth="xs" fullWidth>
            <DialogTitle>Delete Booking?</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    {clientName
                        ? <>Are you sure you want to delete the booking for <strong>{clientName}</strong>? This action cannot be undone.</>
                        : "Are you sure you want to delete this booking? This action cannot be undone."}
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => setConfirmDeleteOpen(false)}>Cancel</Button>
                <Button
                    color='error'
                    variant='contained'
                    startIcon={<DeleteIcon />}
                    onClick={() => {
                        handleDelete();
                        setConfirmDeleteOpen(false);
                    }}>
                    Delete
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ConfirmDeleteBookingDialog;
