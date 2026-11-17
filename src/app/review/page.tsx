import { getCurrentUserRole } from "@/lib/auth/getCurrentUserRole";
import { redirect } from "next/navigation";
import ReviewPageContent from "./ReviewPageContent";

// Admin-only and temporary: the old-data cleanup (plans/2026-11-17-old-data-review-page.md).
// Decisions here rename and retire clients.
const ReviewPage = async () => {
  const role = await getCurrentUserRole();
  if (!role) redirect("/");
  if (role !== "admin") redirect("/calendar");

  return <ReviewPageContent />;
};

export default ReviewPage;
