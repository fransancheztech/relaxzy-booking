// Emails are stored trimmed and lower-cased: one spelling per address, so the unique index on
// clients.client_email can tell two clients apart. Before this, only the client edit screen
// lower-cased, and "Ana@Gmail.com" typed in a booking became a second client next to
// "ana@gmail.com". The database enforces the same rule (CHECK clients_email_canonical).

/** The stored form of an email: trimmed and lower-cased, or null when empty. */
export function canonicalEmail(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}
