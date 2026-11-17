// Shapes shared by the review API and the /review page. No server imports here: the page imports
// this file too.

export const REVIEW_KINDS = [
  "client_missing_accent",
  "client_surname_in_name",
  "client_inactive",
  "voucher_card",
  "voucher_online_order",
] as const;
export type ReviewKind = (typeof REVIEW_KINDS)[number];

export const isReviewKind = (v: unknown): v is ReviewKind =>
  typeof v === "string" && (REVIEW_KINDS as readonly string[]).includes(v);

/**
 * Kinds whose source data lives outside the system and is uploaded on the page, with the file to
 * upload (both in Documents/Relaxzy/Transcripciones Vouchers). Their client data never enters the repo.
 */
export const IMPORT_FILES: Partial<Record<ReviewKind, string>> = {
  voucher_card: "tarjetas.json",
  voucher_online_order: "pedidos_online.json",
};

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

// ── Vouchers ─────────────────────────────────────────────────────────────────

/** A voucher in the system, as shown next to a card or an online order. */
export type SystemVoucherSummary = {
  id: string;
  code: string;
  source: "physical" | "online";
  external_reference: string | null;
  /** Madrid date of created_at, YYYY-MM-DD. */
  sold: string;
  deleted: boolean;
  buyer: string;
  recipient: string;
  /** Charges minus refunds of the payments linked to the voucher. */
  paid: number;
  balance: number | null;
  /** Each use, with the day of its booking (or of the use when it has no booking). */
  uses: { date: string | null; amount: number }[];
  notes: string | null;
};

/** One physical gift card as transcribed (tarjetas.json), plus what the import derives from it. */
export type VoucherCardDetails = {
  card: string;
  code: string | null;
  de: string | null;
  para: string | null;
  tratamiento_raw: string | null;
  service: string | null;
  duracion_raw: string | null;
  duration_min: number | null;
  fecha_raw: string | null;
  fecha: string | null;
  expiracion_raw: string | null;
  expiracion: string | null;
  /** The blue diagonal line (or an X) that marks a redeemed card. */
  redeemed_line: boolean;
  stamp: boolean;
  notes: string | null;
  confidence: string;
  /** People the card is for: 2 for "60x2", "parejas" or "Ana y Manolo". */
  people: number;
  /** Given by the shop itself (De: Relaxzy Thai Massage or Chalida), so probably not sold. */
  shop_gift: boolean;
};

export type VoucherCandidate = SystemVoucherSummary & { score: number; why: string[] };

/** An online order that a physical card may be the printed copy of. */
export type OnlineOrderRef = {
  invoice: number;
  date: string;
  buyer: string;
  vouchers: number;
  total: number;
  names: string[];
  /** Same day and the buyer's first name: likely enough to preselect. */
  strong: boolean;
};

/** How the card's redeemed mark compares with the uses recorded in the system. */
export type CardUsage = "recorded" | "unrecorded" | "unused" | "unknown";

export type VoucherCardProposal = {
  /** The suggested vouchers come from a code written on the card. */
  by_code: boolean;
  suggested: string[];
  candidates: VoucherCandidate[];
  online_orders: OnlineOrderRef[];
  usage: CardUsage;
};

export type VoucherCardDecision = {
  action: "apply";
  /** system: it is these vouchers. online_order: the printed copy of an online order. missing: not in the system. */
  link: "system" | "online_order" | "missing";
  voucher_ids: string[];
  invoice: number | null;
  used: CardUsage;
  shop_gift: boolean;
};

/** One online order (pedidos_online.json): the shop export joined with its e-mails. */
export type OnlineOrderDetails = {
  invoice: number;
  order_id: number;
  date: string;
  buyer: string;
  email: string | null;
  total: number;
  payment_type: string;
  paid: boolean;
  status: string;
  items: { name: string; qty: number; line_total: number }[];
  forms: { date: string; para: string; de: string; message: string }[];
  vouchers: number;
};

export type OnlineOrderStatus = "ok" | "missing" | "only_deleted" | "count_differs" | "amount_differs";

export type OnlineOrderProposal = {
  status: OnlineOrderStatus;
  /** Vouchers whose external reference is this order's number, deleted ones included. */
  system: SystemVoucherSummary[];
  live_count: number;
  paid_total: number;
};

/** ok: the system is right. missing: vouchers to add. fix: something to correct (see the note). test: not a real sale. */
export type OnlineOrderOutcome = "ok" | "missing" | "fix" | "test";
export type OnlineOrderDecision = { action: "apply"; outcome: OnlineOrderOutcome; auto?: boolean };

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
  /** Null for an automatic decision. */
  decided_by: string | null;
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
  | "VOUCHER_NOT_FOUND"
  | "NOTE_REQUIRED"
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "FAILED";
