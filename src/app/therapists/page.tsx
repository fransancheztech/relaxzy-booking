"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Box, Button, Container, FormControlLabel, Stack, Switch, Tooltip } from "@mui/material";
import { toast } from "react-toastify";
import CalendarViewWeekIcon from "@mui/icons-material/CalendarViewWeek";
import AddTherapistDialog from "./AddTherapistDialogForm";
import UpdateTherapistDialog from "./UpdateTherapistDialogForm";
import { useLayout } from "../context/LayoutContext";
import TherapistsTable from "./TherapistsTable";
import TherapistsWeeklySchedule from "./TherapistsWeeklySchedule";
import { therapists } from "generated/prisma/client";
import { useRole } from "@/hooks/useRole";

export default function TherapistsPage() {
  const { setButtonLabel, setOnButtonClick } = useLayout();
  const t = useTranslations("Therapists");
  // Archived therapists are admin-only; the API refuses `archived: true` for anyone else.
  const { isAdmin } = useRole();

  const [therapists, setTherapists] = useState<therapists[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [rowCount, setRowCount] = useState(0);
  const [archived, setArchived] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

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
    async (
      pageToLoad: number,
      sort?: { field: string; sort: "asc" | "desc" },
      limit?: number,
      // The callback closes over the toggles' previous values, so a toggle handler passes
      // its new value here instead of waiting for the re-render.
      overrides?: { archived?: boolean; includeInactive?: boolean },
    ) => {
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
            archived: overrides?.archived ?? archived,
            includeInactive: overrides?.includeInactive ?? showInactive,
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
    [pageSize, archived, showInactive]
  );

  useEffect(() => {
    loadTherapists(0);
  }, [loadTherapists]);

  const handleToggleArchived = (next: boolean) => {
    setArchived(next);
    loadTherapists(0, undefined, undefined, { archived: next });
  };

  const handleToggleInactive = (next: boolean) => {
    setShowInactive(next);
    loadTherapists(0, undefined, undefined, { includeInactive: next });
  };

  const handleEdit = (id: string) => {
    setSelectedId(id);
    setUpdateOpen(true);
  };

  const handleRestore = async (id: string) => {
    try {
      const res = await fetch(`/api/therapists/${id}`, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed to restore therapist");
      toast.success(t("therapistRestored"));
      loadTherapists(page);
      setScheduleRefreshKey((k) => k + 1);
    } catch (err) {
      console.error(err);
      toast.error(t("restoreTitle"));
    }
  };

  return (
    <Container sx={{ py: 3 }} disableGutters>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          {/* Inactive = former staff still on the roster. Inert while the archived list is
              showing, so it is disabled rather than silently ignored; the tooltip needs the
              <span> because a disabled MUI control has pointer-events: none. */}
          <Tooltip title={archived ? t("showInactiveArchivedHint") : ""} arrow enterTouchDelay={0}>
            <span>
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={showInactive}
                    disabled={archived}
                    onChange={(e) => handleToggleInactive(e.target.checked)}
                  />
                }
                label={t("showInactive")}
                sx={{ "& .MuiFormControlLabel-label": { fontSize: "0.85rem", color: "text.secondary" } }}
              />
            </span>
          </Tooltip>
          {isAdmin && (
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={archived}
                  onChange={(e) => handleToggleArchived(e.target.checked)}
                />
              }
              label={t("showArchived")}
              sx={{ "& .MuiFormControlLabel-label": { fontSize: "0.85rem", color: "text.secondary" } }}
            />
          )}
        </Stack>
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
        archived={archived}
        onRestore={handleRestore}
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
