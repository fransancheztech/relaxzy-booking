"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Calendar, luxonLocalizer, View } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { DateTime, Settings } from "luxon";
import CircularProgress from "@mui/material/CircularProgress";
import { useCalendarData } from "@/hooks/useCalendarData";
import { calendarFormats } from "@/utils/dateHelpers";
import { useLayout } from "../context/LayoutContext";

Settings.defaultZone = "Europe/Madrid";
const localizer = luxonLocalizer(DateTime, { firstDayOfWeek: 1 });

interface CalendarUIProps {
  setIsOpenBookingDialog: React.Dispatch<React.SetStateAction<boolean>>;
}

function CalendarUI({setIsOpenBookingDialog}: CalendarUIProps) {
  const [view, setView] = useState<View>("day");
  const [date, setDate] = useState(new Date());

  const {setSelectedBookingId} = useLayout();
  
  useEffect(() => {
    const handler = () => {
      // Simply change date state to trigger your hook re-run
      setDate(new Date(date));
    };
    window.addEventListener("refreshCalendarData", handler);
    return () => window.removeEventListener("refreshCalendarData", handler);
  }, [date]);

  const onView = useCallback((v: View) => setView(v), []);
  const onNavigate = useCallback((d: Date) => setDate(d), []);

  const { bookings, loading, fetchError } = useCalendarData(date, view);

  const { min, max } = useMemo(() => {
    const start = DateTime.now().startOf("day").set({ hour: 10 });
    const end = DateTime.now().startOf("day").set({ hour: 22 });
    return { min: start.toJSDate(), max: end.toJSDate() };
  }, []);

  const events = bookings.map((b) => ({
    title: `${b.client_name} - ${b.short_service_name}`,
    start: new Date(b.start_time!),
    end: new Date(b.end_time!),
    booking: b,
    id: b.id,
  }));

  const dayPropGetter = (date: Date) => {
    const today = DateTime.now().startOf("day").toISODate();
    const current = DateTime.fromJSDate(date).startOf("day").toISODate();
    return today === current ? { style: { backgroundColor: "rgba(212, 228, 209, 1)" } } : {};
  };

  return (
    <div className="h-fit relative">
      <div style={{ opacity: loading ? 0.5 : 1, transition: "opacity 0.3s" }}>
        <Calendar
          localizer={localizer}
          view={view}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: 600 }}
          min={min}
          max={max}
          dayPropGetter={dayPropGetter}
          eventPropGetter={() => ({
            style: {
              backgroundColor: "rgba(4, 62, 0, 1)",
              color: "white",
              borderRadius: "8px",
              border: "1.5px solid #6FBF73",
              padding: "4px",
            },
          })}
          onSelectEvent={(event) => {
            const b = (event as any).booking;
            setSelectedBookingId(b.id);
            setIsOpenBookingDialog(true);
          }}
          onView={onView}
          onNavigate={onNavigate}
          date={date}
          formats={calendarFormats}
        />
      </div>

      {loading && (
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>
          <CircularProgress />
        </div>
      )}

      {fetchError && <div>Error loading bookings: {fetchError}</div>}
      
    </div>
  );
}

export default React.memo(CalendarUI);
