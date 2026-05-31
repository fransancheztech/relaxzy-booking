// Shared client-conflict contract between the booking API routes and the dialog UI.
// A "slot" is a single client reference inside a booking request: the primary client
// ("primary") or a companion ("companion-0", "companion-1", …).

export type ClientResolution = "use_existing" | "update_existing";

export type ClientConflictParty = {
  name: string | null;
  surname: string | null;
  email: string | null;
  phone: string | null;
};

export type ClientConflict = {
  slot: string; // "primary" | "companion-<index>"
  matchedBy: "email" | "phone";
  existing: { id: string } & ClientConflictParty;
  typed: ClientConflictParty;
};

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
  | { status: "contact_taken" }
  | { status: "error" };

// Editing a client by id can't be a name conflict (the record is fixed), only a
// contact collision with another client — carry that other client's name so the
// dialog can say whose phone/email it is.
export type ClientUpdateResult =
  | { status: "ok" }
  | { status: "contact_taken"; name?: string | null; field?: "email" | "phone" }
  | { status: "error" };
