import { VoucherSchemaType } from "@/schemas/voucher.schema";
import { toast } from "react-toastify";
import {
  CLIENT_CONTACT_TAKEN,
  CLIENT_NAME_CONFLICT,
  type BookingSubmitResult,
  type ClientResolution,
} from "@/types/clientConflict";

const handleSubmitCreateVoucher = async (
  data: VoucherSchemaType,
  clientResolutions?: Record<string, ClientResolution>,
): Promise<BookingSubmitResult> => {
  try {
    const res = await fetch("/api/vouchers/new", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, clientResolutions }),
    });

    const result = await res.json();

    if (!res.ok) {
      // Name conflicts and contact collisions are handled by the caller (dialog).
      if (res.status === 409 && result?.error === CLIENT_NAME_CONFLICT) {
        return { status: "conflict", conflicts: result.conflicts ?? [] };
      }
      if (res.status === 409 && result?.error === CLIENT_CONTACT_TAKEN) {
        return { status: "contact_taken" };
      }
      toast.error(result?.error || `Error creating voucher`);
      return { status: "error" };
    }

    toast.success("The voucher has been created successfully.");

    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("refreshVouchersData"));
    }, 500);
    return { status: "ok" };
  } catch (err) {
    console.error(`Network or server error creating voucher`, err);
    toast.error("Network or server error creating voucher");
    return { status: "error" };
  }
};

export default handleSubmitCreateVoucher;
