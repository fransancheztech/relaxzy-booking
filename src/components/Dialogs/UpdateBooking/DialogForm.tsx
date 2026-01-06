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
import UpdateBookingFormFields from "./FormFields";
import SaveIcon from "@mui/icons-material/Save";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import { useEffect, useState } from "react";
import DialogDeletion from "@/components/Dialogs/DeleteBooking/DialogForm";
import handleDeleteBooking from "@/handlers/handleDeleteBooking";
import { DateTime } from "luxon";
import PayBookingDialog from "../PayBooking/DialogForm";

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
    notes: "",
    price: undefined,
    status: "pending",
  };

const DialogForm = ({ open, onClose, bookingId }: Props) => {
  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] =
    useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paymentSummary, setPaymentSummary] = useState({
    totalPrice: 0,
    paidCash: 0,
    paidCard: 0,
    totalPaid: 0,
    remainingBalance: 0,
  });

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
          client_name: data.client.name ?? "",
          client_surname: data.client.surname ?? "",
          client_email: data.client.email ?? "",
          client_phone: data.client.phone ?? "",
          start_time: data.start_time ? new Date(data.start_time) : null,
          duration: start && end ? end.diff(start, "minutes").minutes : 0,
          service_name: data.services_names.name ?? "",
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

  useEffect(() => {
    if (isPaymentDialogOpen) return;
    reloadPaymentsSummary();
  }, [isPaymentDialogOpen, bookingId]);

  const onSubmit = async (data: BookingUpdateSchemaType) => {
    if (!bookingId) return;
    setLoading(true);
    await handleSubmitUpdateBooking({
      ...data,
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
        <DialogTitle>Update Booking</DialogTitle>
        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit)} noValidate>
            <DialogContent
              sx={{
                overflowY: "hidden",
                opacity: loading ? 0.5 : 1,
                pointerEvents: loading ? "none" : "auto",
              }}
            >
              <UpdateBookingFormFields
                setIsPaymentDialogOpen={setIsPaymentDialogOpen}
                paymentSummary={paymentSummary}
              />
            </DialogContent>
            <DialogActions
              sx={{ display: "flex", justifyContent: "space-between" }}
            >
              <Button
                color="error"
                sx={{ gap: 1 }}
                variant="contained"
                onClick={() => setIsConfirmDeleteDialogOpen(true)}
              >
                <DeleteIcon />
                Delete
              </Button>
              <Container sx={{ display: "flex", justifyContent: "flex-end" }}>
                <Button sx={{ color: "error.main", gap: 1 }} onClick={onCancel}>
                  <CloseIcon />
                  Cancel
                </Button>
                <Button type="submit" sx={{ color: "primary.main", gap: 1 }}>
                  <SaveIcon />
                  Save Changes
                </Button>
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
        onPaymentSuccess={onPaymentSuccess}
      />

      <DialogDeletion
        confirmDeleteOpen={isConfirmDeleteDialogOpen}
        setConfirmDeleteOpen={setIsConfirmDeleteDialogOpen}
        handleDelete={handleDelete}
      />
    </>
  );
};

export default DialogForm;
