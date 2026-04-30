import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { redirect } from "next/navigation";
import StatsPageContent from "./StatsPageContent";

const StatsPage = async () => {
  const role = await getCurrentUserRole();
  if (role !== "admin") redirect("/");

  return <StatsPageContent />;
};

export default StatsPage;
