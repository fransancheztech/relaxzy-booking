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
    paidCash: 0,
    paidCard: 0,
  };

const DialogForm = ({ open, onClose, bookingId }: Props) => {
  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] =
    useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

  const [loading, setLoading] = useState(false);

  const methods = useForm<BookingUpdateSchemaType>({
    resolver: zodResolver(BookingUpdateSchema),
    defaultValues: defaultValuesUpdateBookingForm,
  });

  const paidCash = methods.watch("paidCash");
  const paidCard = methods.watch("paidCard");
  const price = methods.watch("price");

  useEffect(() => {
    if (!open || !bookingId) return;

    const loadBooking = async () => {
      try {
        methods.reset(defaultValuesUpdateBookingForm);
        setLoading(true);
        const res = await fetch(`/api/bookings/${bookingId}`);
        if (!res.ok) throw new Error("Failed to load booking");
        const data = await res.json();

        const start = DateTime.fromJSDate(new Date("2025-12-31T10:00:00"));
        const end = DateTime.fromJSDate(new Date("2025-12-31T11:30:00"));

        methods.reset({
          client_name: data.client.name ?? "",
          client_surname: data.client.surname ?? "",
          client_email: data.client.email ?? "",
          client_phone: data.client.phone ?? "",
          start_time: data.start_time ? new Date(data.start_time) : null,
          duration: end.diff(start, "minutes").minutes,
          service_name: data.service.name ?? "",
          notes: data.notes ?? "",
          price: data.price ?? undefined,
          status: data.status,
          paidCash: data.paidCash ?? 0,
          paidCard: data.paidCard ?? 0,
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
      // Payment dialog just closed, update price/paid fields without overwriting everything
      const reloadBooking = async () => {
        if (!bookingId) return;
        setLoading(true);
        try {
          const res = await fetch(`/api/bookings/${bookingId}`);
          if (!res.ok) throw new Error("Failed to load booking");
          const data = await res.json();

          // Only reset the numeric fields so the form stays valid
          methods.reset();
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      };

      reloadBooking();
    }, [isPaymentDialogOpen, bookingId]);

  const onSubmit = async (data: BookingUpdateSchemaType) => {
    if (!bookingId) return;
    setLoading(true);
    await handleSubmitUpdateBooking({
      ...data,
      id: bookingId,
    });
    methods.reset();
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
        paidCash={paidCash ?? 0}
        paidCard={paidCard ?? 0}
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
