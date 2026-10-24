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
import { Box, Button } from "@mui/material";
import MergeTypeIcon from "@mui/icons-material/MergeType";
import { useRouter } from "next/navigation";
import { useRole } from "@/hooks/useRole";
import { activeFilterItems } from "@/utils/gridFilterItems";

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
  const router = useRouter();
  // Resolving duplicates rewrites which client bookings belong to, so it is admin-only (the page
  // and its API enforce that too; this only decides whether to show the way in).
  const { isAdmin } = useRole();

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
    // Keeps "is empty" / "is not empty" (no value) and "is any of" (a list), which the old
    // "has a value" check silently dropped.
    const activeItems = activeFilterItems(model.items);
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
  /** Soft-deletes the client. True when it worked, so the caller can close the client's dialog. */
  async function handleDelete(id: string, note: string): Promise<boolean> {
    try {
      if (!id) {
        toast.error(t("deleteError"));
        return false;
      }

      const res = await fetch("/api/clients/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, notes: note }),
      });

      const result = await res.json();

      if (!res.ok) {
        console.error("Client delete error:", result);
        // The confirmation already checks this; it can still happen if a booking was added since.
        toast.error(result?.error === "CLIENT_HAS_HISTORY" ? t("deleteBlockedShort") : t("deleteError"));
        return false;
      }

      toast.success(t("deleteSuccess"));
      setTimeout(() => loadClients(page), 300);
      return true;
    } catch (err) {
      console.error("Network or server error deleting client", err);
      toast.error(t("deleteError"));
      return false;
    }
  }

  // The deleted client's dialog closes with it. It used to stay open: only the selected id was
  // cleared, leaving an empty client dialog on screen. On failure it stays open with the client.
  const onConfirmDelete = async (note: string) => {
    if (!selectedClientId) return;
    if (await handleDelete(selectedClientId, note)) closeEditClientDialog();
  };

  const closeEditClientDialog = () => {
    setIsOpenEditClientDialog(false);
    setSelectedClientId(null);
  };

  const closeNewClientDialog = () => setIsOpenNewClientDialog(false);

  // Only the confirmation closes: the client's dialog underneath keeps its client (it's closed
  // by onConfirmDelete when the deletion succeeds, or by the user).
  const closeDeleteDialog = () => setConfirmDeleteOpen(false);

  return (
    <main className="p-4">
      {isAdmin && (
        <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1.5 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<MergeTypeIcon />}
            onClick={() => router.push("/clients/duplicates")}
          >
            {t("reviewDuplicates")}
          </Button>
        </Box>
      )}
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
        onMerged={() => setTimeout(() => loadClients(page), 300)}
      />
    </main>
  );
}
