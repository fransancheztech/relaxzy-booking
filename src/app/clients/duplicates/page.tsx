import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { redirect } from "next/navigation";
import DuplicatesPageContent from "./DuplicatesPageContent";

// Admin-only: resolving a group rewrites which client its bookings belong to.
const DuplicatesPage = async () => {
  const role = await getCurrentUserRole();
  if (!role) redirect("/");
  if (role !== "admin") redirect("/clients");

  return <DuplicatesPageContent />;
};

export default DuplicatesPage;
