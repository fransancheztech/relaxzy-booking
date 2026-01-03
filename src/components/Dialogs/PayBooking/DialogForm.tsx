import { Alert, Button, CircularProgress, Container, Dialog, DialogActions, DialogContent, DialogTitle, Grid, TextField } from "@mui/material"
import AddCircleIcon from '@mui/icons-material/AddCircle';
import CloseIcon from '@mui/icons-material/Close';
import { Controller, useForm, useFormContext } from "react-hook-form";
import { BookingUpdateSchemaType } from "@/schemas/booking.schema";
import { defaultValuesUpdateBookingForm } from "../UpdateBooking/DialogForm";
import { useEffect, useRef, useState } from "react";
import handleSubmitUpdateBooking from "@/handlers/handleSubmitUpdateBooking";
import Paper, { PaperProps } from "@mui/material/Paper";
import { zodResolver } from "@hookform/resolvers/zod";
import { BookingPaymentSchema, BookingPaymentFormInput, BookingPaymentFormOutput } from "@/schemas/bookingPayment.schema";
import handleSubmitPayBooking from "@/handlers/handleSubmitPayBooking";

interface DialogFormProps {
    open: boolean;
    onClose: () => void;
    bookingId: string;
    price: number;
    paidCash: number | undefined;
    paidCard: number | undefined
}

const DialogForm = ({ open, onClose, bookingId, price, paidCash, paidCard }: DialogFormProps) => {

    const defaultValues = {
        cashPayment: 0,
        cardPayment: 0,
        paidCash: paidCash ?? 0,
        paidCard: paidCard ?? 0,
        price: price ?? 0,
    }

    const methods = useForm<BookingPaymentFormInput, any, BookingPaymentFormOutput>({
        resolver: zodResolver(BookingPaymentSchema),
        defaultValues
    });

    console.log("AQUI methods: " + JSON.stringify(methods.handleSubmit))

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open) return;
        methods.reset(defaultValues);
    }, [price, paidCash, paidCard, open]);

    const onSubmit = async (data: BookingPaymentFormOutput) => {
        console.log("OnSubmit Pagando BOoking")
        if (!bookingId) return;
        setLoading(true)
        await handleSubmitPayBooking({
            ...data,
            id: bookingId
        });
        setLoading(false)
        onClose();
    };

    const onCancel = () => {
        methods.reset()
        onClose()
    }

    return (
        <>
            <Dialog open={open} onClose={onClose}>
                <DialogTitle>Pay Booking</DialogTitle>
                <form onSubmit={methods.handleSubmit(onSubmit)} noValidate>
                    <DialogContent>
                        <Grid container sx={{ paddingTop: '1rem' }} spacing={{ xs: 1, xl: 2 }}>
                            <Grid size={6}>
                                <Controller name="cashPayment" control={methods.control} render={({ field }) => (
                                    <TextField
                                        {...field}
                                        value={field.value === 0 ? "" : field.value}
                                        onChange={(e) => field.onChange(e.target.value)}
                                        label='Cash'
                                        fullWidth
                                        size='small'
                                        variant='outlined'
                                        error={!!methods.formState.errors.cashPayment}
                                        helperText={methods.formState.errors.cashPayment?.message}
                                    />
                                )}>
                                </Controller>
                            </Grid>
                            <Grid size={6}>
                                <Controller name="cardPayment" control={methods.control} render={({ field }) => (
                                    <TextField
                                        {...field}
                                        value={field.value === 0 ? "" : field.value}
                                        onChange={(e) => field.onChange(e.target.value)}
                                        label='Credit card'
                                        fullWidth
                                        size='small'
                                        variant='outlined'
                                        error={!!methods.formState.errors.cardPayment}
                                        helperText={methods.formState.errors.cardPayment?.message}
                                    />
                                )}>
                                </Controller>
                            </Grid>
                            {(methods.formState.errors as any).form?.message && (
                                <Container sx={{ marginBottom: 2 }} >
                                    <Alert severity="error" variant="standard">
                                        {(methods.formState.errors as any).form.message}
                                    </Alert>
                                </Container>
                            )}
                        </Grid>
                    </DialogContent>
                    <DialogActions>
                        <Button
                            sx={{ color: 'error.main', gap: 1 }}
                            onClick={onCancel}>
                            <CloseIcon />
                            Cancel
                        </Button>
                        <Button type="button" sx={{ color: 'primary.main', gap: 1 }} onClick={methods.handleSubmit(onSubmit)}>
                            <AddCircleIcon />
                            Add Payment
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>
            {loading && (
                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>
                    <CircularProgress />
                </div>
            )}
        </>
    )
}

export default DialogForm