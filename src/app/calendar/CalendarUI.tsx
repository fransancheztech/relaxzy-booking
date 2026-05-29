"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import FullCalendar from "@fullcalendar/react";
import esLocale from "@fullcalendar/core/locales/es";
import thLocale from "@fullcalendar/core/locales/th";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import resourceTimeGridPlugin from "@fullcalendar/resource-timegrid";
import { DatesSetArg, EventClickArg, EventContentArg } from "@fullcalendar/core";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import { toast } from "react-toastify";
import { useCalendarData } from "@/hooks/useCalendarData";
import { useLayout } from "../context/LayoutContext";
import { TherapistOption, useTherapistsWithLoaded } from "@/hooks/useTherapists";
import { DateTime } from "luxon";
import { STATUS_COLORS } from "@/constants";
import { BookingModel } from "@/types/bookings";
import DailyTotalsDialog from "@/components/DailyTotalsDialog";
import { useRole } from "@/hooks/useRole";
import { useSubmitGuard } from "@/hooks/useSubmitGuard";

interface CalendarUIProps {
  setIsOpenBookingDialog: React.Dispatch<React.SetStateAction<boolean>>;
}

// 5-minute resolution so odd-timed bookings (e.g. 13:05) are colored at the right minute
const SLOT_MS = 5 * 60 * 1000;
const DAY_START_HOUR = 10;
const DAY_END_HOUR = 22;
const MINUTES_IN_VIEW = (DAY_END_HOUR - DAY_START_HOUR) * 60;

const STATUS_KEYS = ["completed", "confirmed", "pending", "cancelled"] as const;

const OCCUPANCY_COLORS: Record<number, string> = {
  0: "transparent",
  1: "#c8e6c9",
  2: "#81c784",
  3: "#fff176",
  4: "#ffb74d",
  5: "#e57373",
};

const COLOR_LEGEND_COLORS = ["#c8e6c9", "#81c784", "#fff176", "#ffb74d", "#e57373"];
const LEGEND_KEYS = ["booked1", "booked2", "booked3", "booked4", "booked5plus"] as const;
const FC_LOCALES = [esLocale, thLocale];

function getOccupancyColor(count: number): string {
  return OCCUPANCY_COLORS[Math.min(count, 5)] ?? OCCUPANCY_COLORS[5];
}

function CalendarUI({ setIsOpenBookingDialog }: CalendarUIProps) {
  const { setSelectedBookingId } = useLayout();
  const { isTherapist } = useRole();
  const { therapists, loaded: therapistsLoaded } = useTherapistsWithLoaded();
  const [inactiveTherapists, setInactiveTherapists] = useState<
    Array<TherapistOption & { state: "inactive" | "deleted" }>
  >([]);
  const t = useTranslations("Calendar");
  const locale = useLocale();

  const [range, setRange] = useState<{ start: Date; end: Date } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentView, setCurrentView] = useState("resourceTimeGridDay");
  const [gutterMetrics, setGutterMetrics] = useState<{
    top: number; left: number; width: number; height: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<FullCalendar>(null);

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

  // Total booked minutes per therapist (and "none") for the visible range, excluding cancelled
  const minutesPerResource = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of bookings) {
      if (!b.start_time || !b.end_time) continue;
      if (b.status === "cancelled") continue;
      const ms = new Date(b.end_time as unknown as string).getTime() -
        new Date(b.start_time as unknown as string).getTime();
      if (ms <= 0) continue;
      const key = b.therapist_id ?? "none";
      map.set(key, (map.get(key) ?? 0) + Math.round(ms / 60_000));
    }
    return map;
  }, [bookings]);

  // Fetch info for any therapists referenced by visible bookings that aren't in the active list
  // (covers deactivated and soft-deleted therapists — without them, FullCalendar would drop their events)
  useEffect(() => {
    if (!therapistsLoaded) return;
    const activeIds = new Set(therapists.map((th) => th.id));
    const missingIds = Array.from(
      new Set(
        bookings
          .map((b) => b.therapist_id)
          .filter((id): id is string => !!id && !activeIds.has(id))
      )
    );
    if (missingIds.length === 0) {
      setInactiveTherapists((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    let cancelled = false;
    fetch("/api/therapists/by-ids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: missingIds }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setInactiveTherapists(
          (d.therapists ?? []).map(
            (th: { id: string; full_name: string; active: boolean; deleted_at: string | null }) => ({
              id: th.id,
              full_name: th.full_name,
              state: th.deleted_at ? "deleted" : "inactive",
            })
          )
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [bookings, therapists, therapistsLoaded]);

  const resources = useMemo(() => [
    ...therapists.map((th) => ({
      id: th.id,
      title: th.full_name,
      extendedProps: { minutes: minutesPerResource.get(th.id) ?? 0, inactive: false },
    })),
    ...inactiveTherapists.map((th) => ({
      id: th.id,
      title: th.full_name,
      extendedProps: { minutes: minutesPerResource.get(th.id) ?? 0, state: th.state as "inactive" | "deleted" },
    })),
    {
      id: "none",
      title: t("noTherapist"),
      extendedProps: { minutes: minutesPerResource.get("none") ?? 0 },
    },
  ], [therapists, inactiveTherapists, t, minutesPerResource]);

  const events = useMemo(() =>
    bookings.map((b) => {
      const colors = (b.status ? STATUS_COLORS[b.status as keyof typeof STATUS_COLORS] : null) ?? STATUS_COLORS.confirmed;
      return {
        id: b.id,
        title: `${b.client_name} · ${b.short_service_name ?? ""}`,
        start: DateTime.fromISO(b.start_time!, { zone: "Europe/Madrid" }).toISO()!,
        end: DateTime.fromISO(b.end_time!, { zone: "Europe/Madrid" }).toISO()!,
        resourceId: b.therapist_id ?? "none",
        extendedProps: { booking: b },
        backgroundColor: colors.bg,
        borderColor: colors.border,
        textColor: "#ffffff",
      };
    }),
  [bookings]);

  // Count active bookings per 5-min slot (including those with no therapist assigned)
  const slotCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const b of bookings) {
      if (!b.start_time || !b.end_time) continue;
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

  const [batchCompleteOpen, setBatchCompleteOpen] = useState(false);
  const [dailyTotalsOpen, setDailyTotalsOpen] = useState(false);
  const rangeRef = useRef<{ start: Date; end: Date } | null>(null);
  const { submitting: batchSubmitting, guard: batchGuard } = useSubmitGuard();

  const confirmedCount = useMemo(
    () => bookings.filter((b) => b.status === "confirmed").length,
    [bookings],
  );

  const isFutureDay = useMemo(() => (range ? range.start > new Date() : false), [range]);

  const formattedDate = useMemo(() => {
    if (!range) return "";
    return range.start.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
  }, [range, locale]);

  const confirmedCountRef = useRef(0);
  confirmedCountRef.current = confirmedCount;
  const isFutureDayRef = useRef(false);
  isFutureDayRef.current = isFutureDay;
  rangeRef.current = range;

  const customButtons = useMemo(() => ({
    batchComplete: {
      text: t("closeDayButton"),
      click: () => {
        if (confirmedCountRef.current === 0 || isFutureDayRef.current) return;
        setBatchCompleteOpen(true);
      },
    },
    dailyTotals: {
      text: t("dailyTotalsButton"),
      click: () => {
        if (!rangeRef.current) return;
        setDailyTotalsOpen(true);
      },
    },
  }), [t]);

  const handleBatchComplete = useCallback(() =>
    batchGuard(async () => {
      if (!range) return;
      setBatchCompleteOpen(false);
      try {
        const res = await fetch("/api/bookings/batch-complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ start: range.start.toISOString(), end: range.end.toISOString() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? t("closeDayError"));
        toast.success(t("closeDaySuccess", { count: data.updated }));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("closeDayError"));
      }
    }), [range, t, batchGuard]);

  const eventContent = useCallback((arg: EventContentArg) => {
    const b = arg.event.extendedProps.booking as BookingModel;
    const price = b.price != null ? Number(b.price) : null;
    const paid = b.paid_total ?? 0;

    let flagColor: string;
    if (price === null) {
      flagColor = "#777";
    } else if (paid === 0) {
      flagColor = "#c62828";
    } else if (paid < price) {
      flagColor = "#f57c00";
    } else {
      flagColor = "#1b5e20";
    }

    const fmt = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(2);
    const priceStr = price != null ? `${fmt(price)}€` : "—";

    return (
      <div style={{ padding: "1px 3px", overflow: "hidden", height: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, opacity: 0.9, whiteSpace: "nowrap" }}>
            {arg.timeText}
          </span>
          <span style={{
            flexShrink: 0,
            padding: "0 3px",
            borderRadius: 3,
            fontSize: 9,
            fontWeight: 700,
            background: "rgba(255,255,255,0.85)",
            color: flagColor,
            whiteSpace: "nowrap",
          }}>
            {fmt(paid)}€/{priceStr}
          </span>
          {b.therapist_requested && (
            <span
              title={t("therapistRequestedTooltip")}
              style={{ fontSize: 11, lineHeight: 1, color: "#ffd54f", textShadow: "0 0 2px rgba(0,0,0,0.6)" }}
            >
              ★
            </span>
          )}
          {b.booking_group_id && (
            <span
              title={t("groupTooltip")}
              style={{
                fontSize: 11,
                lineHeight: 1,
                fontWeight: 700,
                color: "#80deea",
                textShadow: "0 0 2px rgba(0,0,0,0.7)",
              }}
            >
              ⛓
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {arg.event.title}
        </div>
      </div>
    );
  }, [t]);

  const handleEventClick = useCallback((info: EventClickArg) => {
    setSelectedBookingId(info.event.extendedProps.booking.id);
    setIsOpenBookingDialog(true);
  }, [setSelectedBookingId, setIsOpenBookingDialog]);

  const handleDatesSet = useCallback((info: DatesSetArg) => {
    setRange({ start: info.start, end: info.end });
    setCurrentView(info.view.type);
  }, []);

  // Clicking a day header/number in week or month view jumps to that day's "By therapist" view
  const handleNavLinkDayClick = useCallback((date: Date) => {
    calendarRef.current?.getApi().changeView("resourceTimeGridDay", date);
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
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, resourceTimeGridPlugin]}
          schedulerLicenseKey="CC-Attribution-NonCommercial-NoDerivatives"
          locales={FC_LOCALES}
          locale={locale}
          initialView="resourceTimeGridDay"
          customButtons={customButtons}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: (currentView === "resourceTimeGridDay" || currentView === "timeGridDay") && !isTherapist
              ? "resourceTimeGridDay,timeGridDay,timeGridWeek,dayGridMonth dailyTotals batchComplete"
              : "resourceTimeGridDay,timeGridDay,timeGridWeek,dayGridMonth",
          }}
          buttonText={{
            today: t("today"),
            week: t("week"),
            month: t("month"),
          }}
          views={{
            timeGridDay: { buttonText: t("day") },
            resourceTimeGridDay: {
              buttonText: t("byTherapist"),
              titleFormat: { weekday: "long", day: "numeric", month: "long", year: "numeric" },
            },
          }}
          resources={resources}
          resourceLabelContent={(arg) => {
            const props = arg.resource.extendedProps as {
              minutes?: number;
              state?: "inactive" | "deleted";
            };
            const minutes = props.minutes ?? 0;
            const state = props.state;
            const h = Math.floor(minutes / 60);
            const m = minutes % 60;
            const label = h > 0 && m > 0 ? `${h}h ${m}m` : h > 0 ? `${h}h` : `${m}m`;
            const suffix =
              state === "deleted" ? ` (${t("deleted")})`
              : state === "inactive" ? ` (${t("inactive")})`
              : "";
            return (
              <div
                style={{
                  textAlign: "center",
                  lineHeight: 1.2,
                  padding: "2px 0",
                  color: state ? "#999" : undefined,
                  fontStyle: state ? "italic" : undefined,
                }}
              >
                <div>{arg.resource.title}{suffix}</div>
                {minutes > 0 && (
                  <div style={{ fontSize: 11, color: state ? "#aaa" : "#666", fontWeight: 400, marginTop: 1 }}>
                    {label}
                  </div>
                )}
              </div>
            );
          }}
          events={events}
          eventContent={
            (currentView === "resourceTimeGridDay" || currentView === "timeGridDay")
              ? eventContent
              : undefined
          }
          eventClick={handleEventClick}
          datesSet={handleDatesSet}
          navLinks
          navLinkDayClick={handleNavLinkDayClick}
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
        <div style={{ color: "red", marginTop: 8 }}>{t("errorLoadingBookings")} {fetchError}</div>
      )}

      <Dialog open={batchCompleteOpen} onClose={() => setBatchCompleteOpen(false)}>
        <DialogTitle>{t("closeDayDialogTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t("closeDayDialogBody", { count: confirmedCount, date: formattedDate })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBatchCompleteOpen(false)} disabled={batchSubmitting}>{t("closeDayCancel")}</Button>
          <Button onClick={handleBatchComplete} variant="contained" color="success" disabled={batchSubmitting}>
            {t("closeDayConfirm")}
          </Button>
        </DialogActions>
      </Dialog>

      <DailyTotalsDialog
        open={dailyTotalsOpen}
        onClose={() => setDailyTotalsOpen(false)}
        start={range?.start ?? null}
        end={range?.end ?? null}
      />

      {currentView === "resourceTimeGridDay" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "#666", fontWeight: 500 }}>{t("occupancy")}</span>
            {COLOR_LEGEND_COLORS.map((color, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{
                  display: "inline-block",
                  width: 14,
                  height: 14,
                  background: color,
                  borderRadius: 3,
                  border: "1px solid rgba(0,0,0,0.15)",
                }} />
                <span style={{ fontSize: 11, color: "#555" }}>{t(LEGEND_KEYS[i])}</span>
              </span>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "#666", fontWeight: 500 }}>{t("statusLegend")}</span>
            {STATUS_KEYS.map((key) => (
              <span key={key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{
                  display: "inline-block",
                  width: 14,
                  height: 14,
                  background: STATUS_COLORS[key].bg,
                  borderRadius: 3,
                  border: `1px solid ${STATUS_COLORS[key].border}`,
                }} />
                <span style={{ fontSize: 11, color: "#555" }}>{t(`status_${key}`)}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(CalendarUI);
