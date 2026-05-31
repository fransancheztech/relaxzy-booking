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

// Resolve an existing active client by email (priority) then phone.
async function findClientMatch(
  tx: Prisma.TransactionClient,
  input: ClientInput,
): Promise<{ client: MatchedClient; matchedBy: "email" | "phone" } | null> {
  const email = normalize(input.client_email);
  const phone = normalize(input.client_phone);

  if (email) {
    const client = await tx.clients.findFirst({ where: { client_email: email, deleted_at: null } });
    if (client) return { client, matchedBy: "email" };
  }
  if (phone) {
    const client = await tx.clients.findFirst({ where: { client_phone: phone, deleted_at: null } });
    if (client) return { client, matchedBy: "phone" };
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
  if (!match || !nameDiffers(input, match.client)) return null;

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
