import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Grid, Typography, Container } from '@mui/material';
import { GridFormElement } from './GridFormElement';
import React, { useState } from 'react';
import { FormFieldConfigModel } from '@/types/formFieldConfig';
import { ClientRow, useSimilarClients } from '@/hooks/useSimilarClients';
import { BookingModel } from '@/types/bookings';
import EditIcon from '@mui/icons-material/Edit';
import { useLayout } from '@/app/context/LayoutContext';

type DialogFormProps<T extends BookingModel> = {
    open: boolean;
    title: string;
    formFields: FormFieldConfigModel<T>[];
    formData: T;
    setFormData: React.Dispatch<React.SetStateAction<T>>;
    handleCancel: () => void;
    moreInputs?: React.ReactNode[];
    otherSubComponents?: React.ReactNode[];
    acceptButton?: React.ReactNode;
    cancelButton?: React.ReactNode;
    deleteButton?: React.ReactNode;
};

export function DialogForm<T extends BookingModel>({
    open,
    title,
    formFields,
    formData,
    setFormData,
    handleCancel,
    moreInputs = [],
    otherSubComponents,
    acceptButton = <></>,
    cancelButton = <></>,
    deleteButton = <></>
}: DialogFormProps<T>) {

    return (
        <Dialog
            open={open}
            onClose={() => {
                handleCancel();
            }}
            maxWidth='md'
            fullWidth
            sx={{
                '& .MuiDialog-container': {
                    alignItems: 'flex-start' // 👈 aligns dialog to top instead of center
                },
                '& .MuiPaper-root': {
                    marginTop: '2rem' // 👈 add some spacing from top
                }
            }}>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent sx={{ overflowY: 'hidden' }}>
                <Grid sx={{ paddingTop: '1rem' }} container spacing={{ xs: 1, xl: 2 }}>
                    {formFields.map((field) => (
                        <GridFormElement<T>
                            key={String(field.formKey)}
                            type={field.type}
                            size={field.size}
                            formData={formData}
                            setFormData={setFormData}
                            formKey={field.formKey}
                            label={field.label}
                            elements={field.elements}
                            filesMax={field.filesMax}
                            text={field.text}
                            showTime={field.showTime}
                            autoFocus={field.autoFocus}
                            isDisabled={field.disabled}
                        />
                    ))}
                    {moreInputs.map((input, index) => (
                        <React.Fragment key={index}>{input}</React.Fragment>
                    ))}
                </Grid>
            </DialogContent>

            <DialogActions sx={{ display: 'flex', justifyContent: 'space-between' }}>
                {deleteButton}
                <Container sx={{ display: 'flex', justifyContent: 'flex-end'}}>
                    {cancelButton}
                    {acceptButton}
                </Container>
            </DialogActions>

            {otherSubComponents &&
                otherSubComponents.map((component, index) => (
                    <Container key={index} sx={{ padding: '1rem' }}>
                        {component}
                    </Container>
                ))}
        </Dialog>
    );
}
