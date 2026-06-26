import { DateTime } from "luxon";
import { BUSINESS_TIMEZONE } from "@/constants";

// Always formats in the business timezone (Europe/Madrid), never the device zone.
export const formatDateTime = (value: Date | null | undefined): string => {
  if (!value) return "—";
  const dt = DateTime.fromJSDate(value).setZone(BUSINESS_TIMEZONE);
  return dt.isValid ? dt.toFormat("dd/MM/yyyy HH:mm:ss") : "—";
};
