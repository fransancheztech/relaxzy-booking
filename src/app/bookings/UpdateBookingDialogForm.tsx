"use client";

import handleSubmitUpdateBooking from "@/handlers/handleSubmitUpdateBooking";
import {
  BookingUpdateSchema,
  BookingUpdateSchemaType,
} from "@/schemas/booking.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import { FormProvider, useForm } from "react-hook-form";
import UpdateBookingFormFields from "./UpdateBookingFormFields";
import SaveIcon from "@mui/icons-material/Save";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import { useEffect, useState } from "react";
import DialogDeletion from "@/app/bookings/ConfirmDeleteBookingDialog";
import handleDeleteBooking from "@/handlers/handleDeleteBooking";
import { DateTime } from "luxon";
import PayBookingDialog from "./PayBookingDialogForm";
import ManagePaymentsDialog from "@/components/ManagePaymentsDialog";
import { useTranslations } from "next-intl";
import { useRole } from "@/hooks/useRole";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";

type Props = {
  open: boolean;
  onClose: () => void;
  bookingId: string;
};

export const defaultValuesUpdateBookingForm: Partial<BookingUpdateSchemaType> =
  {
    client_name: "",
    client_surname: "",
    client_phone: "",
    client_email: "",
    start_time: null,
    duration: undefined,
    service_name: "",
    therapist_id: "",
    therapist_requested: false,
    notes: "",
    price: undefined,
    status: "",
  };

const UpdateBookingDialogForm = ({ open, onClose, bookingId }: Props) => {
  const t = useTranslations("BookingForm");
  const tCommon = useTranslations("Common");
  const { isTherapist } = useRole();

  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] =
    useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isManagePaymentsDialogOpen, setIsManagePaymentsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { submitting, guard } = useSubmitGuard();
  const [paymentSummary, setPaymentSummary] = useState({
    totalPrice: 0,
    paidCash: 0,
    paidCard: 0,
    paidVoucher: 0,
    totalPaid: 0,
    remainingBalance: 0,
  });
  const [clientNotes, setClientNotes] = useState<string | null>(null);

  const methods = useForm<BookingUpdateSchemaType>({
    resolver: zodResolver(BookingUpdateSchema),
    defaultValues: defaultValuesUpdateBookingForm,
  });

  const price = methods.watch("price");

  const reloadPaymentsSummary = async () => {
    if (!bookingId) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch booking");

      const booking = await res.json();

      const totalPrice = Number(booking.price ?? 0);
      const paidCash = Number(booking.paidCash ?? 0);
      const paidCard = Number(booking.paidCard ?? 0);
      const paidVoucher = Number(booking.paidVoucher ?? 0);
      const totalPaid = paidCash + paidCard + paidVoucher;
      const remainingBalance = totalPrice - totalPaid;

      setPaymentSummary({
        totalPrice,
        paidCash,
        paidCard,
        paidVoucher,
        totalPaid,
        remainingBalance,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !bookingId) return;

    const loadBooking = async () => {
      try {
        methods.reset(defaultValuesUpdateBookingForm);
        setLoading(true);
        const res = await fetch(`/api/bookings/${bookingId}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to load booking");
        const data = await res.json();

        const start = data.start_time
          ? DateTime.fromISO(data.start_time)
          : null;

        const end = data.end_time ? DateTime.fromISO(data.end_time) : null;

        methods.reset({
          client_name: data.client?.name ?? "",
          client_surname: data.client?.surname ?? "",
          client_email: data.client?.email ?? "",
          client_phone: data.client?.phone ?? "",
          start_time: data.start_time ? new Date(data.start_time) : null,
          duration: start && end ? end.diff(start, "minutes").minutes : 0,
          service_name: data.services_names?.name ?? "",
          therapist_id: data.therapist?.id ?? "",
          therapist_requested: !!data.therapist_requested,
          notes: data.notes ?? "",
          price: data.price ?? undefined,
          status: data.status,
        });
        setClientNotes(data.client?.notes ?? null);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadBooking();
  }, [open, bookingId]);

  useEffect(() => {
    if (isPaymentDialogOpen) return;
    reloadPaymentsSummary();
  }, [isPaymentDialogOpen, bookingId]);

  const onSubmit = (data: BookingUpdateSchemaType) =>
    guard(async () => {
      if (!bookingId) return;

      const normalizedData = {
        ...data,
        client_email: data.client_email?.trim() || undefined,
      };

      await handleSubmitUpdateBooking({
        ...normalizedData,
        id: bookingId,
      });
      methods.reset();
      reloadPaymentsSummary();
      onClose();
    });

  const onCancel = () => {
    methods.reset();
    onClose();
  };

  const handleDelete = () => {
    handleDeleteBooking(bookingId);
    methods.reset();
    setIsConfirmDeleteDialogOpen(false);
    onClose();
  };

  const onPaymentSuccess = () => {
    reloadPaymentsSummary();
  };

  return (
    <>
      <Dialog open={open} onClose={onCancel} maxWidth="md" fullWidth>
        <DialogTitle>{t("updateBooking")}</DialogTitle>
        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit)} noValidate>
            <DialogContent
              sx={{
                overflowY: "hidden",
                opacity: loading ? 0.5 : 1,
                pointerEvents: loading ? "none" : "auto",
                ...(isTherapist && {
                  "& .MuiInputBase-input.Mui-disabled": { WebkitTextFillColor: "rgba(0,0,0,0.87)" },
                  "& .MuiSelect-select.Mui-disabled": { WebkitTextFillColor: "rgba(0,0,0,0.87)" },
                  "& .MuiInputLabel-root.Mui-disabled": { color: "rgba(0,0,0,0.6)" },
                }),
              }}
            >
              <UpdateBookingFormFields
                bookingId={bookingId}
                setIsPaymentDialogOpen={setIsPaymentDialogOpen}
                setIsManagePaymentsDialogOpen={setIsManagePaymentsDialogOpen}
                paymentSummary={paymentSummary}
                readOnly={isTherapist}
                clientNotes={clientNotes}
                onClientPicked={(notes) => setClientNotes(notes)}
              />
            </DialogContent>
            <DialogActions
              sx={{ display: "flex", justifyContent: "space-between" }}
            >
              {!isTherapist && (
                <Button
                  startIcon={<DeleteIcon />}
                  color="error"
                  variant="outlined"
                  onClick={() => setIsConfirmDeleteDialogOpen(true)}
                  disabled={submitting}
                >
                  {tCommon("delete")}
                </Button>
              )}
              <Container sx={{ display: "flex", justifyContent: "flex-end" }}>
                <Button startIcon={<CloseIcon />} onClick={onCancel} disabled={submitting}>
                  {tCommon("cancel")}
                </Button>
                {!isTherapist && (
                  <Button startIcon={<SaveIcon />} color="success" type="submit" disabled={submitting}>
                    {tCommon("saveChanges")}
                  </Button>
                )}
              </Container>
            </DialogActions>
          </form>
        </FormProvider>
        {loading && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            <CircularProgress />
          </div>
        )}
      </Dialog>
      <PayBookingDialog
        open={isPaymentDialogOpen}
        onClose={() => setIsPaymentDialogOpen(false)}
        bookingId={bookingId}
        price={price ?? 0}
        paidCash={paymentSummary.paidCash}
        paidCard={paymentSummary.paidCard}
        paidVoucher={paymentSummary.paidVoucher}
        onPaymentSuccess={onPaymentSuccess}
      />

      <ManagePaymentsDialog
        open={isManagePaymentsDialogOpen}
        onClose={() => setIsManagePaymentsDialogOpen(false)}
        bookingId={bookingId}
        onPaymentChanged={reloadPaymentsSummary}
      />

      <DialogDeletion
        confirmDeleteOpen={isConfirmDeleteDialogOpen}
        setConfirmDeleteOpen={setIsConfirmDeleteDialogOpen}
        handleDelete={handleDelete}
        clientName={[methods.watch("client_name"), methods.watch("client_surname")].filter(Boolean).join(" ")}
      />
    </>
  );
};

export default UpdateBookingDialogForm;
