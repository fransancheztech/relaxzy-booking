"use client";

import { useEffect, useState, useRef } from "react";
import debounce from "lodash.debounce";
import { clients as ClientType } from "generated/prisma/client";
import DialogConfirmDeleteClient from "./ConfirmDeleteClientDialog";
import { toast } from "react-toastify";
import NewClientDialogForm from "./NewClientDialogForm";
import UpdateClientDialogForm from "./UpdateClientDialogForm";
import { useLayout } from "../context/LayoutContext";
import { ClientsTable } from "./ClientsTable";
import { FETCH_LIMIT } from "@/constants";

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientType[]>([]);
  const [page, setPage] = useState(0);
  const [rowCount, setRowCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isOpenEditClientDialog, setIsOpenEditClientDialog] = useState(false);
  const [isOpenNewClientDialog, setIsOpenNewClientDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [sortModel, setSortModel] = useState<{
    field: string;
    sort: "asc" | "desc";
  }>({
    field: "created_at",
    sort: "desc",
  });

  const { setButtonLabel, setOnButtonClick } = useLayout();

  // -------------------------------
  // Load paginated clients normally
  // -------------------------------
  async function loadClients(
    pageToLoad: number,
    sort = sortModel,
    search = searchTerm,
  ) {
    try {
      setLoading(true);
      setFetchError(null);
      const res = await fetch("/api/clients/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page: pageToLoad,
          limit: FETCH_LIMIT,
          searchTerm: search,
          sort,
        }),
      });

      if (!res.ok) {
        console.error("Failed to load clients");
        return;
      }

      const data = await res.json();
      setClients(data.rows);
      setRowCount(data.total);
      setPage(pageToLoad);
      setSortModel(sort);
    } catch (err) {
      console.error(err);
      setClients([]);
      setRowCount(0);
      setFetchError("Error loading clients");
    } finally {
      setLoading(false);
    }
  }

  // -------------------------------
  // Debounced fuzzy search (RPC)
  // -------------------------------
  const debouncedSearch = useRef(
    debounce(async (text: string) => {
      try {
        setLoading(true);
        setFetchError(null);
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
      } catch (err) {
        console.error(err);
        setClients([]);
        setRowCount(0);
        setFetchError("Error searching bookings");
      } finally {
        setLoading(false);
      }
    }, 300),
  ).current;

  // Load initial page
  useEffect(() => {
    loadClients(0);
  }, []);

  useEffect(() => {
    setButtonLabel("New Client");
    setOnButtonClick(() => () => setIsOpenNewClientDialog((prev) => !prev));
    return () => {
      setButtonLabel("");
      setOnButtonClick(null);
    };
  }, [setButtonLabel, setOnButtonClick, setIsOpenNewClientDialog]);

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

  const onConfirmDelete = () => {
    if (selectedClientId) handleDelete(selectedClientId);
    setSelectedClientId(null);
  };

  const closeEditClientDialog = () => {
    setIsOpenEditClientDialog(false);
    setSelectedClientId(null);
  };

  const closeNewClientDialog = () => {
    setIsOpenNewClientDialog(false);
    setSelectedClientId(null);
  };

  const closeDeleteDialog = () => {
    setConfirmDeleteOpen(false);
    setSelectedClientId(null);
  };

  return (
    <main className="p-4">
      <ClientsTable
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        debouncedSearch={debouncedSearch}
        clients={clients}
        rowCount={rowCount}
        page={page}
        loadClients={loadClients}
        setSelectedClientId={setSelectedClientId}
        setIsOpenEditClientDialog={setIsOpenEditClientDialog}
        loading={loading}
        fetchError={fetchError}
      />
      <NewClientDialogForm
        open={isOpenNewClientDialog}
        onClose={closeNewClientDialog}
      />
      <UpdateClientDialogForm
        open={isOpenEditClientDialog}
        onClose={closeEditClientDialog}
        clientId={selectedClientId}
        confirmDeleteOpen={confirmDeleteOpen}
        onConfirmDelete={onConfirmDelete}
        closeDeleteDialog={closeDeleteDialog}
        setConfirmDeleteOpen={setConfirmDeleteOpen}
      />
    </main>
  );
}
