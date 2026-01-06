// hooks/useCalendarData.ts
import { useState, useEffect, useCallback } from "react";
import { DateTime } from "luxon";
import { BookingModel } from "@/types/bookings";
import { AGENDA_LENGTH } from "@/constants";

export type Range = { start: DateTime; end: DateTime };
type CalendarView = "month" | "week" | "day" | "agenda" | "work_week";

export function useCalendarData(date: Date, view: CalendarView) {
  const [bookings, setBookings] = useState<BookingModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");

  const getCurrentRange = useCallback((): Range => {
    const base = DateTime.fromJSDate(date);
    let start: DateTime;
    let end: DateTime;

    if (view === "agenda") {
      start = base.startOf("day");
      end = base.plus({ days: AGENDA_LENGTH }).endOf("day");
    } else {
      start = base.startOf(view === "work_week" ? "week" : view);
      end = base.endOf(view === "work_week" ? "week" : view);
    }

    return { start, end };
  }, [date, view]);

  // 🔹 Fetch initial bookings
  const fetchBookings = useCallback(async () => {
    const range = getCurrentRange();
    setLoading(true);

    try {
      const response = await fetch(
        `/api/bookings/range?start=${encodeURIComponent(
          range.start.toISO()!
        )}&end=${encodeURIComponent(range.end.toISO()!)}`
      );
      if (!response.ok) throw new Error(await response.text());
      const data: BookingModel[] = await response.json();

      //add duration to bookings
      data.map((booking) => {
        const start = new Date(booking.start_time!);
        const end = new Date(booking.end_time!);
        booking.duration = (
          (end.getTime() - start.getTime()) /
          (1000 * 60)
        ).toString();
      });

      setBookings(data);
      setFetchError("");
    } catch (err: any) {
      setFetchError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [getCurrentRange]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // 🔹 Realtime updates via SSE
  useEffect(() => {
    const evtSource = new EventSource("/api/bookings/stream");

    evtSource.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      setBookings((prev) => {
        switch (payload.type) {
          case "INSERT":
            return [...prev, payload.data];
          case "UPDATE":
            return prev.map((b) =>
              b.id === payload.data.id ? payload.data : b
            );
          case "DELETE":
            return prev.filter((b) => b.id !== payload.data.id);
          default:
            return prev;
        }
      });
    };

    evtSource.onerror = () => {
      console.warn("SSE connection lost, retrying...");
    };

    return () => {
      evtSource.close();
    };
  }, []);

  return { bookings, loading, fetchError };
}
