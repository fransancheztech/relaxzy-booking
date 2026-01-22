"use client";

import { services_names as ServicesType } from "generated/prisma/client";
import ServicesTable from "./ServicesTable";
import { useEffect, useRef, useState } from "react";
import { FETCH_LIMIT } from "@/constants";
import { debounce } from "lodash";
import NewServiceDialogForm from "./NewServiceDialogForm";
import UpdateServiceDialogForm from "./UpdateServiceDialogForm";
import ConfirmDeleteServiceDialog from "./ConfirmDeleteServiceDialog";
import handleDeleteService from "@/handlers/handleDeleteService";
import { useLayout } from "../context/LayoutContext";

const ServicesPage = () => {
  const { setButtonLabel, setOnButtonClick } = useLayout();

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
    setButtonLabel("New Service");
    setOnButtonClick(() => () => setIsOpenNewServiceDialog((prev) => !prev));
    return () => {
      setButtonLabel("");
      setOnButtonClick(null);
    };
  }, [setButtonLabel, setOnButtonClick]);

  // -------------------------------
  // Load services
  // -------------------------------
  async function loadServices(
    pageToLoad: number,
    sort = sortModel,
    search = searchTerm,
  ) {
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

      if (!res.ok) {
        console.error("Failed to load bookings");
        return;
      }

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
  }

  const debouncedSearch = useRef(
    debounce((text: string) => {
      loadServices(0, sortModel, text);
    }, 300),
  ).current;

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
    loadServices(page);
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
      />
    </main>
  );
};

export default ServicesPage;
