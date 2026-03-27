import { VoucherSchemaType } from "@/schemas/voucher.schema";
import { toast } from "react-toastify";

const handleSubmitCreateVoucher = async (data: VoucherSchemaType) => {
  try {
    const res = await fetch("/api/vouchers/new", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await res.json();

    if (!res.ok) {
      toast.error(result?.error || `Error creating voucher`);
      return;
    }

    toast.success("The voucher has been created successfully.");

    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("refreshCalendarData"));
    }, 500);
  } catch (err) {
    console.error(`Network or server error creating voucher`, err);
    toast.error("Network or server error creating voucher");
  }
};

export default handleSubmitCreateVoucher;
