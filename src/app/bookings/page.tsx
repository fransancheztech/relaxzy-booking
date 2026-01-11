"use client";

import { useEffect, useState, useRef } from "react";
import debounce from "lodash.debounce";
import { useLayout } from "../context/LayoutContext";
import { toast } from "react-toastify";
import { bookings as BookingType } from "generated/prisma/client";
import NewBookingDialogForm from "@/components/Dialogs/NewBooking/DialogForm";
import EditBookingDialogForm from "./dialogs/EditBookingDialogForm";
import ConfirmDeleteBookingDialog from "./dialogs/ConfirmDeleteBookingDialog";
import { BookingsTable } from "./BookingsTable";
export default function BookingsPage() {
  const { setButtonLabel, setOnButtonClick } = useLayout();

  const [bookings, setBookings] = useState<BookingType[]>([]);
  const [page, setPage] = useState(0);
  const [rowCount, setRowCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [isOpenNewBookingDialog, setIsOpenNewBookingDialog] = useState(false);
  const [isOpenEditBookingDialog, setIsOpenEditBookingDialog] = useState(false);
  const [isOpenConfirmDelete, setIsOpenConfirmDelete] = useState(false);

  // -------------------------------
  // Load bookings
  // -------------------------------
  async function loadBookings(pageToLoad: number) {
    const res = await fetch("/api/bookings/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ searchTerm: "" }),
    });

    if (!res.ok) {
      console.error("Failed to load bookings");
      return;
    }

    const data = await res.json();
    setBookings(data);
    setRowCount(data.length);
    setPage(pageToLoad);
    setIsSearching(false);
  }

  // -------------------------------
  // Debounced search
  // -------------------------------
  const debouncedSearch = useRef(
    debounce(async (text: string) => {
      const res = await fetch("/api/bookings/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchTerm: text }),
      });

      if (!res.ok) {
        console.error("Search failed");
        return;
      }

      const data = await res.json();
      setBookings(data);
      setRowCount(data.length);
      setIsSearching(!!text);
    }, 300)
  ).current;

  // -------------------------------
  // Delete booking
  // -------------------------------
  const handleDelete = async (id: string) => {
    try {
      if (!id) return toast.error("Missing booking ID");

      const res = await fetch("/api/bookings/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const result = await res.json();

      if (!res.ok) {
        toast.error(result?.error || "Error deleting booking");
        return;
      }

      toast.success("Booking deleted successfully");

      // Reload list
      setTimeout(() => {
        if (isSearching) debouncedSearch(searchTerm);
        else loadBookings(page);
      }, 300);
    } catch (err) {
      console.error("Error deleting booking", err);
      toast.error("Network or server error");
    }
  };

  const onConfirmDelete = () => {
    if (selectedBookingId) handleDelete(selectedBookingId);
    setSelectedBookingId(null);
  };

  // -------------------------------
  // Dialog handlers
  // -------------------------------
  const closeNewDialog = () => setIsOpenNewBookingDialog(false);
  const closeEditDialog = () => {
    setIsOpenEditBookingDialog(false);
    setSelectedBookingId(null);
  };
  const closeDeleteDialog = () => {
    setIsOpenConfirmDelete(false);
    setSelectedBookingId(null);
  };

  // -------------------------------
  // Layout button
  // -------------------------------
  useEffect(() => {
    setButtonLabel("New Booking");
    setOnButtonClick(() => () => setIsOpenNewBookingDialog((prev) => !prev));
    return () => {
      setButtonLabel("");
      setOnButtonClick(null);
    };
  }, [setButtonLabel, setOnButtonClick]);

  // Load initial bookings
  useEffect(() => {
    loadBookings(0);
  }, []);

  return (
    <main className="p-4">
      <ConfirmDeleteBookingDialog
        open={isOpenConfirmDelete}
        onClose={closeDeleteDialog}
        onConfirm={onConfirmDelete}
      />

      <NewBookingDialogForm open={isOpenNewBookingDialog} onClose={closeNewDialog} />
      <EditBookingDialogForm
        open={isOpenEditBookingDialog}
        onClose={closeEditDialog}
        bookingId={selectedBookingId}
      />

      <BookingsTable
        bookings={bookings}
        rowCount={rowCount}
        page={page}
        loadBookings={loadBookings}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        debouncedSearch={debouncedSearch}
        setSelectedBookingId={setSelectedBookingId}
        setIsOpenEditBookingDialog={setIsOpenEditBookingDialog}
        setIsOpenConfirmDelete={setIsOpenConfirmDelete}
      />
    </main>
  );
}
