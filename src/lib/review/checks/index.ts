import type { ReviewKind } from "@/lib/review/types";
import { clientInactive } from "./clientInactive";
import { clientMissingAccent } from "./clientMissingAccent";
import { clientSurnameInName } from "./clientSurnameInName";
import type { ReviewCheck } from "./types";

export const REVIEW_CHECKS: Record<ReviewKind, ReviewCheck> = {
  client_missing_accent: clientMissingAccent,
  client_surname_in_name: clientSurnameInName,
  client_inactive: clientInactive,
};
