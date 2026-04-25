'use client'
import { useEffect, useState } from "react";
import { useLayout } from "../context/LayoutContext";
import NewVoucherDialog from "./NewVoucherDialog";
import VouchersTable from "./VouchersTable";

const VouchersPage = () => {
  const { setButtonLabel, setOnButtonClick } = useLayout();
  const [isOpenNewVoucherDialog, setIsOpenNewVoucherDialog] = useState(false);
  // -------------------------------
  // Layout button
  // -------------------------------
  useEffect(() => {
    setButtonLabel("New Voucher");
    setOnButtonClick(() => () => setIsOpenNewVoucherDialog((prev) => !prev));
    return () => {
      setButtonLabel("");
      setOnButtonClick(null);
    };
  }, [setButtonLabel, setOnButtonClick]);
  
  return (
    <main className="p-4">
      <VouchersTable />
      <NewVoucherDialog open={isOpenNewVoucherDialog} onClose={() => setIsOpenNewVoucherDialog(false)} />
    </main>
  )
}

export default VouchersPage