"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { payments as PaymentsType } from "generated/prisma/client";
import DialogPayment from "./DialogPayment";
import { PaymentsTable } from "./PaymentsTable";
import { FETCH_LIMIT } from "@/constants";
import { GridFilterItem, GridFilterModel } from "@mui/x-data-grid";

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentsType[]>([]);
  const [page, setPage] = useState(0);
  const [rowCount, setRowCount] = useState(0);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [selectedPaymentAmount, setSelectedPaymentAmount] = useState<number | null>(null);
  const [isOpenViewPaymentDialog, setIsOpenViewPaymentDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [sortModel, setSortModel] = useState<{ field: string; sort: "asc" | "desc" }>({
    field: "created_at",
    sort: "desc",
  });
  const [filterItems, setFilterItems] = useState<GridFilterItem[]>([]);

  // -------------------------------
  // Load payments
  // -------------------------------
  const loadPayments = useCallback(async (
    pageToLoad: number,
    sort = sortModel,
    filters = filterItems,
  ) => {
    try {
      setLoading(true);
      setFetchError(null);

      const res = await fetch("/api/payments/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page: pageToLoad,
          limit: FETCH_LIMIT,
          sort,
          filterItems: filters,
        }),
      });

      if (!res.ok) throw new Error("Failed to load payments");

      const data = await res.json();
      setPayments(data.rows);
      setRowCount(data.total);
      setPage(pageToLoad);
      setSortModel(sort);
    } catch (err) {
      console.error(err);
      setPayments([]);
      setRowCount(0);
      setFetchError("Error loading payments");
    } finally {
      setLoading(false);
    }
  }, [sortModel, filterItems]);

  // -------------------------------
  // Realtime subscription — stable, recreated only on mount/unmount
  // -------------------------------
  const loadPaymentsRef = useRef(loadPayments);
  loadPaymentsRef.current = loadPayments;
  const pageRef = useRef(page);
  pageRef.current = page;
  const sortModelRef = useRef(sortModel);
  sortModelRef.current = sortModel;
  const filterItemsRef = useRef(filterItems);
  filterItemsRef.current = filterItems;

  useEffect(() => {
    const eventSource = new EventSource("/api/payments/stream");
    eventSource.onmessage = () => {
      loadPaymentsRef.current(pageRef.current, sortModelRef.current, filterItemsRef.current);
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
    loadPayments(0, sortModel, activeItems);
  };

  // Load initial page
  useEffect(() => {
    loadPayments(0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const closeViewPaymentDialog = () => {
    setIsOpenViewPaymentDialog(false);
    setSelectedPaymentId(null);
  };

  return (
    <main className="p-4">
      <PaymentsTable
        payments={payments}
        rowCount={rowCount}
        page={page}
        loadPayments={loadPayments}
        onFilterModelChange={handleFilterModelChange}
        setSelectedPaymentId={setSelectedPaymentId}
        setSelectedPaymentAmount={setSelectedPaymentAmount}
        setIsOpenViewPaymentDialog={setIsOpenViewPaymentDialog}
        loading={loading}
        fetchError={fetchError}
      />
      <DialogPayment
        open={isOpenViewPaymentDialog}
        onClose={closeViewPaymentDialog}
        paymentId={selectedPaymentId}
        paymentAmount={selectedPaymentAmount}
        setPaymentId={setSelectedPaymentId}
        loadPayments={loadPayments}
      />
    </main>
  );
}
