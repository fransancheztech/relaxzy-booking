"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useLayout } from "../context/LayoutContext";
import { useTranslations } from "next-intl";
import NewBookingDialogForm from "@/app/bookings/NewBookingDialogForm";
import { BookingsTable } from "./BookingsTable";
import { BookingListItem } from "@/types/bookings";
import UpdateBookingDialogForm from "@/app/bookings/UpdateBookingDialogForm";
import { FETCH_LIMIT } from "@/constants";
import { GridFilterItem, GridFilterModel } from "@mui/x-data-grid";

export default function BookingsPage() {
  const { setButtonLabel, setOnButtonClick } = useLayout();
  const t = useTranslations("Bookings");

  const [bookings, setBookings] = useState<BookingListItem[]>([]);
  const [page, setPage] = useState(0);
  const [rowCount, setRowCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [isOpenNewBookingDialog, setIsOpenNewBookingDialog] = useState(false);
  const [isOpenEditBookingDialog, setIsOpenEditBookingDialog] = useState(false);
  const [sortModel, setSortModel] = useState<{ field: string; sort: "asc" | "desc" }>({
    field: "start_time",
    sort: "desc",
  });
  const [filterItems, setFilterItems] = useState<GridFilterItem[]>([]);

  // -------------------------------
  // Load bookings
  // -------------------------------
  const loadBookings = useCallback(async (
    pageToLoad: number,
    sort = sortModel,
    filters = filterItems,
  ) => {
    try {
      setLoading(true);
      setFetchError(null);

      const res = await fetch("/api/bookings/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page: pageToLoad,
          limit: FETCH_LIMIT,
          searchTerm: "",
          sort,
          filterItems: filters,
        }),
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
  }, [sortModel, filterItems]);

  // -------------------------------
  // Realtime subscription — stable, recreated only on mount/unmount
  // -------------------------------
  const loadBookingsRef = useRef(loadBookings);
  loadBookingsRef.current = loadBookings;
  const pageRef = useRef(page);
  pageRef.current = page;
  const sortModelRef = useRef(sortModel);
  sortModelRef.current = sortModel;
  const filterItemsRef = useRef(filterItems);
  filterItemsRef.current = filterItems;

  useEffect(() => {
    const eventSource = new EventSource("/api/bookings/stream");
    eventSource.onmessage = () => {
      loadBookingsRef.current(pageRef.current, sortModelRef.current, filterItemsRef.current);
    };
    return () => eventSource.close();
  }, []);

  // -------------------------------
  // Filter handler
  // -------------------------------
  const handleFilterModelChange = (model: GridFilterModel) => {
    const activeItems = model.items.filter(
      (item) => item.value !== undefined && item.value !== null && item.value !== ""
    );
    setFilterItems(activeItems);
    loadBookings(0, sortModel, activeItems);
  };

  // -------------------------------
  // Dialog handlers
  // -------------------------------
  const closeNewDialog = () => setIsOpenNewBookingDialog(false);
  const closeEditDialog = () => {
    setIsOpenEditBookingDialog(false);
    setSelectedBookingId(null);
  };

  // -------------------------------
  // Layout button
  // -------------------------------
  useEffect(() => {
    setButtonLabel(t("newBooking"));
    setOnButtonClick(() => () => setIsOpenNewBookingDialog((prev) => !prev));
    return () => {
      setButtonLabel("");
      setOnButtonClick(null);
    };
  }, [setButtonLabel, setOnButtonClick, t]);

  // Load initial bookings
  useEffect(() => {
    loadBookings(0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="p-4">
      <BookingsTable
        bookings={bookings}
        rowCount={rowCount}
        page={page}
        loadBookings={loadBookings}
        onFilterModelChange={handleFilterModelChange}
        setSelectedBookingId={setSelectedBookingId}
        setIsOpenEditBookingDialog={setIsOpenEditBookingDialog}
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
    </main>
  );
}
