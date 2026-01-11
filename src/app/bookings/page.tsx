'use client'

import { useEffect, useState } from "react";
import { useLayout } from "../context/LayoutContext";
import NewBookingDialogForm from "@/components/Dialogs/NewBooking/DialogForm";

const BookingsPage = () => {
  const { setButtonLabel, setOnButtonClick } = useLayout();
  const [isOpenDialogFormNewBooking, setIsOpenDialogFormNewBooking] =
    useState(false);

  useEffect(() => {
    setButtonLabel("New Booking");
    setOnButtonClick(
      () => () => setIsOpenDialogFormNewBooking((prev) => !prev)
    );
    return () => {
      setButtonLabel("");
      setOnButtonClick(null);
    };
  }, [setButtonLabel, setOnButtonClick, setIsOpenDialogFormNewBooking]);

  return (
    <main>
      <div>BookingsPage</div>
      <NewBookingDialogForm
        open={isOpenDialogFormNewBooking}
        onClose={() => setIsOpenDialogFormNewBooking(false)}
      />
    </main>
  );
};

export default BookingsPage;
