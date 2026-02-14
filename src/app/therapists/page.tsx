"use client";

import { useState, useEffect } from "react";
import { DataGrid, GridActionsCellItem, GridColDef } from "@mui/x-data-grid";
import { CircularProgress, Tooltip } from "@mui/material";
import AddTherapistDialog from "./AddTherapistDialogForm";
import UpdateTherapistDialog from "./UpdateTherapistDialogForm";
import { useLayout } from "../context/LayoutContext";
import EditIcon from "@mui/icons-material/Edit";
import { therapists } from "generated/prisma/client";

export default function TherapistsPage() {
  const { setButtonLabel, setOnButtonClick } = useLayout();

  const [therapists, setTherapists] = useState<therapists[]>([]);
  const [loading, setLoading] = useState(false);
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

  const fetchTherapists = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/therapists");
      const data: therapists[] = await res.json();
      // Filter out any undefined/null rows
      setTherapists(data.filter(Boolean));
    } catch (err) {
      console.error(err);
      setTherapists([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Connect to stream endpoint
    const eventSource = new EventSource("/api/therapists/stream");

    eventSource.onmessage = (event) => {
      try {
        const data: therapists[] = JSON.parse(event.data);
        setTherapists(data.filter((t) => t && !t.deleted_at));
      } catch (err) {
        console.error("Failed to parse SSE data:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE error:", err);
      eventSource.close();
    };

    return () => eventSource.close();
  }, []);

  const columns: GridColDef[] = [
    { field: "full_name", headerName: "Full Name", flex: 1 },
    { field: "email", headerName: "Email", flex: 1 },
    { field: "phone", headerName: "Phone", flex: 1 },
    { field: "notes", headerName: "Notes", flex: 1 },
    { field: "active", headerName: "Active", flex: 1 },
    {
      field: "created_at",
      headerName: "Created at",
      type: "dateTime",
      flex: 1,
      valueGetter: (_, row) =>
        row.created_at ? new Date(row.created_at) : null,
      valueFormatter: (value: Date | null) =>
        value
          ? value.toLocaleString("es-ES", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
            })
          : "",
    },
    {
      field: "actions",
      type: "actions",
      headerName: "Actions",
      getActions: (params) => [
        <GridActionsCellItem
          icon={
            <Tooltip title="Edit">
              <EditIcon color="primary" />
            </Tooltip>
          }
          label="Edit"
          onClick={() => {
            setSelectedId(params.row.id);
            setUpdateOpen(true);
          }}
        />,
      ],
      sortable: false,
      filterable: false,
    },
  ];

  return (
    <main className="p-4">
      {loading ? (
        <CircularProgress />
      ) : (
        <div style={{ height: 500, width: "100%" }}>
          <DataGrid
            rows={therapists}
            columns={columns}
            getRowId={(row) => row?.id ?? Math.random()} // fallback id if row.id is undefined
            pageSizeOptions={[5, 10, 25]}
          />
        </div>
      )}

      <AddTherapistDialog
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          fetchTherapists();
        }}
      />

      <UpdateTherapistDialog
        open={updateOpen}
        therapistId={selectedId}
        onClose={() => {
          setUpdateOpen(false);
          fetchTherapists();
        }}
      />
    </main>
  );
}
