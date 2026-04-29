import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { redirect } from "next/navigation";
import TipsPageContent from "./TipsPageContent";

const TipsPage = async () => {
  const role = await getCurrentUserRole();
  if (role !== "admin") redirect("/");

  return <TipsPageContent />;
};

export default TipsPage;
