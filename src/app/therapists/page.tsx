"use client";

import { useState, useEffect, useCallback } from "react";
import { Container } from "@mui/material";
import AddTherapistDialog from "./AddTherapistDialogForm";
import UpdateTherapistDialog from "./UpdateTherapistDialogForm";
import { useLayout } from "../context/LayoutContext";
import TherapistsTable from "./TherapistsTable";
import { therapists } from "generated/prisma/client";

export default function TherapistsPage() {
  const { setButtonLabel, setOnButtonClick } = useLayout();

  const [therapists, setTherapists] = useState<therapists[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowCount, setRowCount] = useState(0);

  const [addOpen, setAddOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    setButtonLabel("New Therapist");
    setOnButtonClick(() => () => setAddOpen(true));
    return () => {
      setButtonLabel("");
      setOnButtonClick(null);
    };
  }, [setButtonLabel, setOnButtonClick]);

  const loadTherapists = useCallback(
    async (pageToLoad: number, sort?: { field: string; sort: "asc" | "desc" }) => {
      setLoading(true);
      setFetchError(null);
      try {
        const res = await fetch("/api/therapists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            page: pageToLoad,
            limit: 5,
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
    []
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
      <TherapistsTable
        therapists={therapists}
        rowCount={rowCount}
        page={page}
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
        }}
      />

      <UpdateTherapistDialog
        open={updateOpen}
        therapistId={selectedId}
        onClose={() => {
          setUpdateOpen(false);
          loadTherapists(page);
        }}
      />
    </Container>
  );
}
