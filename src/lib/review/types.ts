// Shapes shared by the review API and the /review page. No server imports here: the page imports
// this file too.

export const REVIEW_KINDS = ["client_missing_accent", "client_surname_in_name", "client_inactive"] as const;
export type ReviewKind = (typeof REVIEW_KINDS)[number];

export const isReviewKind = (v: unknown): v is ReviewKind =>
  typeof v === "string" && (REVIEW_KINDS as readonly string[]).includes(v);

export type ReviewStatus = "open" | "decided" | "deferred";

/** apply = make the proposed change; keep = the data is right as it is; later = decide another day. */
export type ReviewAction = "apply" | "keep" | "later";

/** The client as it was when the check found the problem. */
export type ClientSnapshot = {
  client_name: string | null;
  client_surname: string | null;
  client_phone: string | null;
  client_email: string | null;
};

/** One word that normally carries an accent: where the suggestion comes from and how often it's seen. */
export type AccentWord = {
  from: string;
  to: string;
  /** "spanish": the usual Spanish spelling. "clients": other clients spell it that way. */
  source: "spanish" | "clients";
  /** Active clients whose name or surname has the accented spelling. */
  seen: number;
};

export type MissingAccentDetails = ClientSnapshot & { words: AccentWord[] };
export type SurnameInNameDetails = ClientSnapshot;
export type InactiveDetails = ClientSnapshot & {
  client_notes: string | null;
  created_at: string;
  deleted_bookings: number;
  last_deleted_booking: string | null;
  /** Bookings once linked to this client that now belong to another one (merges, corrections). */
  moved_bookings: number;
  deleted_vouchers: number;
};

/** The proposal of both name checks, and what "apply" sends for them. */
export type NameProposal = { client_name: string; client_surname: string | null };

export type ReviewItem = {
  id: string;
  kind: ReviewKind;
  client_id: string | null;
  booking_id: string | null;
  voucher_id: string | null;
  business_date: string | null;
  details: unknown;
  proposal: unknown;
  status: ReviewStatus;
  decision: Record<string, unknown> | null;
  note: string | null;
  decided_at: string | null;
  applied_at: string | null;
  /** Changes when a search refreshes the details, so the page can reset its edits. */
  updated_at: string;
};

export type ReviewCounts = Record<ReviewKind, { open: number; deferred: number; decided: number }>;

export type ReviewListResponse = {
  counts: ReviewCounts;
  /** Open and deferred items of the requested kind. */
  items: ReviewItem[];
  /** The latest decisions of the requested kind, newest first. */
  recent: ReviewItem[];
};

/** Error codes the review routes return, so the page can explain them. */
export type ReviewError =
  | "STALE_ITEM"
  | "ALREADY_DECIDED"
  | "INVALID_NAME"
  | "CLIENT_NOT_FOUND"
  | "CLIENT_HAS_HISTORY"
  | "CHANGED_SINCE"
  | "CONTACT_TAKEN"
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "FAILED";
