import { BookingSchema, BookingSchemaType } from "@/schemas/booking.schema";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import handleSubmitCreateBooking from "@/handlers/handleSubmitCreateBooking";
import NewBookingFormFields from "./NewBookingFormFields";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import CloseIcon from "@mui/icons-material/Close";
import { roundToNearestMinutes } from "date-fns";
import { useEffect } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
};

const NewBookingDialogForm = ({ open, onClose }: Props) => {
  const defaultValues = {
    client_name: "",
    client_surname: "",
    client_phone: "",
    client_email: "",
    start_time: roundToNearestMinutes(new Date(), { nearestTo: 5 }),
    duration: undefined,
    service_name: "",
    notes: "",
    price: undefined,
    companions: [],
  };

  const methods = useForm<BookingSchemaType>({
    resolver: zodResolver(BookingSchema),
    defaultValues,
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
    methods.reset(defaultValues);
    onClose();
  };

  useEffect(() => {
    methods.reset(defaultValues);
  }, [open]);

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
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        Add Booking
        <Tooltip
          title="Create one booking per person. For couples or groups, create separate bookings and use the Notes field to link them."
          arrow
          placement="right"
        >
          <IconButton size="small" sx={{ color: "info.main" }}>
            <InfoOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </DialogTitle>
      <FormProvider {...methods}>
        <form onSubmit={methods.handleSubmit(onSubmit)} noValidate>
          <DialogContent>
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
    </Dialog>
  );
};

export default NewBookingDialogForm;
