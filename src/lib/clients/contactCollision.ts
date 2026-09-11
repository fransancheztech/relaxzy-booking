import { Prisma } from "generated/prisma";
import { CLIENT_CONTACT_TAKEN } from "@/types/clientConflict";

// One canonical answer to the question every client-writing surface needs to ask:
// "this phone/email collided — WHICH field, and WHOSE is it?"
//
// Before this module each surface improvised: some returned a bare CLIENT_CONTACT_TAKEN with no
// detail, one returned a hardcoded English sentence that bypassed i18n entirely. The lookup is
// small but easy to get subtly wrong (forgetting deleted_at, checking phone before email), so it
// lives here once and every surface calls it.

export type ContactField = "email" | "phone";

/** Display name for the client that already owns a contact value. */
export const clientFullName = (c: {
  client_name: string | null;
  client_surname: string | null;
}) => [c.client_name, c.client_surname].filter(Boolean).join(" ").trim() || null;

/**
 * A phone/email write collided with another active client's unique index. Carries enough for the
 * UI to name the field and the owner, instead of the unactionable "that phone or email already
 * belongs to another client".
 */
export class ContactTakenError extends Error {
  constructor(
    public field: ContactField,
    public clientName: string | null,
    /** Slot label when one request touches several clients (e.g. "buyer", "recipient"). */
    public party?: string,
  ) {
    super(CLIENT_CONTACT_TAKEN);
  }
}

export type ContactCheck = {
  email?: string | null;
  phone?: string | null;
  /** The client being updated, excluded from the search. Omit when creating. */
  excludeClientId?: string;
  party?: string;
};

/**
 * Throws ContactTakenError if the email or phone already belongs to a *different* active client.
 *
 * This is a pre-check: it exists to produce a precise message before anything is written. It does
 * NOT replace catching P2002 — a contact can be claimed between this check and the write — so
 * callers keep the unique-violation catch as a backstop.
 */
export async function assertContactFree(
  db: Prisma.TransactionClient,
  { email, phone, excludeClientId, party }: ContactCheck,
): Promise<void> {
  const exclude = excludeClientId ? { NOT: { id: excludeClientId } } : {};

  if (email) {
    const other = await db.clients.findFirst({
      where: { client_email: email, deleted_at: null, ...exclude },
      select: { client_name: true, client_surname: true },
    });
    if (other) throw new ContactTakenError("email", clientFullName(other), party);
  }
  if (phone) {
    const other = await db.clients.findFirst({
      where: { client_phone: phone, deleted_at: null, ...exclude },
      select: { client_name: true, client_surname: true },
    });
    if (other) throw new ContactTakenError("phone", clientFullName(other), party);
  }
}

/** A Prisma unique-constraint violation. */
export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "P2002"
  );
}

/**
 * Turn a P2002 that already happened into a precise error. The colliding row is guaranteed to
 * exist by the time we get here, so re-running the check finds its owner — which keeps the 409
 * body populated even in the race the pre-check can't cover. Returns null if nothing is found
 * (the collision was on something other than a client contact).
 */
export async function describeContactCollision(
  db: Prisma.TransactionClient,
  check: ContactCheck,
): Promise<ContactTakenError | null> {
  try {
    await assertContactFree(db, check);
    return null;
  } catch (err) {
    return err instanceof ContactTakenError ? err : null;
  }
}

/** The single 409 body shape every surface returns, so one contract feeds every dialog. */
export function contactTakenBody(err: ContactTakenError) {
  return {
    error: CLIENT_CONTACT_TAKEN,
    conflict: { party: err.party, field: err.field, name: err.clientName },
  };
}
