import type { Prisma } from "generated/prisma";
import type { review_items } from "generated/prisma/client";
import { normalizeClientName, normalizeClientSurname } from "@/utils/names";
import { isPlaceholderClientName } from "@/utils/placeholderName";
import type { ClientSnapshot, NameProposal } from "@/lib/review/types";
import type { ApplyInput, CheckFailure } from "./types";

const same = (a: string | null | undefined, b: string | null | undefined) => (a ?? "") === (b ?? "");

/**
 * "Apply" for the two name checks: writes the reviewed name and surname, through the same
 * normalisation as the client form. Refuses when the client was edited after the check ran, so a
 * newer edit is never overwritten with a suggestion based on the old name.
 */
export async function applyNameChange(
  tx: Prisma.TransactionClient,
  item: review_items,
  input: ApplyInput,
): Promise<{ decision: Prisma.InputJsonObject } | CheckFailure> {
  const before = item.details as unknown as ClientSnapshot;
  const name = typeof input.client_name === "string" ? normalizeClientName(input.client_name) : null;
  const surname = typeof input.client_surname === "string" ? normalizeClientSurname(input.client_surname) : null;
  if (!name || name.length > 100 || (surname?.length ?? 0) > 100 || isPlaceholderClientName(name)) {
    return { error: "INVALID_NAME", status: 400 };
  }
  if (!item.client_id) return { error: "CLIENT_NOT_FOUND", status: 404 };

  const client = await tx.clients.findFirst({
    where: { id: item.client_id, deleted_at: null },
    select: { client_name: true, client_surname: true },
  });
  if (!client) return { error: "CLIENT_NOT_FOUND", status: 404 };
  if (!same(client.client_name, before.client_name) || !same(client.client_surname, before.client_surname)) {
    return { error: "STALE_ITEM", status: 409 };
  }

  await tx.clients.update({
    where: { id: item.client_id },
    data: { client_name: name, client_surname: surname, updated_at: new Date() },
  });
  return { decision: { action: "apply", client_name: name, client_surname: surname } };
}

/** Puts the name and surname back as they were, unless they were edited again after the change. */
export async function revertNameChange(tx: Prisma.TransactionClient, item: review_items): Promise<CheckFailure | null> {
  const before = item.details as unknown as ClientSnapshot;
  const after = item.decision as unknown as NameProposal;
  if (!item.client_id) return { error: "CLIENT_NOT_FOUND", status: 404 };

  const client = await tx.clients.findFirst({
    where: { id: item.client_id, deleted_at: null },
    select: { client_name: true, client_surname: true },
  });
  if (!client) return { error: "CLIENT_NOT_FOUND", status: 404 };
  if (!same(client.client_name, after.client_name) || !same(client.client_surname, after.client_surname)) {
    return { error: "CHANGED_SINCE", status: 409 };
  }

  await tx.clients.update({
    where: { id: item.client_id },
    data: { client_name: before.client_name, client_surname: before.client_surname, updated_at: new Date() },
  });
  return null;
}
