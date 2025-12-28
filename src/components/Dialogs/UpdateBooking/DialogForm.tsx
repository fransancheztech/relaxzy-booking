import handleSubmitUpdateBooking from "@/handlers/handleSubmitUpdateBooking";
import { BookingUpdateSchema, BookingUpdateSchemaType } from "@/schemas/booking.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Container, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import { FormProvider, useForm } from "react-hook-form"
import UpdateBookingFormFields from "./FormFields";
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import { useState } from "react";
import DialogDeletion from "@/components/DialogDeletion";
import handleDeleteBooking from "@/handlers/handleDeleteBooking";


type Props = {
  open: boolean;
  onClose: () => void;
  bookingId: string;
};

const DialogForm = ({ open, onClose, bookingId }: Props) => {
  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = useState(false);

  const methods = useForm<BookingUpdateSchemaType>({
    resolver: zodResolver(BookingUpdateSchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
    defaultValues: {
      client_name: '',
      client_surname: '',
      client_phone: '',
      client_email: '',
      start_time: null,
      duration: undefined,
      service_name: '',
      notes: '',
      price: undefined,
      status: 'pending',
      paidCash: 0,
      paidCard: 0,
    },
  })

  const onSubmit = async (data: BookingUpdateSchemaType) => {
    if (!bookingId) return;

    await handleSubmitUpdateBooking({
      ...data,
      id: bookingId
    });
    methods.reset();
    onClose();
  };

  const onCancel = () => {
    methods.reset();
    onClose();
  }

  const handleDelete = () => {
    handleDeleteBooking(bookingId)
    methods.reset();
    setIsConfirmDeleteDialogOpen(false)
    onClose()
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={onCancel}
        maxWidth='md'
        fullWidth
        sx={{
          '& .MuiDialog-container': {
            alignItems: 'flex-start' // 👈 aligns dialog to top instead of center
          },
          '& .MuiPaper-root': {
            marginTop: '2rem' // 👈 add some spacing from top
          }
        }}
      >
        <DialogTitle>Update Booking</DialogTitle>
        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit)} noValidate>
            <DialogContent sx={{ overflowY: 'hidden' }}>
              <UpdateBookingFormFields />
            </DialogContent>
            <DialogActions sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button
                color='error'
                sx={{ gap: 1 }}
                variant='contained'
                onClick={() => setIsConfirmDeleteDialogOpen(true)}>
                <DeleteIcon />
                Delete
              </Button>
              <Container sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  sx={{ color: 'error.main', gap: 1 }}
                  onClick={onCancel}>
                  <CloseIcon />
                  Cancel
                </Button>
                <Button type="submit" sx={{ color: 'primary.main', gap: 1 }}>
                  <SaveIcon />
                  Save Changes
                </Button>
              </Container>
            </DialogActions>
          </form>
        </FormProvider>
      </Dialog>
      <DialogDeletion
        confirmDeleteOpen={isConfirmDeleteDialogOpen}
        setConfirmDeleteOpen={setIsConfirmDeleteDialogOpen}
        handleDelete={handleDelete}
      />
    </>
  )
}

export default DialogForm