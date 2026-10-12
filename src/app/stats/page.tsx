import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { redirect } from "next/navigation";
import StatsPageContent from "./StatsPageContent";

const StatsPage = async () => {
  const role = await getCurrentUserRole();
  if (!role) redirect("/");
  // Every section here is admin data (/api/stats 403s for anyone else). Therapist hours
  // used to be the one exception shown to other roles; it now lives on /hours, so there is
  // nothing left for a receptionist or therapist to see.
  if (role !== "admin") redirect("/calendar");

  return <StatsPageContent />;
};

export default StatsPage;
