import type { Prisma } from "generated/prisma";
import type { review_items } from "generated/prisma/client";
import type { ReviewError } from "@/lib/review/types";

/** One problem a check found, before it is stored as a review item. */
export type Candidate = {
  /** Stable identity within the kind, e.g. the client id. */
  item_key: string;
  client_id?: string | null;
  booking_id?: string | null;
  voucher_id?: string | null;
  business_date?: Date | null;
  details: Prisma.InputJsonObject;
  proposal: Prisma.InputJsonObject | null;
};

export type CheckFailure = { error: ReviewError; status: number };

/** What the reviewer sent with "apply". Each check validates the fields it uses. */
export type ApplyInput = {
  client_name?: unknown;
  client_surname?: unknown;
  /** The decision form of kinds that only record a decision (vouchers). */
  values?: unknown;
  note: string | null;
};

export type ReviewCheck = {
  /** Stored in review_items.source. */
  source: string;
  /**
   * Read-only: every problem of this kind in the current data. For an imported kind, every
   * imported item with its proposal worked out again against the current data.
   */
  find(db: Prisma.TransactionClient): Promise<Candidate[]>;
  /**
   * Makes the change inside the caller's transaction (app.user_id is already set) and returns the
   * decision to store. Checks before writing, so a failure leaves nothing to roll back. A kind that
   * only records decisions validates the form and changes nothing.
   */
  apply(tx: Prisma.TransactionClient, item: review_items, input: ApplyInput): Promise<{ decision: Prisma.InputJsonObject } | CheckFailure>;
  /** Undoes an applied decision, if the data hasn't changed since. Returns null on success. */
  revert(tx: Prisma.TransactionClient, item: review_items): Promise<CheckFailure | null>;
  /**
   * For kinds that only record decisions: true when the decision still has to reach the data
   * (a voucher to add, a use to record), so applied_at stays empty until the SQL is run.
   */
  needsFollowUp?(decision: Prisma.InputJsonObject): boolean;
  /** For imported kinds: turns the uploaded file into items (details only; find adds proposals). */
  importItems?(raw: unknown): { candidates: Candidate[] } | { error: string };
  /** A decision taken without the reviewer when the proposal leaves no doubt (null otherwise). */
  autoDecide?(candidate: Candidate): Prisma.InputJsonObject | null;
};
