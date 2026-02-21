import { PaymentRefundFormOutput } from "@/schemas/paymentRefund.schema";
import { toast } from "react-toastify";

interface Params extends PaymentRefundFormOutput {
  paymentId: string;
}

export default async function handleSubmitRefund({
  paymentId,
  amount,
  method,
  notes,
}: Params): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/payments/${paymentId}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, method, notes }),
    });

    if (!res.ok) {
      const data = await res.json();
      toast.error(data?.error || `Unknown error in refund`);
      return {
        success: false,
        error: data?.error ?? "Unknown error in refund",
      };
    }
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("refreshCalendarData"));
    }, 500);
    toast.success("The refund has been successfully processed.");
    return { success: true };
  } catch (err) {
    console.error("Refund failed", err);
    return { success: false, error: "Network or server error" };
  }
}
