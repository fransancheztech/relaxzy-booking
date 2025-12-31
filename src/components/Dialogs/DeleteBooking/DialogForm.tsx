import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import React from 'react';

type DialogConfirmProps = {
    confirmDeleteOpen: boolean;
    setConfirmDeleteOpen: React.Dispatch<React.SetStateAction<boolean>>;
    handleDelete: () => void;
}

const DialogForm = ({confirmDeleteOpen, setConfirmDeleteOpen, handleDelete}: DialogConfirmProps) => {
    return (
        <Dialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)}>
            <DialogTitle>Delete booking?</DialogTitle>
            <DialogContent>This action cannot be undone.</DialogContent>
            <DialogActions>
                <Button variant='outlined' sx={{}} onClick={() => setConfirmDeleteOpen(false)}>Cancel</Button>
                <Button
                    color='error'
                    variant='contained'
                    onClick={() => {
                        handleDelete();
                        setConfirmDeleteOpen(false);
                    }}>
                    Confirm Delete
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default DialogForm;
