// Shared client-conflict contract between the booking API routes and the dialog UI.
// A "slot" is a single client reference inside a booking request: the primary client
// ("primary") or a companion ("companion-0", "companion-1", …).

// "use_existing" / "update_existing" answer a contact conflict (the phone/email belongs to someone
// with another name). "create_new" / "link:<client id>" answer a contactless conflict (a client with
// this name exists without phone or email: is it the same person?).
export type ClientResolution = "use_existing" | "update_existing" | "create_new" | `link:${string}`;

export type ClientConflictParty = {
  name: string | null;
  surname: string | null;
  email: string | null;
  phone: string | null;
};

/** The typed phone/email already belongs to a client whose name is different. */
export type ContactClientConflict = {
  kind: "contact";
  slot: string; // "primary" | "companion-<index>" | "buyer" | "recipient"
  matchedBy: "email" | "phone";
  existing: { id: string } & ClientConflictParty;
  typed: ClientConflictParty;
};

/** A voucher the candidate holds, shown so the receptionist can ask "did you get a gift voucher?". */
export type CandidateVoucher = {
  code: string;
  balance: number;
  role: "recipient" | "buyer";
  /** The other party: the buyer of a voucher they received, or the recipient of one they bought. */
  otherName: string | null;
};

export type ContactlessCandidate = {
  id: string;
  name: string | null;
  surname: string | null;
  created_at: string;
  bookings: number;
  last_visit: string | null;
  vouchers: CandidateVoucher[];
};

/**
 * Nobody has the typed phone/email, but one or more clients with the same name exist WITHOUT any
 * contact details. Saving would create a second record for what may be the same person (e.g. a gift
 * voucher recipient saved by first name only, now booking with her phone).
 */
export type ContactlessClientConflict = {
  kind: "contactless";
  slot: string;
  typed: ClientConflictParty;
  candidates: ContactlessCandidate[];
};

export type ClientConflict = ContactClientConflict | ContactlessClientConflict;

/**
 * What saving the client fields will do, computed by the same code that saves them. Drives the live
 * hint under the client fields, so the receptionist knows before saving whether a client will be
 * created, reused or updated.
 */
export type ClientPreview =
  | { kind: "none" }
  | {
      kind: "existing";
      client: ClientConflictParty & { id: string; bookings: number };
      /**
       * What the save changes on that client: empty phone / email / surname filled in, or a name /
       * surname whose typed spelling only adds accents ("Jesus" → "Jesús"). Nothing is overwritten.
       */
      fill: { phone: string | null; email: string | null; surname: string | null; name: string | null };
    }
  | { kind: "contact_conflict"; matchedBy: "email" | "phone"; existing: ClientConflictParty }
  | { kind: "contactless_conflict"; candidates: ContactlessCandidate[] }
  | { kind: "new" };

// 409 body returned when one or more slots need an explicit decision.
export const CLIENT_NAME_CONFLICT = "CLIENT_NAME_CONFLICT";
// 409 body returned when an overwrite would collide with the unique phone/email index.
export const CLIENT_CONTACT_TAKEN = "CLIENT_CONTACT_TAKEN";

export type ClientConflictResponse = {
  error: typeof CLIENT_NAME_CONFLICT;
  conflicts: ClientConflict[];
};

// Result of a booking create/update submit, so the dialog can react to a
// name conflict (open the resolution dialog) or a contact collision (toast).
export type BookingSubmitResult =
  | { status: "ok" }
  | { status: "conflict"; conflicts: ClientConflict[] }
  // Required (though nullable) so a handler cannot quietly drop the detail and leave the
  // dialog showing the old "phone or email" message.
  | { status: "contact_taken"; field: "email" | "phone" | null; name: string | null }
  | { status: "error" };

// Creating a client can only fail on a contact collision with an existing client. Fields are
// required (though nullable) so a handler cannot quietly forget to pass the detail through —
// which is exactly how the vague "phone or email" message survived on five surfaces.
export type CreateClientResult =
  | { status: "ok"; client: unknown }
  | { status: "contact_taken"; field: "email" | "phone" | null; name: string | null }
  | { status: "error" };

// Editing a client by id can't be a name conflict (the record is fixed), only a
// contact collision with another client — carry that other client's name so the
// dialog can say whose phone/email it is.
export type ClientUpdateResult =
  | { status: "ok" }
  | { status: "contact_taken"; name?: string | null; field?: "email" | "phone" }
  | { status: "error" };
