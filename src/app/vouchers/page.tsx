'use client'
import { useEffect, useState } from "react";
import { useLayout } from "../context/LayoutContext";
import { useTranslations } from "next-intl";
import NewVoucherDialog from "./NewVoucherDialog";
import VouchersTable from "./VouchersTable";

const VouchersPage = () => {
  const { setButtonLabel, setOnButtonClick } = useLayout();
  const t = useTranslations("Vouchers");
  const [isOpenNewVoucherDialog, setIsOpenNewVoucherDialog] = useState(false);
  // -------------------------------
  // Layout button
  // -------------------------------
  useEffect(() => {
    setButtonLabel(t("newVoucher"));
    setOnButtonClick(() => () => setIsOpenNewVoucherDialog((prev) => !prev));
    return () => {
      setButtonLabel("");
      setOnButtonClick(null);
    };
  }, [setButtonLabel, setOnButtonClick, t]);
  
  return (
    <main className="p-4">
      <VouchersTable />
      <NewVoucherDialog open={isOpenNewVoucherDialog} onClose={() => setIsOpenNewVoucherDialog(false)} />
    </main>
  )
}

export default VouchersPage