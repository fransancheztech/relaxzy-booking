"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import resourceTimeGridPlugin from "@fullcalendar/resource-timegrid";
import { DatesSetArg, EventClickArg } from "@fullcalendar/core";
import CircularProgress from "@mui/material/CircularProgress";
import { useCalendarData } from "@/hooks/useCalendarData";
import { useLayout } from "../context/LayoutContext";
import { useTherapists } from "@/hooks/useTherapists";
import { DateTime } from "luxon";

interface CalendarUIProps {
  setIsOpenBookingDialog: React.Dispatch<React.SetStateAction<boolean>>;
}

function CalendarUI({ setIsOpenBookingDialog }: CalendarUIProps) {
  const { setSelectedBookingId } = useLayout();
  const therapists = useTherapists();

  const [range, setRange] = useState<{ start: Date; end: Date } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const handler = () => setRefreshKey((k) => k + 1);
    window.addEventListener("refreshCalendarData", handler);
    return () => window.removeEventListener("refreshCalendarData", handler);
  }, []);

  const { bookings, loading, fetchError } = useCalendarData(
    range?.start ?? null,
    range?.end ?? null,
    refreshKey,
  );

  const resources = useMemo(() => [
    ...therapists.map((t) => ({ id: t.id, title: t.full_name })),
    { id: "none", title: "No therapist" },
  ], [therapists]);

  const events = useMemo(() =>
    bookings.map((b) => ({
      id: b.id,
      title: `${b.client_name} · ${b.short_service_name ?? ""}`,
      start: DateTime.fromISO(b.start_time!, { zone: "Europe/Madrid" }).toISO()!,
      end: DateTime.fromISO(b.end_time!, { zone: "Europe/Madrid" }).toISO()!,
      resourceId: b.therapist_id ?? "none",
      extendedProps: { booking: b },
      backgroundColor: "rgba(4,62,0,1)",
      borderColor: "#6FBF73",
      textColor: "#ffffff",
    })),
  [bookings]);

  const handleEventClick = useCallback((info: EventClickArg) => {
    setSelectedBookingId(info.event.extendedProps.booking.id);
    setIsOpenBookingDialog(true);
  }, [setSelectedBookingId, setIsOpenBookingDialog]);

  const handleDatesSet = useCallback((info: DatesSetArg) => {
    setRange({ start: info.start, end: info.end });
  }, []);

  return (
    <div style={{ position: "relative" }}>
      <div style={{ opacity: loading ? 0.55 : 1, transition: "opacity 0.25s" }}>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, resourceTimeGridPlugin]}
          schedulerLicenseKey="CC-Attribution-NonCommercial-NoDerivatives"
          initialView="resourceTimeGridDay"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "resourceTimeGridDay,timeGridDay,timeGridWeek,dayGridMonth",
          }}
          buttonText={{
            today: "Today",
            week: "Week",
            month: "Month",
          }}
          views={{
            timeGridDay: { buttonText: "Day" },
            resourceTimeGridDay: {
              buttonText: "By therapist",
              titleFormat: { weekday: "long", day: "numeric", month: "long", year: "numeric" },
            },
          }}
          resources={resources}
          events={events}
          eventClick={handleEventClick}
          datesSet={handleDatesSet}
          firstDay={1}
          nowIndicator
          scrollTime="09:00:00"
          slotMinTime="08:00:00"
          slotMaxTime="22:00:00"
          allDaySlot={false}
          height={680}
          eventMinHeight={28}
          slotDuration="00:30:00"
          slotLabelInterval="01:00:00"
          expandRows
        />
      </div>

      {loading && (
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
        }}>
          <CircularProgress />
        </div>
      )}

      {fetchError && (
        <div style={{ color: "red", marginTop: 8 }}>Error loading bookings: {fetchError}</div>
      )}
    </div>
  );
}

export default React.memo(CalendarUI);
