import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { redirect } from "next/navigation";
import { canViewHours } from "@/lib/hours/window";
import HoursPageContent from "./HoursPageContent";

const HoursPage = async () => {
  const role = await getCurrentUserRole();
  if (!role) redirect("/");
  // Admins and therapists only — a receptionist reaching /hours by URL lands on the calendar.
  if (!canViewHours(role)) redirect("/calendar");

  return <HoursPageContent role={role} />;
};

export default HoursPage;
