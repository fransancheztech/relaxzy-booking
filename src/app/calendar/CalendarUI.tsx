"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

// 5-minute resolution so odd-timed bookings (e.g. 13:05) are colored at the right minute
const SLOT_MS = 5 * 60 * 1000;
const DAY_START_HOUR = 10;
const DAY_END_HOUR = 22;
const MINUTES_IN_VIEW = (DAY_END_HOUR - DAY_START_HOUR) * 60;

const OCCUPANCY_COLORS: Record<number, string> = {
  0: "transparent",
  1: "#c8e6c9",
  2: "#81c784",
  3: "#fff176",
  4: "#ffb74d",
  5: "#e57373",
};

const COLOR_LEGEND = [
  { label: "1 booked", color: "#c8e6c9" },
  { label: "2 booked", color: "#81c784" },
  { label: "3 booked", color: "#fff176" },
  { label: "4 booked", color: "#ffb74d" },
  { label: "5+ booked", color: "#e57373" },
];

function getOccupancyColor(count: number): string {
  return OCCUPANCY_COLORS[Math.min(count, 5)] ?? OCCUPANCY_COLORS[5];
}

function CalendarUI({ setIsOpenBookingDialog }: CalendarUIProps) {
  const { setSelectedBookingId } = useLayout();
  const therapists = useTherapists();

  const [range, setRange] = useState<{ start: Date; end: Date } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentView, setCurrentView] = useState("resourceTimeGridDay");
  const [gutterMetrics, setGutterMetrics] = useState<{
    top: number; left: number; width: number; height: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

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

  // Count active, therapist-assigned bookings per 5-min slot
  const slotCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const b of bookings) {
      if (!b.start_time || !b.end_time || !b.therapist_id) continue;
      if (b.status === "cancelled") continue;
      const bStart = new Date(b.start_time as unknown as string).getTime();
      const bEnd = new Date(b.end_time as unknown as string).getTime();
      const firstSlot = Math.floor(bStart / SLOT_MS) * SLOT_MS;
      for (let t = firstSlot; t < bEnd; t += SLOT_MS) {
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    return counts;
  }, [bookings]);

  // For the visible day, build a sequence of 5-min color stripes positioned over the time gutter
  const overlayStripes = useMemo(() => {
    if (!range || currentView !== "resourceTimeGridDay") return [];
    const dayStart = new Date(range.start);
    dayStart.setHours(DAY_START_HOUR, 0, 0, 0);
    const dayStartMs = dayStart.getTime();

    const stripes: { topPct: number; heightPct: number; color: string }[] = [];
    const totalSlots = (MINUTES_IN_VIEW * 60_000) / SLOT_MS;
    for (let i = 0; i < totalSlots; i++) {
      const t = dayStartMs + i * SLOT_MS;
      const count = slotCounts.get(t) ?? 0;
      stripes.push({
        topPct: (i / totalSlots) * 100,
        heightPct: (1 / totalSlots) * 100,
        color: getOccupancyColor(count),
      });
    }
    return stripes;
  }, [range, currentView, slotCounts]);

  const handleEventClick = useCallback((info: EventClickArg) => {
    setSelectedBookingId(info.event.extendedProps.booking.id);
    setIsOpenBookingDialog(true);
  }, [setSelectedBookingId, setIsOpenBookingDialog]);

  const handleDatesSet = useCallback((info: DatesSetArg) => {
    setRange({ start: info.start, end: info.end });
    setCurrentView(info.view.type);
  }, []);

  // Measure the time-gutter column so we can overlay color stripes precisely on top of it
  useEffect(() => {
    if (currentView !== "resourceTimeGridDay") {
      setGutterMetrics(null);
      return;
    }
    const measure = () => {
      const container = containerRef.current;
      if (!container) return;
      const bodyAxis = container.querySelector<HTMLElement>(
        ".fc-timegrid-body .fc-timegrid-axis"
      );
      const bodySlots = container.querySelector<HTMLElement>(
        ".fc-timegrid-body .fc-timegrid-slots"
      );
      if (!bodyAxis || !bodySlots) return;
      const containerRect = container.getBoundingClientRect();
      const axisRect = bodyAxis.getBoundingClientRect();
      const slotsRect = bodySlots.getBoundingClientRect();
      setGutterMetrics({
        top: slotsRect.top - containerRect.top,
        left: axisRect.left - containerRect.left,
        width: axisRect.width,
        height: slotsRect.height,
      });
    };
    measure();
    const id = window.setTimeout(measure, 50);
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("resize", measure);
    };
  }, [currentView, range, bookings, loading]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
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
          scrollTime="10:00:00"
          slotMinTime="10:00:00"
          slotMaxTime="22:00:00"
          allDaySlot={false}
          height="auto"
          eventMinHeight={28}
          slotDuration="00:30:00"
          slotLabelInterval="01:00:00"
          expandRows
        />
      </div>

      {currentView === "resourceTimeGridDay" && gutterMetrics && (
        <div
          style={{
            position: "absolute",
            top: gutterMetrics.top,
            left: gutterMetrics.left,
            width: gutterMetrics.width,
            height: gutterMetrics.height,
            pointerEvents: "none",
            zIndex: 0,
          }}
        >
          {overlayStripes.map((s, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                top: `${s.topPct}%`,
                height: `${s.heightPct}%`,
                left: 0,
                right: 0,
                background: s.color,
              }}
            />
          ))}
        </div>
      )}

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

      {currentView === "resourceTimeGridDay" && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: "#666", fontWeight: 500 }}>Occupancy:</span>
          {COLOR_LEGEND.map(({ label, color }) => (
            <span key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{
                display: "inline-block",
                width: 14,
                height: 14,
                background: color,
                borderRadius: 3,
                border: "1px solid rgba(0,0,0,0.15)",
              }} />
              <span style={{ fontSize: 11, color: "#555" }}>{label}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default React.memo(CalendarUI);
