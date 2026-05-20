import { useState, useEffect, useCallback, useRef } from "react";
import { BookingModel } from "@/types/bookings";

export function useCalendarData(
  start: Date | null,
  end: Date | null,
  refreshKey: number = 0,
) {
  const [bookings, setBookings] = useState<BookingModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");

  const fetchBookings = useCallback(async (silent = false) => {
    if (!start || !end) return;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(
        `/api/bookings/range?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`
      );
      if (!res.ok) throw new Error(await res.text());
      const data: BookingModel[] = await res.json();
      data.forEach((b) => {
        const s = new Date(b.start_time!);
        const e = new Date(b.end_time!);
        b.duration = ((e.getTime() - s.getTime()) / 60000).toString();
      });
      setBookings(data);
      setFetchError("");
    } catch (err: any) {
      setFetchError(err.message ?? "Unknown error");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [start, end, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Keep a ref to the latest fetchBookings so the SSE handler always uses the current range
  const fetchBookingsRef = useRef(fetchBookings);
  useEffect(() => {
    fetchBookingsRef.current = fetchBookings;
  }, [fetchBookings]);

  // Realtime updates via SSE — refetch the range so joined display fields stay correct.
  // The raw stream payload lacks client/service joins, so merging it directly would
  // render incomplete event blocks; a debounced refetch keeps the data shape consistent.
  useEffect(() => {
    const evtSource = new EventSource("/api/bookings/stream");
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    evtSource.onmessage = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetchBookingsRef.current(true), 250);
    };
    evtSource.onerror = () => console.warn("SSE connection lost, retrying...");

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      evtSource.close();
    };
  }, []);

  return { bookings, loading, fetchError };
}
