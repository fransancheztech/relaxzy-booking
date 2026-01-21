"use client";

import { useEffect, useState, useRef } from "react";
import debounce from "lodash.debounce";
import { useLayout } from "../context/LayoutContext";
import { toast } from "react-toastify";
import NewBookingDialogForm from "@/components/Dialogs/NewBooking/DialogForm";
import ConfirmDeleteBookingDialog from "./dialogs/ConfirmDeleteBookingDialog";
import { BookingsTable } from "./BookingsTable";
import { BookingListItem } from "@/types/bookings";
import UpdateBookingDialogForm from "../../components/Dialogs/UpdateBooking/DialogForm";
import { FETCH_LIMIT } from "@/constants";

export default function BookingsPage() {
  const { setButtonLabel, setOnButtonClick } = useLayout();

  const [bookings, setBookings] = useState<BookingListItem[]>([]);
  const [page, setPage] = useState(0);
  const [rowCount, setRowCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    null,
  );
  const [isOpenNewBookingDialog, setIsOpenNewBookingDialog] = useState(false);
  const [isOpenEditBookingDialog, setIsOpenEditBookingDialog] = useState(false);
  const [isOpenConfirmDelete, setIsOpenConfirmDelete] = useState(false);
  const [sortModel, setSortModel] = useState<{
    field: string;
    sort: "asc" | "desc";
  }>({
    field: "start_time",
    sort: "desc",
  });

  // -------------------------------
  // Load bookings
  // -------------------------------
  async function loadBookings(
    pageToLoad: number,
    sort = sortModel,
    search = searchTerm,
  ) {
    try {
      setLoading(true);
      setFetchError(null);

      const res = await fetch("/api/bookings/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: pageToLoad,
                  limit: FETCH_LIMIT,
                  searchTerm: search,
                  sort, }),
      });

      if (!res.ok) {
        console.error("Failed to load bookings");
        return;
      }

      const data = await res.json();
      setBookings(data.rows);
      setRowCount(data.total);
      setPage(pageToLoad);
      setSortModel(sort);
    } catch (err) {
      console.error(err);
      setBookings([]);
      setRowCount(0);
      setFetchError("Error loading bookings");
    } finally {
      setLoading(false);
    }
  }

  // -------------------------------
  // Debounced search
  // -------------------------------
  const debouncedSearch = useRef(
    debounce(async (text: string) => {
      try {
        setLoading(true);
        setFetchError(null);

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
      } catch (err) {
        console.error(err);
        setBookings([]);
        setRowCount(0);
        setFetchError("Error searching bookings");
      } finally {
        setLoading(false);
      }
    }, 300),
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
      <BookingsTable
        bookings={bookings}
        rowCount={rowCount}
        page={page}
        loadBookings={loadBookings}
        debouncedSearch={debouncedSearch}
        setSelectedBookingId={setSelectedBookingId}
        setIsOpenEditBookingDialog={setIsOpenEditBookingDialog}
        setIsOpenConfirmDelete={setIsOpenConfirmDelete}
        loading={loading}
        fetchError={fetchError}
      />
      <NewBookingDialogForm
        open={isOpenNewBookingDialog}
        onClose={closeNewDialog}
      />
      <UpdateBookingDialogForm
        open={isOpenEditBookingDialog}
        onClose={closeEditDialog}
        bookingId={selectedBookingId!}
      />
      <ConfirmDeleteBookingDialog
        open={isOpenConfirmDelete}
        onClose={closeDeleteDialog}
        onConfirm={onConfirmDelete}
      />
    </main>
  );
}
