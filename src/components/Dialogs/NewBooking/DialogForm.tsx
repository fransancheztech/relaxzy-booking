import { BookingSchema, BookingSchemaType } from "@/schemas/booking.schema";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  TextField,
} from "@mui/material";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import handleSubmitCreateBooking from "@/handlers/handleSubmitCreateBooking";
import NewBookingFormFields from "./FormFields";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import CloseIcon from "@mui/icons-material/Close";
import ClientSearch from "@/app/calendar/ClientSearch";
import { useSimilarClients } from "@/hooks/useSimilarClients";
import { roundToNearestMinutes } from "date-fns";

type Props = {
  open: boolean;
  onClose: () => void;
};

const DialogForm = ({ open, onClose }: Props) => {
  const methods = useForm<BookingSchemaType>({
    resolver: zodResolver(BookingSchema),
    defaultValues: {
      client_name: "",
      client_surname: "",
      client_phone: "",
      client_email: "",
      start_time: roundToNearestMinutes(new Date(), { nearestTo: 5 }),
      duration: undefined,
      service_name: "",
      notes: "",
      price: undefined,
    },
  });

  const watchedValues = useWatch({
    control: methods.control,
    name: ["client_name", "client_surname", "client_email", "client_phone"],
  });

  const { clients, loading, error } = useSimilarClients({
    client_name: watchedValues[0],
    client_surname: watchedValues[1],
    client_email: watchedValues[2],
    client_phone: watchedValues[3],
  });

  const onSubmit = async (data: BookingSchemaType) => {
    // Normalize client_email
    const normalizedData = {
      ...data,
      client_email: data.client_email?.trim() || undefined,
    };

    await handleSubmitCreateBooking(normalizedData);
    methods.reset();
    onClose();
  };

  const onCancel = () => {
    methods.reset();
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
            <NewBookingFormFields />
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
      <ClientSearch
        setValue={methods.setValue}
        clients={clients}
        loading={loading}
        error={error}
      />
    </Dialog>
  );
};

export default DialogForm;
