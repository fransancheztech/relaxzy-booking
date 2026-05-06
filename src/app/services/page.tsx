"use client";

import { services_names as ServicesType } from "generated/prisma/client";
import { useTranslations } from "next-intl";
import ServicesTable from "./ServicesTable";
import { useCallback, useEffect, useRef, useState } from "react";
import { FETCH_LIMIT } from "@/constants";
import { debounce } from "lodash";
import NewServiceDialogForm from "./NewServiceDialogForm";
import UpdateServiceDialogForm from "./UpdateServiceDialogForm";
import ConfirmDeleteServiceDialog from "./ConfirmDeleteServiceDialog";
import handleDeleteService from "@/handlers/handleDeleteService";
import { useLayout } from "../context/LayoutContext";

const ServicesPage = () => {
  const { setButtonLabel, setOnButtonClick } = useLayout();
  const t = useTranslations("Services");

  const [services, setServices] = useState<ServicesType[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [page, setPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    null,
  );
  const [isOpenNewServiceDialog, setIsOpenNewServiceDialog] = useState(false);
  const [isOpenEditServiceDialog, setIsOpenEditServiceDialog] = useState(false);
  const [isOpenConfirmDelete, setIsOpenConfirmDelete] = useState(false);
  const [sortModel, setSortModel] = useState<{
    field: string;
    sort: "asc" | "desc";
  }>({
    field: "name",
    sort: "desc",
  });
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // -------------------------------
  // Layout button
  // -------------------------------
  useEffect(() => {
    setButtonLabel(t("newService"));
    setOnButtonClick(() => () => setIsOpenNewServiceDialog((prev) => !prev));
    return () => {
      setButtonLabel("");
      setOnButtonClick(null);
    };
  }, [setButtonLabel, setOnButtonClick, t]);

  // -------------------------------
  // Load services
  // -------------------------------
  const loadServices = useCallback(
    async (pageToLoad: number, sort = sortModel, search = searchTerm) => {
      try {
        setLoading(true);
        setFetchError(null);

        const res = await fetch("/api/services/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            page: pageToLoad,
            limit: FETCH_LIMIT,
            searchTerm: search,
            sort,
          }),
        });

        if (!res.ok) throw new Error("Failed to load services");

        const data = await res.json();

        setServices(data.rows);
        setRowCount(data.total);
        setPage(pageToLoad);
        setSortModel(sort);
      } catch (err) {
        console.error(err);
        setServices([]);
        setRowCount(0);
        setFetchError("Error loading services");
      } finally {
        setLoading(false);
      }
    },
    [sortModel, searchTerm],
  );

  const debouncedSearch = useRef(
    debounce((text: string) => {
      loadServices(0, sortModel, text);
    }, 300),
  ).current;

  useEffect(() => {
    const eventSource = new EventSource("/api/services/stream");

    eventSource.onmessage = () => {
      loadServices(page, sortModel, searchTerm);
    };

    return () => eventSource.close();
  }, [page, sortModel, searchTerm, loadServices]);

  useEffect(() => {
    loadServices(0);
  }, []);

  const closeNewServiceDialog = () => setIsOpenNewServiceDialog(false);

  const closeEditServiceDialog = () => {
    setIsOpenEditServiceDialog(false);
    setSelectedServiceId(null);
  };

  const closeDeleteDialog = () => {
    setIsOpenConfirmDelete(false);
  };

  const onConfirmDelete = async () => {
    if (!selectedServiceId) return;

    await handleDeleteService(selectedServiceId);
    setSelectedServiceId(null);
  };
  return (
    <main className="p-4">
      <ServicesTable
        services={services}
        rowCount={rowCount}
        page={page}
        loadServices={loadServices}
        debouncedSearch={debouncedSearch}
        setSelectedServiceId={setSelectedServiceId}
        setIsOpenEditServiceDialog={setIsOpenEditServiceDialog}
        setIsOpenConfirmDelete={setIsOpenConfirmDelete}
        loading={loading}
        fetchError={fetchError}
      />
      <NewServiceDialogForm
        open={isOpenNewServiceDialog}
        onClose={closeNewServiceDialog}
      />
      {selectedServiceId && (
        <UpdateServiceDialogForm
          open={isOpenEditServiceDialog}
          onClose={closeEditServiceDialog}
          serviceId={selectedServiceId}
          setIsOpenConfirmDelete={setIsOpenConfirmDelete}
        />
      )}
      <ConfirmDeleteServiceDialog
        open={isOpenConfirmDelete}
        onClose={closeDeleteDialog}
        onConfirm={onConfirmDelete}
        serviceName={services.find((s) => s.id === selectedServiceId)?.name ?? undefined}
      />
    </main>
  );
};

export default ServicesPage;
