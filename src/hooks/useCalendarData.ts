import { useState, useEffect, useCallback } from "react";
import { BookingModel } from "@/types/bookings";

export function useCalendarData(
  start: Date | null,
  end: Date | null,
  refreshKey: number = 0,
) {
  const [bookings, setBookings] = useState<BookingModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");

  const fetchBookings = useCallback(async () => {
    if (!start || !end) return;
    setLoading(true);
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
      setLoading(false);
    }
  }, [start, end, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Realtime updates via SSE
  useEffect(() => {
    const evtSource = new EventSource("/api/bookings/stream");
    evtSource.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      setBookings((prev) => {
        switch (payload.type) {
          case "INSERT": return [...prev, payload.data];
          case "UPDATE": return prev.map((b) => b.id === payload.data.id ? payload.data : b);
          case "DELETE": return prev.filter((b) => b.id !== payload.data.id);
          default: return prev;
        }
      });
    };
    evtSource.onerror = () => console.warn("SSE connection lost, retrying...");
    return () => evtSource.close();
  }, []);

  return { bookings, loading, fetchError };
}
