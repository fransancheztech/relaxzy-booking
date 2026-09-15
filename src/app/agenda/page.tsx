"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";
import thLocale from "@fullcalendar/core/locales/th";
import type { DateSelectArg, DatesSetArg, EventClickArg } from "@fullcalendar/core";
import { Box, Paper } from "@mui/material";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { useLayout } from "../context/LayoutContext";
import { nowBusiness } from "@/utils/businessTime";
import type { AgendaRole } from "@/schemas/agendaNote.schema";
import AgendaDayDialog from "./AgendaDayDialog";
import type { AgendaListResponse, AgendaNote } from "./types";

const FC_LOCALES = [esLocale, thLocale];

const AgendaPage = () => {
  const t = useTranslations("Agenda");
  const locale = useLocale();
  const { setButtonLabel, setOnButtonClick } = useLayout();

  const [notes, setNotes] = useState<AgendaNote[]>([]);
  const [canManage, setCanManage] = useState<boolean | null>(null);
  const [assignableRoles, setAssignableRoles] = useState<AgendaRole[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Held in a ref so a refetch after saving doesn't depend on re-running datesSet.
  const rangeRef = useRef<{ from: string; to: string } | null>(null);

  const load = useCallback(async () => {
    const range = rangeRef.current;
    if (!range) return;
    try {
      const res = await fetch(`/api/agenda?from=${range.from}&to=${range.to}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data: AgendaListResponse = await res.json();
      setNotes(data.notes ?? []);
      setCanManage(data.can_manage);
      setAssignableRoles(data.assignable_roles ?? []);
    } catch {
      toast.error(t("loadError"));
    }
  }, [t]);

  // Refetch here, then let the top bar know so it can show/hide without a reload.
  const handleChanged = useCallback(async () => {
    await load();
    window.dispatchEvent(new CustomEvent("refreshAgendaData"));
  }, [load]);

  const handleDatesSet = (info: DatesSetArg) => {
    // All-day events keyed by date string, so these are plain calendar days with no conversion.
    rangeRef.current = { from: info.startStr.slice(0, 10), to: info.endStr.slice(0, 10) };
    load();
  };

  const openDay = (date: string) => setSelectedDate(date);

  useEffect(() => {
    setButtonLabel(t("newNote"));
    setOnButtonClick(() => () => openDay(nowBusiness().toFormat("yyyy-MM-dd")));
    return () => {
      setButtonLabel("");
      setOnButtonClick(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  // Therapists get the same page in read-only mode. This is an affordance, not the control:
  // the write endpoints reject them regardless. `null` (still loading) reads as read-only so
  // edit controls can never flash before the role is known.
  const readOnly = canManage !== true;


  const dayNotes = selectedDate ? notes.filter((n) => n.note_date === selectedDate) : [];

  return (
    <main className="p-4">
      <Paper sx={{ p: 2 }}>
        <Box
          sx={{
            // Keep a note readable in a month cell: one line, ellipsised, no wrapping.
            "& .fc-daygrid-event": { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "pointer" },
            "& .fc-daygrid-day": { cursor: "pointer" },
          }}
        >
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locales={FC_LOCALES}
            locale={locale}
            height="auto"
            firstDay={1}
            dayMaxEvents={3}
            headerToolbar={{ left: "prev,next today", center: "title", right: "" }}
            datesSet={handleDatesSet}
            dateClick={(info: { dateStr: string }) => openDay(info.dateStr.slice(0, 10))}
            eventClick={(info: EventClickArg) => {
              info.jsEvent.preventDefault();
              const d = info.event.startStr.slice(0, 10);
              if (d) openDay(d);
            }}
            selectable={false}
            select={(_info: DateSelectArg) => undefined}
            events={notes.map((n) => ({
              id: n.id,
              title: n.content,
              start: n.note_date, // "YYYY-MM-DD" — all-day, timezone-free
              allDay: true,
            }))}
          />
        </Box>
      </Paper>

      <AgendaDayDialog
        open={selectedDate !== null}
        onClose={() => setSelectedDate(null)}
        date={selectedDate}
        notes={dayNotes}
        assignableRoles={assignableRoles}
        onChanged={handleChanged}
        readOnly={readOnly}
      />
    </main>
  );
};

export default AgendaPage;
