"use client";

import { useEffect, useState, useRef } from "react";
import debounce from "lodash.debounce";
import { clients as ClientType } from "generated/prisma/client";
import DialogConfirmDeleteClient from "../../components/Dialogs/DeleteClient/DialogConfirmDeleteClient";
import { toast } from "react-toastify";
import DialogClient from "@/components/Dialogs/NewOrUpdateClient/DialogForm";
import { useLayout } from "../context/LayoutContext";
import { ClientsTable } from "./ClientsTable";

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

  const { setButtonLabel, setOnButtonClick } = useLayout();

  // -------------------------------
  // Load paginated clients normally
  // -------------------------------
  async function loadClients(pageToLoad: number) {
    try {
      setLoading(true);
      setFetchError(null);
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
    }, 300)
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
        setConfirmDeleteOpen={setConfirmDeleteOpen}
        loading={loading}
        fetchError={fetchError}
      />
      {/* Dialog for New Client */}
      <DialogClient
        open={isOpenNewClientDialog}
        onClose={closeNewClientDialog}
      />
      {/* Dialogs for Edit Client */}
      <DialogClient
        open={isOpenEditClientDialog}
        onClose={closeEditClientDialog}
        clientId={selectedClientId}
      />
      <DialogConfirmDeleteClient
        open={confirmDeleteOpen}
        onClose={closeDeleteDialog}
        onConfirm={onConfirmDelete}
      />
    </main>
  );
}
