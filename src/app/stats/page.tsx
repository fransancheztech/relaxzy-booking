import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { redirect } from "next/navigation";
import StatsPageContent from "./StatsPageContent";

const StatsPage = async () => {
  const role = await getCurrentUserRole();
  if (!role) redirect("/");

  return <StatsPageContent role={role} />;
};

export default StatsPage;
