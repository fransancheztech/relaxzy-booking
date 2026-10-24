import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { redirect } from "next/navigation";
import PaymentsPageContent from "./PaymentsPageContent";

const PaymentsPage = async () => {
  const role = await getCurrentUserRole();
  if (!role) redirect("/");
  // The raw ledger of every payment, with refunds that show no booking or client: admin only.
  // Receptionists charge and refund from the booking (Manage payments) or the voucher, and
  // reconcile the day with Daily Totals on the calendar. The page's API routes 403 for them too.
  if (role !== "admin") redirect("/calendar");

  return <PaymentsPageContent />;
};

export default PaymentsPage;
