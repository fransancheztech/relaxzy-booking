"use client";

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
import ClientConflictDialog from "./ClientConflictDialog";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import CloseIcon from "@mui/icons-material/Close";
import { roundToNearestMinutes } from "date-fns";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";
import type { ClientConflict, ClientResolution } from "@/types/clientConflict";

type Props = {
  open: boolean;
  onClose: () => void;
};

const NewBookingDialogForm = ({ open, onClose }: Props) => {
  const t = useTranslations("BookingForm");
  const tCommon = useTranslations("Common");

  const defaultValues = {
    client_name: "",
    client_surname: "",
    client_phone: "",
    client_email: "",
    start_time: roundToNearestMinutes(new Date(), { nearestTo: 5 }),
    duration: undefined,
    service_name: "",
    therapist_id: "",
    therapist_requested: false,
    notes: "",
    price: undefined,
    companions: [],
  };

  const methods = useForm<BookingSchemaType>({
    resolver: zodResolver(BookingSchema),
    defaultValues,
  });

  const { submitting, guard } = useSubmitGuard();

  // Pending submission held while the receptionist resolves a name conflict.
  const [conflicts, setConflicts] = useState<ClientConflict[]>([]);
  const [pendingData, setPendingData] = useState<BookingSchemaType | null>(null);

  const submit = async (
    data: BookingSchemaType,
    clientResolutions?: Record<string, ClientResolution>,
  ) => {
    const normalizedData = {
      ...data,
      client_email: data.client_email?.trim() || undefined,
    };
    const result = await handleSubmitCreateBooking(normalizedData, clientResolutions);

    if (result.status === "ok") {
      setConflicts([]);
      setPendingData(null);
      methods.reset();
      onClose();
      return;
    }
    if (result.status === "conflict") {
      setPendingData(data);
      setConflicts(result.conflicts);
      return;
    }
    if (result.status === "contact_taken") {
      toast.error(t("conflictContactTaken"));
      return;
    }
    // "error" — already surfaced by the handler; keep the form open.
  };

  const onSubmit = (data: BookingSchemaType) => guard(() => submit(data));

  const onResolveConflict = (resolutions: Record<string, ClientResolution>) =>
    guard(() => pendingData ? submit(pendingData, resolutions) : Promise.resolve());

  const onCancel = () => {
    setConflicts([]);
    setPendingData(null);
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
          alignItems: "flex-start",
        },
        "& .MuiDialog-paper": {
          marginTop: "2rem",
        },
      }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        {t("addBooking")}
        <Tooltip title={t("tooltipInfo")} arrow placement="right">
          <IconButton size="small" sx={{ color: "info.main" }}>
            <InfoOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </DialogTitle>
      <FormProvider {...methods}>
        <form onSubmit={methods.handleSubmit(onSubmit)} noValidate>
          <DialogContent>
            <NewBookingFormFields key={String(open)} />
          </DialogContent>
          <DialogActions>
            <Button onClick={onCancel} startIcon={<CloseIcon />} disabled={submitting}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" color="success" startIcon={<AddCircleIcon />} disabled={submitting}>
              {t("addBooking")}
            </Button>
          </DialogActions>
        </form>
      </FormProvider>

      <ClientConflictDialog
        open={conflicts.length > 0}
        conflicts={conflicts}
        submitting={submitting}
        onCancel={() => setConflicts([])}
        onResolve={onResolveConflict}
      />
    </Dialog>
  );
};

export default NewBookingDialogForm;
