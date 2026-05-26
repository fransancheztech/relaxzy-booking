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

  const abortRef = useRef<AbortController | null>(null);

  const fetchBookings = useCallback(async (silent = false) => {
    if (!start || !end) return;

    // Cancel any in-flight request — last navigation wins
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    if (!silent) setLoading(true);
    try {
      const res = await fetch(
        `/api/bookings/range?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`,
        { signal: controller.signal },
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
      if (err.name === "AbortError") return; // superseded by a newer navigation, discard
      setFetchError(err.message ?? "Unknown error");
    } finally {
      if (!silent && !controller.signal.aborted) setLoading(false);
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
    let opened = false;

    const scheduleRefetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetchBookingsRef.current(true), 250);
    };

    evtSource.onmessage = scheduleRefetch;

    // SSE only delivers live events — anything that happens while the connection is
    // dropped (device asleep, screen locked, network blip) is lost. Refetch on
    // reconnect, and on wake, to catch up on whatever was missed. Skip the first
    // open since the initial fetch already covers it.
    evtSource.onopen = () => {
      if (opened) scheduleRefetch();
      opened = true;
    };
    evtSource.onerror = () => console.warn("SSE connection lost, retrying...");

    const onVisible = () => {
      if (document.visibilityState === "visible") scheduleRefetch();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      document.removeEventListener("visibilitychange", onVisible);
      evtSource.close();
    };
  }, []);

  return { bookings, loading, fetchError };
}
