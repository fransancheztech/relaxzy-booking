"use client";

import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import React from 'react';
import { useTranslations } from 'next-intl';

type DialogConfirmProps = {
    confirmDeleteOpen: boolean;
    setConfirmDeleteOpen: React.Dispatch<React.SetStateAction<boolean>>;
    handleDelete: () => void;
    clientName?: string;
}

const ConfirmDeleteBookingDialog = ({confirmDeleteOpen, setConfirmDeleteOpen, handleDelete, clientName}: DialogConfirmProps) => {
    const t = useTranslations("BookingDelete");
    const tCommon = useTranslations("Common");

    return (
        <Dialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} maxWidth="xs" fullWidth>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    {clientName
                        ? t("messageWithName", { name: clientName })
                        : t("messageWithoutName")}
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => setConfirmDeleteOpen(false)}>{tCommon("cancel")}</Button>
                <Button
                    color='error'
                    variant='contained'
                    startIcon={<DeleteIcon />}
                    onClick={() => {
                        handleDelete();
                        setConfirmDeleteOpen(false);
                    }}>
                    {tCommon("delete")}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ConfirmDeleteBookingDialog;
