"use client";

import { useEffect, useState, useRef } from "react";
import debounce from "lodash.debounce";
import { payments as PaymentsType } from "generated/prisma/client";
import DialogPayment from "./DialogPayment";
import { PaymentsTable } from "./PaymentsTable";
import { FETCH_LIMIT } from "@/constants";

export default function PaymentsPage() {
  const [payments, setPayments] = useState<PaymentsType[]>([]);
  const [page, setPage] = useState(0);
  const [rowCount, setRowCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(
    null
  );
  const [selectedPaymentAmount, setSelectedPaymentAmount] =
  useState<number | null>(null);
  const [isOpenViewPaymentDialog, setIsOpenViewPaymentDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [sortModel, setSortModel] = useState<{
    field: string;
    sort: "asc" | "desc";
  }>({
    field: "created_at",
    sort: "desc",
  });

  // -------------------------------
  // Load paginated payments normally
  // -------------------------------
  async function loadPayments(
    pageToLoad: number,
    sort = sortModel,
    search = searchTerm
  ) {
    try {
      setLoading(true);
      setFetchError(null);

      const res = await fetch("/api/payments/search", {
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
        throw new Error("Failed to load payments");
      }

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
  }

  // -------------------------------
  // Debounced fuzzy search (RPC)
  // -------------------------------
  const debouncedSearch = useRef(
    debounce((text: string) => {
      loadPayments(0, sortModel, text);
    }, 300)
  ).current;

  // Load initial page
  useEffect(() => {
    loadPayments(0, sortModel);
  }, []);

  const closeViewPaymentDialog = () => {
    setIsOpenViewPaymentDialog(false);
    setSelectedPaymentId(null);
  };

  return (
    <main className="p-4">
      <PaymentsTable
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        debouncedSearch={debouncedSearch}
        payments={payments}
        rowCount={rowCount}
        page={page}
        loadPayments={loadPayments}
        setSelectedPaymentId={setSelectedPaymentId}
        setSelectedPaymentAmount={setSelectedPaymentAmount}
        setIsOpenViewPaymentDialog={setIsOpenViewPaymentDialog}
        setIsOpenRefundPaymentDialog={() => null}
        setConfirmRefundOpen={() => null}
        loading={loading}
        fetchError={fetchError}
      />
      {/* Dialog for Edit Payment */}
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
