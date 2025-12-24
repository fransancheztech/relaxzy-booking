//TODO
// Insert a little delay after adding a booking so the customer names appear right on on the new bookings

"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { Grid, MenuItem } from '@mui/material';
import { Calendar, luxonLocalizer, View } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { DateTime, Settings } from "luxon";
import CircularProgress from "@mui/material/CircularProgress";
import { useCalendarData } from "@/hooks/useCalendarData";
import { calendarFormats } from "@/utils/dateHelpers";
import { useLayout } from "../context/LayoutContext";
import { BookingModel } from "@/types/bookings";

Settings.defaultZone = "Europe/Madrid";
const localizer = luxonLocalizer(DateTime, { firstDayOfWeek: 1 });

interface CalendarUIProps {
  setBookingFormData: React.Dispatch<React.SetStateAction<BookingModel>>;
  setIsOpenBookingDialog: React.Dispatch<React.SetStateAction<boolean>>;
  setIsEditable: React.Dispatch<React.SetStateAction<boolean>>;
}

function CalendarUI({setBookingFormData, setIsOpenBookingDialog, setIsEditable}: CalendarUIProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [localForm, setLocalForm] = useState({ service_name: '', start_time: '', end_time: '', notes: '', status: '', price: '' });
  const [view, setView] = useState<View>("week");
  const [date, setDate] = useState(new Date());
  
  const { selectedBooking, setSelectedBooking } = useLayout();

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
          defaultView="week"
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
          view={view}
          onSelectEvent={(event) => {

            const b = (event as any).booking;
            setBookingFormData({...b, status: b.status[0].toUpperCase() + b.status.slice(1)});
            setIsEditable(false);
            setIsOpenBookingDialog(true);
            setLocalForm({
              service_name: b.service_name || '',
              start_time: new Date(b.start_time).toISOString(),
              end_time: new Date(b.end_time).toISOString(),
              notes: b.notes || '',
              status: b.status[0].toUpperCase() + b.status.slice(1) || '',
              price: b.price || ''
            });
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
