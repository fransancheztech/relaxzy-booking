"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { clients as ClientType } from "generated/prisma/client";
import { toast } from "react-toastify";
import NewClientDialogForm from "./NewClientDialogForm";
import UpdateClientDialogForm from "./UpdateClientDialogForm";
import { useLayout } from "../context/LayoutContext";
import { ClientsTable } from "./ClientsTable";
import { FETCH_LIMIT } from "@/constants";
import { GridFilterItem, GridFilterModel } from "@mui/x-data-grid";

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientType[]>([]);
  const [page, setPage] = useState(0);
  const [rowCount, setRowCount] = useState(0);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isOpenEditClientDialog, setIsOpenEditClientDialog] = useState(false);
  const [isOpenNewClientDialog, setIsOpenNewClientDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [sortModel, setSortModel] = useState<{ field: string; sort: "asc" | "desc" }>({
    field: "created_at",
    sort: "desc",
  });
  const [filterItems, setFilterItems] = useState<GridFilterItem[]>([]);

  const { setButtonLabel, setOnButtonClick } = useLayout();
  const t = useTranslations("Clients");

  // -------------------------------
  // Load clients
  // -------------------------------
  const loadClients = useCallback(async (
    pageToLoad: number,
    sort = sortModel,
    filters = filterItems,
  ) => {
    try {
      setLoading(true);
      setFetchError(null);

      const res = await fetch("/api/clients/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page: pageToLoad,
          limit: FETCH_LIMIT,
          sort,
          filterItems: filters,
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
  }, [sortModel, filterItems]);

  // -------------------------------
  // Realtime subscription — stable, recreated only on mount/unmount
  // -------------------------------
  const loadClientsRef = useRef(loadClients);
  loadClientsRef.current = loadClients;
  const pageRef = useRef(page);
  pageRef.current = page;
  const sortModelRef = useRef(sortModel);
  sortModelRef.current = sortModel;
  const filterItemsRef = useRef(filterItems);
  filterItemsRef.current = filterItems;

  useEffect(() => {
    const eventSource = new EventSource("/api/clients/stream");
    eventSource.onmessage = () => {
      loadClientsRef.current(pageRef.current, sortModelRef.current, filterItemsRef.current);
    };
    return () => eventSource.close();
  }, []);

  // -------------------------------
  // Filter handler
  // -------------------------------
  const handleFilterModelChange = (model: GridFilterModel) => {
    const activeItems = model.items.filter(
      (item) => item.value !== undefined && item.value !== null && item.value !== ""
    );
    setFilterItems(activeItems);
    loadClients(0, sortModel, activeItems);
  };

  // Load initial page
  useEffect(() => {
    loadClients(0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setButtonLabel(t("newClient"));
    setOnButtonClick(() => () => setIsOpenNewClientDialog((prev) => !prev));
    return () => {
      setButtonLabel("");
      setOnButtonClick(null);
    };
  }, [setButtonLabel, setOnButtonClick, t]);

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
      setTimeout(() => loadClients(page), 300);
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

  const closeNewClientDialog = () => setIsOpenNewClientDialog(false);

  const closeDeleteDialog = () => {
    setConfirmDeleteOpen(false);
    setSelectedClientId(null);
  };

  return (
    <main className="p-4">
      <ClientsTable
        clients={clients}
        rowCount={rowCount}
        page={page}
        loadClients={loadClients}
        onFilterModelChange={handleFilterModelChange}
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
