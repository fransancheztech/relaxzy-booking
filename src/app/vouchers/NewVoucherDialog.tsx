import { zodResolver } from '@hookform/resolvers/zod';
import { Button, DialogActions, DialogContent, Dialog, DialogTitle } from '@mui/material'
import { FormProvider, useForm } from 'react-hook-form'
import { VoucherSchemaType } from '@/schemas/voucher.schema'
import { VoucherSchema } from '@/schemas/voucher.schema'
import handleSubmitCreateVoucher from '@/handlers/handleSubmitCreateVoucher';
import AddCircleIcon from "@mui/icons-material/AddCircle";
import CloseIcon from "@mui/icons-material/Close";
import NewVoucherFormFields from './NewVoucherFormFields';

type Props = {
    open: boolean;
    onClose: () => void;
};

const NewVoucherDialog = ({ open, onClose }: Props) => {
    const defaultValues = {
        recipient_name: "",
        recipient_surname: "",
        recipient_phone: "",
        recipient_email: "",
        buyer_name: "",
        buyer_surname: "",
        buyer_phone: "",
        buyer_email: "",
        initial_balance: 0,
        initial_payment_code: "",
        notes: "",
        expiration_date: new Date(),
    };

    const methods = useForm<VoucherSchemaType>({
        resolver: zodResolver(VoucherSchema),
        defaultValues,
    });

    const onSubmit = async (data: VoucherSchemaType) => {    
        await handleSubmitCreateVoucher(data);
        methods.reset();
        onClose();
      };

    const onCancel = () => {
        methods.reset(defaultValues);
        onClose();
      };

    return (
        <Dialog
            open={open}
            onClose={onCancel}
            maxWidth="md"
            fullWidth
            sx={{
                "& .MuiDialog-container": {
                    alignItems: "flex-start", // 👈 aligns dialog to top instead of center
                },
                "& .MuiPaper-root": {
                    marginTop: "2rem", // 👈 add some spacing from top
                },
            }}
        >
            <DialogTitle>Add Booking</DialogTitle>
            <FormProvider {...methods}>
                <form onSubmit={methods.handleSubmit(onSubmit)} noValidate>
                    <DialogContent sx={{ overflowY: "hidden" }}>
                        <NewVoucherFormFields />
                    </DialogContent>
                    <DialogActions>
                        <Button color="error" onClick={onCancel} startIcon={<CloseIcon />}>
                            Cancel
                        </Button>
                        <Button type="submit" color="success" startIcon={<AddCircleIcon />}>
                            Add Booking
                        </Button>
                    </DialogActions>
                </form>
            </FormProvider>
        </Dialog>
    )
}

export default NewVoucherDialog