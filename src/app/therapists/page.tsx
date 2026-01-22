"use client";

import { useState, useEffect } from "react";
import { DataGrid, GridActionsCellItem, GridColDef } from "@mui/x-data-grid";
import { CircularProgress, Tooltip } from "@mui/material";
import AddTherapistDialog from "./AddTherapistDialogForm";
import UpdateTherapistDialog from "./UpdateTherapistDialogForm";
import { useLayout } from "../context/LayoutContext";
import EditIcon from "@mui/icons-material/Edit";

type Therapist = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  notes: string;
  created_at: string;
};

export default function TherapistsPage() {
  const { setButtonLabel, setOnButtonClick } = useLayout();

  const [therapists, setTherapists] = useState<Therapist[]>([]);
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
      const data: Therapist[] = await res.json();
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
    fetchTherapists();
  }, []);

  const columns: GridColDef[] = [
    { field: "full_name", headerName: "Full Name", flex: 1 },
    { field: "email", headerName: "Email", flex: 1 },
    { field: "phone", headerName: "Phone", flex: 1 },
    { field: "notes", headerName: "Notes", flex: 1 },
    {
      field: "created_at",
      headerName: "Added",
      flex: 1,
      valueGetter: (params: { row: Therapist }) =>
        params.row?.created_at
          ? new Date(params.row.created_at).toLocaleDateString()
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
        />
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
