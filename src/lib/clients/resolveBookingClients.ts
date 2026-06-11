import { Prisma } from "generated/prisma";
import type { ClientConflict, ClientResolution } from "@/types/clientConflict";

export type ClientInput = {
  client_name?: string | null;
  client_surname?: string | null;
  client_email?: string | null;
  client_phone?: string | null;
};

const normalize = (v?: string | null) => (v && v.trim() !== "" ? v.trim() : null);
const sameText = (a?: string | null, b?: string | null) =>
  (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

export class ClientConflictError extends Error {
  conflicts: ClientConflict[];
  constructor(conflicts: ClientConflict[]) {
    super("CLIENT_NAME_CONFLICT");
    this.name = "ClientConflictError";
    this.conflicts = conflicts;
  }
}

export const hasClientInfo = (input: ClientInput) =>
  !!(input.client_name || input.client_surname || input.client_email || input.client_phone);

type MatchedClient = {
  id: string;
  client_name: string | null;
  client_surname: string | null;
  client_email: string | null;
  client_phone: string | null;
};

// Resolve an existing active client by email (priority), then phone, then — when no
// contact was entered at all — by name. The name tier keeps name-only clients (e.g.
// companions, walk-ins) from being duplicated on every booking: identity derives from
// the entered data, exactly like contact matching. It is scoped to contactless clients
// (email AND phone null) and matches name + surname, so it never folds a name-only entry
// into a contactable client. Names aren't unique, so two genuinely distinct contactless
// people sharing a name will resolve to the same record — acceptable, as they're already
// indistinguishable in the data.
async function findClientMatch(
  tx: Prisma.TransactionClient,
  input: ClientInput,
): Promise<{ client: MatchedClient; matchedBy: "email" | "phone" | "name" } | null> {
  const email = normalize(input.client_email);
  const phone = normalize(input.client_phone);
  const name = normalize(input.client_name);
  const surname = normalize(input.client_surname);

  if (email) {
    const client = await tx.clients.findFirst({ where: { client_email: email, deleted_at: null } });
    if (client) return { client, matchedBy: "email" };
  }
  if (phone) {
    const client = await tx.clients.findFirst({ where: { client_phone: phone, deleted_at: null } });
    if (client) return { client, matchedBy: "phone" };
  }
  if (!email && !phone && name) {
    const client = await tx.clients.findFirst({
      where: {
        deleted_at: null,
        client_email: null,
        client_phone: null,
        client_name: { equals: name, mode: "insensitive" },
        client_surname: surname
          ? { equals: surname, mode: "insensitive" }
          : null,
      },
    });
    if (client) return { client, matchedBy: "name" };
  }
  return null;
}

// True when the typed name/surname (whichever is provided) differs from the matched client.
function nameDiffers(input: ClientInput, match: MatchedClient): boolean {
  const typedName = normalize(input.client_name);
  const typedSurname = normalize(input.client_surname);
  if (typedName && !sameText(typedName, match.client_name)) return true;
  if (typedSurname && !sameText(typedSurname, match.client_surname)) return true;
  return false;
}

// Detect a conflict for one slot. Returns null when there's nothing to confirm:
// no info, no match, name matches, or a resolution was already supplied.
export async function detectClientConflict(
  tx: Prisma.TransactionClient,
  slot: string,
  input: ClientInput,
  resolution?: ClientResolution,
): Promise<ClientConflict | null> {
  if (!hasClientInfo(input) || resolution) return null;
  const match = await findClientMatch(tx, input);
  // A name-tier match can't be a name conflict (the name is the match key), so only
  // contact-tier matches with a differing name need an explicit decision.
  if (!match || match.matchedBy === "name" || !nameDiffers(input, match.client)) return null;

  return {
    slot,
    matchedBy: match.matchedBy,
    existing: {
      id: match.client.id,
      name: match.client.client_name,
      surname: match.client.client_surname,
      email: match.client.client_email,
      phone: match.client.client_phone,
    },
    typed: {
      name: normalize(input.client_name),
      surname: normalize(input.client_surname),
      email: normalize(input.client_email),
      phone: normalize(input.client_phone),
    },
  };
}

// Apply one slot, returning the resolved client id (or null for no client info).
// May throw P2002 if "update_existing" collides with the unique phone/email index —
// callers run inside a transaction so the whole booking write rolls back.
export async function applyClientSlot(
  tx: Prisma.TransactionClient,
  input: ClientInput,
  resolution?: ClientResolution,
  opts: { requireContact?: boolean } = {},
): Promise<string | null> {
  const { requireContact = true } = opts;
  if (!hasClientInfo(input)) return null;
  if (!input.client_name) throw new Error("Client name is required");
  if (requireContact && !input.client_email && !input.client_phone)
    throw new Error("Provide at least a phone or email for the client");

  const match = await findClientMatch(tx, input);

  if (!match) {
    // No existing client matches the entered contact/name — create a new one.
    const created = await tx.clients.create({
      data: {
        client_name: input.client_name,
        client_surname: normalize(input.client_surname),
        client_email: normalize(input.client_email),
        client_phone: normalize(input.client_phone),
      },
    });
    return created.id;
  }

  if (resolution === "update_existing") {
    await tx.clients.update({
      where: { id: match.client.id },
      data: {
        client_name: input.client_name,
        client_surname: normalize(input.client_surname),
        client_email: normalize(input.client_email),
        client_phone: normalize(input.client_phone),
        updated_at: new Date(),
      },
    });
  }

  // "use_existing" (or a name-matching link) keeps the stored record untouched.
  return match.client.id;
}
