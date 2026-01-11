import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
} from "@mui/material";
import { useForm, FormProvider } from "react-hook-form";
import { BookingUpdateSchemaType } from "@/schemas/booking.schema";
import UpdateBookingFormFields from "@/components/Dialogs/UpdateBooking/FormFields";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";
import handleSubmitUpdateBooking from "@/handlers/handleSubmitUpdateBooking";

type Props = {
  open: boolean;
  onClose: () => void;
  bookingId: string | null;
};

const defaultValues: Partial<BookingUpdateSchemaType> = {
  client_name: "",
  client_surname: "",
  client_email: "",
  client_phone: "",
  start_time: null,
  duration: 0,
  service_name: "",
  notes: "",
  price: undefined,
  status: "pending",
};

const EditBookingDialogForm = ({ open, onClose, bookingId }: Props) => {
  const [loading, setLoading] = useState(false);

  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

  const [paymentSummary, setPaymentSummary] = useState({
    totalPrice: 0,
    paidCash: 0,
    paidCard: 0,
    totalPaid: 0,
    remainingBalance: 0,
  });

  const reloadPaymentsSummary = async () => {
    if (!bookingId) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to fetch booking");

      const booking = await res.json();

      const totalPrice = booking.price ?? 0;
      const paidCash = booking.paidCash ?? 0;
      const paidCard = booking.paidCard ?? 0;
      const totalPaid = paidCash + paidCard;
      const remainingBalance = totalPrice - totalPaid;

      setPaymentSummary({
        totalPrice,
        paidCash,
        paidCard,
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
    if (isPaymentDialogOpen) return;
    reloadPaymentsSummary();
  }, [isPaymentDialogOpen, bookingId]);

  const onPaymentSuccess = () => {
    reloadPaymentsSummary();
  };

  const methods = useForm<BookingUpdateSchemaType>({
    defaultValues,
  });

  useEffect(() => {
    if (!open || !bookingId) return;

    const loadBooking = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/bookings/${bookingId}`);
        if (!res.ok) throw new Error("Failed to fetch booking");
        const data = await res.json();
        methods.reset({
          client_name: data.client?.name ?? "",
          client_surname: data.client?.surname ?? "",
          client_email: data.client?.email ?? "",
          client_phone: data.client?.phone ?? "",
          start_time: data.start_time ? new Date(data.start_time) : null,
          duration: data.duration ?? 0,
          service_name: data.services_names?.name ?? "",
          notes: data.notes ?? "",
          price: data.price ?? undefined,
          status: data.status,
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadBooking();
  }, [open, bookingId]);

  const onSubmit = async (data: BookingUpdateSchemaType) => {
    if (!bookingId) return;

    // Normalize client_email: trim and convert empty string to undefined
    const normalizedData = {
      ...data,
      client_email: data.client_email?.trim() || undefined,
    };

    setLoading(true);
    await handleSubmitUpdateBooking({
      ...normalizedData,
      id: bookingId,
    });
    methods.reset();
    reloadPaymentsSummary();
    setLoading(false);
    onClose();
  };

  const onCancel = () => {
    methods.reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="md" fullWidth>
      <DialogTitle>Edit Booking</DialogTitle>
      <FormProvider {...methods}>
        <form onSubmit={methods.handleSubmit(onSubmit)} noValidate>
          <DialogContent
            sx={{
              opacity: loading ? 0.5 : 1,
              pointerEvents: loading ? "none" : "auto",
            }}
          >
            <UpdateBookingFormFields
                paymentSummary={paymentSummary}
                setIsPaymentDialogOpen={setIsPaymentDialogOpen}
            />
          </DialogContent>
          <DialogActions sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Button startIcon={<CloseIcon />} onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" startIcon={<SaveIcon />}>
              Save Changes
            </Button>
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
  );
};

export default EditBookingDialogForm;
