"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import debounce from "lodash.debounce";
import { clients as ClientType } from "generated/prisma/client";
import { TextField, Stack, Paper, Container, Tooltip } from "@mui/material";
import { DataGrid, GridColDef, GridActionsCellItem } from "@mui/x-data-grid";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import DialogConfirmDeleteClient from "./DialogConfirmDeleteClient";
import { toast } from "react-toastify";
import DialogUpdateClient from "./DialogUpdateClient";

const LIMIT = 100;

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientType[]>([]);
  const [page, setPage] = useState(0);
  const [rowCount, setRowCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isOpenEditDialog, setIsOpenEditDialog] = useState(false);

  // -------------------------------
  // Load paginated clients normally
  // -------------------------------
  async function loadClients(pageToLoad: number) {
    const res = await fetch("/api/clients/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ searchTerm: "" }),
    });

    if (!res.ok) {
      console.error("Failed to load clients");
      return;
    }

    const data = await res.json();
    setClients(data);
    setRowCount(data.length);
    setPage(pageToLoad);
    setIsSearching(false);
  }

  // -------------------------------
  // Debounced fuzzy search (RPC)
  // -------------------------------
  const debouncedSearch = useRef(
    debounce(async (text: string) => {
      const res = await fetch("/api/clients/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchTerm: text }),
      });

      if (!res.ok) {
        console.error("Search failed");
        return;
      }

      const data = await res.json();
      setClients(data);
      setRowCount(data.length);
      setIsSearching(!!text);
    }, 300)
  ).current;

  function handleSearch(text: string) {
    setSearchTerm(text);
    debouncedSearch(text);
  }

  // Load initial page
  useEffect(() => {
    loadClients(0);
  }, []);

  // -------------------------------
  // Delete client
  // -------------------------------
  async function handleDelete(id: string) {
    try {
      if (!id) {
        toast.error("Missing client ID");
        return;
      }

      const res = await fetch("/api/clients/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      const result = await res.json();

      if (!res.ok) {
        console.error("Client delete error:", result);
        toast.error(result?.error || "Error deleting client");
        return;
      }

      toast.success("The client has been deleted successfully.");

      // Reload the list after delete
      setTimeout(() => {
        if (isSearching) debouncedSearch(searchTerm);
        else loadClients(page);
      }, 300);
    } catch (err) {
      console.error("Network or server error deleting client", err);
      toast.error("Network or server error");
    }
  }

  const confirmDeleteClient = (id: string) => {
    setSelectedClientId(id);
    setConfirmDeleteOpen(true);
  };

  const onConfirmDelete = () => {
    if (selectedClientId) handleDelete(selectedClientId);
    setSelectedClientId(null);
  };

  // -------------------------------
  // Columns for DataGrid
  // -------------------------------
  const columns: GridColDef[] = [
    { field: "client_name", headerName: "Name", flex: 1 },
    { field: "client_surname", headerName: "Surname", flex: 1 },
    { field: "client_email", headerName: "Email", flex: 1 },
    { field: "client_phone", headerName: "Phone", flex: 1 },
    { field: "client_notes", headerName: "Notes", flex: 1 },

    // Actions column
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
            setSelectedClientId(params.row.id);
            setIsOpenEditDialog(true);
          }}
          key="edit"
        />,
        <GridActionsCellItem
          icon={
            <Tooltip title="Delete">
              <DeleteIcon color="error" />
            </Tooltip>
          }
          label="Delete"
          onClick={() => confirmDeleteClient(params.row.id)}
          key="delete"
        />,
      ],
    },
  ];

  const closeEditDialog = () => {
    setIsOpenEditDialog(false);
    setSelectedClientId(null);
  };

  const closeDeleteDialog = () => {
    setConfirmDeleteOpen(false);
    setSelectedClientId(null);
  };

  return (
    <main className="p-4">
      <Container sx={{ py: 3 }} disableGutters>
        {/* Search */}
        <Stack spacing={2} mb={2}>
          <TextField
            label="Search clients"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            fullWidth
          />
        </Stack>
        <Paper
          elevation={2}
          sx={{
            maxHeight: "calc(100vh - 186px)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <DataGrid
            rows={clients}
            columns={columns}
            getRowId={(row) => row.id}
            rowCount={rowCount}
            pageSizeOptions={[LIMIT]}
            paginationMode="server"
            pagination
            paginationModel={{ page, pageSize: LIMIT }}
            onPaginationModelChange={(model) => loadClients(model.page)}
          />
        </Paper>
        <DialogConfirmDeleteClient
          open={confirmDeleteOpen}
          onClose={closeDeleteDialog}
          onConfirm={onConfirmDelete}
        />
        <DialogUpdateClient
          open={isOpenEditDialog}
          onClose={closeEditDialog}
          clientId={selectedClientId}
        />
      </Container>
    </main>
  );
}
