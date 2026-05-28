"use client";

import { zodResolver } from '@hookform/resolvers/zod';
import { Button, DialogActions, DialogContent, DialogContentText, Dialog, DialogTitle } from '@mui/material'
import { FormProvider, useForm } from 'react-hook-form'
import { VoucherSchemaInput, VoucherSchemaType } from '@/schemas/voucher.schema'
import { VoucherSchema } from '@/schemas/voucher.schema'
import handleSubmitCreateVoucher from '@/handlers/handleSubmitCreateVoucher';
import AddCircleIcon from "@mui/icons-material/AddCircle";
import CloseIcon from "@mui/icons-material/Close";
import NewVoucherFormFields from './NewVoucherFormFields';
import { useTranslations } from "next-intl";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";
import { useRef, useState } from "react";

/**
 * A voucher is missing contact info only when there is no phone or email saved
 * anywhere on it — neither on the buyer nor on the recipient. A single contact on
 * either party is enough to reach the voucher, so that case does not warn.
 */
function isContactMissing(data: VoucherSchemaType): boolean {
    const hasAnyContact = !!(
        data.buyer_phone?.trim() ||
        data.buyer_email?.trim() ||
        data.recipient_phone?.trim() ||
        data.recipient_email?.trim()
    );
    return !hasAnyContact;
}

type Props = {
    open: boolean;
    onClose: () => void;
};

const NewVoucherDialog = ({ open, onClose }: Props) => {
    const t = useTranslations("Vouchers");
    const tCommon = useTranslations("Common");
    const defaultValues: VoucherSchemaInput = {
        recipient_name: "",
        recipient_surname: "",
        recipient_phone: "",
        recipient_email: "",
        buyer_name: "",
        buyer_surname: "",
        buyer_phone: "",
        buyer_email: "",
        initial_balance: "",
        payment_method: "credit_card",
        notes: "",
        source: "physical",
        external_reference: "",
        expiration_date: new Date(Date.now() + 183 * 24 * 60 * 60 * 1000),
        created_at: new Date(),
    };

    const methods = useForm<VoucherSchemaInput, any, VoucherSchemaType>({
        resolver: zodResolver(VoucherSchema),
        defaultValues,
    });

    const { submitting, guard } = useSubmitGuard();

    const [confirmOpen, setConfirmOpen] = useState(false);
    const pendingDataRef = useRef<VoucherSchemaType | null>(null);

    const createVoucher = (data: VoucherSchemaType) =>
      guard(async () => {
        await handleSubmitCreateVoucher(data);
        methods.reset();
        onClose();
      });

    const onSubmit = (data: VoucherSchemaType) => {
        // Contact info isn't enforced, but warn before creating a voucher without it.
        if (isContactMissing(data)) {
            pendingDataRef.current = data;
            setConfirmOpen(true);
            return;
        }
        return createVoucher(data);
    };

    const handleConfirmProceed = () => {
        setConfirmOpen(false);
        const data = pendingDataRef.current;
        pendingDataRef.current = null;
        if (data) createVoucher(data);
    };

    const handleConfirmCancel = () => {
        setConfirmOpen(false);
        pendingDataRef.current = null;
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
                "& .MuiDialog-paper": {
                    marginTop: "2rem", // 👈 add some spacing from top
                },
            }}
        >
            <DialogTitle>{t("newVoucher")}</DialogTitle>
            <FormProvider {...methods}>
                <form onSubmit={methods.handleSubmit(onSubmit)} noValidate>
                    <DialogContent>
                        <NewVoucherFormFields />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={onCancel} startIcon={<CloseIcon />} disabled={submitting}>
                            {tCommon("cancel")}
                        </Button>
                        <Button type="submit" color="success" startIcon={<AddCircleIcon />} disabled={submitting}>
                            {t("createVoucher")}
                        </Button>
                    </DialogActions>
                </form>
            </FormProvider>

            <Dialog open={confirmOpen} onClose={handleConfirmCancel} maxWidth="xs" fullWidth>
                <DialogTitle>{t("noContactConfirmTitle")}</DialogTitle>
                <DialogContent>
                    <DialogContentText>{t("noContactConfirmMessage")}</DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleConfirmCancel} disabled={submitting}>
                        {tCommon("cancel")}
                    </Button>
                    <Button
                        onClick={handleConfirmProceed}
                        color="warning"
                        variant="contained"
                        disabled={submitting}
                    >
                        {t("noContactConfirmProceed")}
                    </Button>
                </DialogActions>
            </Dialog>
        </Dialog>
    )
}

export default NewVoucherDialog