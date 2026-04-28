import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { redirect } from "next/navigation";

const StatsPage = async () => {
  const role = await getCurrentUserRole();
  if (role !== "admin") redirect("/");

  return <div>StatsPage</div>;
};

export default StatsPage;
