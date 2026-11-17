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
  note: string | null;
};

export type ReviewCheck = {
  /** Stored in review_items.source. */
  source: string;
  /** Read-only: every problem of this kind in the current data. */
  find(db: Prisma.TransactionClient): Promise<Candidate[]>;
  /**
   * Makes the change inside the caller's transaction (app.user_id is already set) and returns the
   * decision to store. Checks before writing, so a failure leaves nothing to roll back.
   */
  apply(tx: Prisma.TransactionClient, item: review_items, input: ApplyInput): Promise<{ decision: Prisma.InputJsonObject } | CheckFailure>;
  /** Undoes an applied decision, if the data hasn't changed since. Returns null on success. */
  revert(tx: Prisma.TransactionClient, item: review_items): Promise<CheckFailure | null>;
};
