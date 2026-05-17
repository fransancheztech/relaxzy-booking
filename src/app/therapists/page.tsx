"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Box, Button, Container } from "@mui/material";
import CalendarViewWeekIcon from "@mui/icons-material/CalendarViewWeek";
import AddTherapistDialog from "./AddTherapistDialogForm";
import UpdateTherapistDialog from "./UpdateTherapistDialogForm";
import { useLayout } from "../context/LayoutContext";
import TherapistsTable from "./TherapistsTable";
import TherapistsWeeklySchedule from "./TherapistsWeeklySchedule";
import { therapists } from "generated/prisma/client";

export default function TherapistsPage() {
  const { setButtonLabel, setOnButtonClick } = useLayout();
  const t = useTranslations("Therapists");

  const [therapists, setTherapists] = useState<therapists[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [rowCount, setRowCount] = useState(0);

  const [addOpen, setAddOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [scheduleRefreshKey, setScheduleRefreshKey] = useState(0);

  useEffect(() => {
    setButtonLabel(t("newTherapist"));
    setOnButtonClick(() => () => setAddOpen(true));
    return () => {
      setButtonLabel("");
      setOnButtonClick(null);
    };
  }, [setButtonLabel, setOnButtonClick, t]);

  const loadTherapists = useCallback(
    async (pageToLoad: number, sort?: { field: string; sort: "asc" | "desc" }, limit?: number) => {
      setLoading(true);
      setFetchError(null);
      try {
        const actualLimit = limit ?? pageSize;
        setPageSize(actualLimit);
        const res = await fetch("/api/therapists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            page: pageToLoad,
            limit: actualLimit,
            sort,
          }),
        });
        const data = await res.json();
        setTherapists(data.rows);
        setRowCount(data.total);
        setPage(pageToLoad);
      } catch (err) {
        console.error(err);
        setFetchError("Error fetching therapists");
        setTherapists([]);
      } finally {
        setLoading(false);
      }
    },
    [pageSize]
  );

  useEffect(() => {
    loadTherapists(0);
  }, [loadTherapists]);

  const handleEdit = (id: string) => {
    setSelectedId(id);
    setUpdateOpen(true);
  };

  return (
    <Container sx={{ py: 3 }} disableGutters>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1.5 }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<CalendarViewWeekIcon />}
          onClick={() => setScheduleOpen(true)}
        >
          {t("weeklyOverview")}
        </Button>
      </Box>

      <TherapistsWeeklySchedule
        key={scheduleRefreshKey}
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
      />

      <TherapistsTable
        therapists={therapists}
        rowCount={rowCount}
        page={page}
        pageSize={pageSize}
        loading={loading}
        fetchError={fetchError}
        loadTherapists={loadTherapists}
        onEdit={handleEdit}
      />

      <AddTherapistDialog
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          loadTherapists(page);
          setScheduleRefreshKey((k) => k + 1);
        }}
      />

      <UpdateTherapistDialog
        open={updateOpen}
        therapistId={selectedId}
        onClose={() => {
          setUpdateOpen(false);
          loadTherapists(page);
          setScheduleRefreshKey((k) => k + 1);
        }}
      />
    </Container>
  );
}
