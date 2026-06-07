import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "generated/prisma";
import { CLIENT_CONTACT_TAKEN } from "@/types/clientConflict";

const norm = (v?: string | null) => (v && v.trim() !== "" ? v.trim() : null);

const fullName = (c: { client_name: string | null; client_surname: string | null }) =>
  [c.client_name, c.client_surname].filter(Boolean).join(" ").trim() || null;

// Thrown when a buyer/recipient contact edit collides with another client's unique
// phone/email — surfaced as a clear 409 instead of a raw P2002 / 500.
class ContactTakenError extends Error {
  constructor(
    public party: "buyer" | "recipient",
    public field: "email" | "phone",
    public clientName: string | null,
  ) {
    super(CLIENT_CONTACT_TAKEN);
  }
}

// Reject a new email/phone already held by a *different* active client.
async function assertContactFree(
  tx: Prisma.TransactionClient,
  clientId: string,
  party: "buyer" | "recipient",
  email: string | null,
  phone: string | null,
) {
  if (email) {
    const other = await tx.clients.findFirst({
      where: { client_email: email, deleted_at: null, NOT: { id: clientId } },
      select: { client_name: true, client_surname: true },
    });
    if (other) throw new ContactTakenError(party, "email", fullName(other));
  }
  if (phone) {
    const other = await tx.clients.findFirst({
      where: { client_phone: phone, deleted_at: null, NOT: { id: clientId } },
      select: { client_name: true, client_surname: true },
    });
    if (other) throw new ContactTakenError(party, "phone", fullName(other));
  }
}

// Vouchers with any remaining balance must be refunded to 0 before deletion.
// Tolerance covers any residual float-precision drift in the stored Decimal.
const BALANCE_ZERO_EPSILON = 0.005;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const voucher = await prisma.vouchers.findFirst({ where: { id, deleted_at: null } });
    if (!voucher) {
      return NextResponse.json({ error: "Voucher not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // Voucher own fields
      const voucherData: Record<string, unknown> = {};
      if (body.created_at !== undefined) {
        const d = new Date(body.created_at);
        if (!Number.isNaN(d.getTime())) voucherData.created_at = d;
      }
      if (body.expiration_date !== undefined) {
        const d = new Date(body.expiration_date);
        if (!Number.isNaN(d.getTime())) voucherData.expiration_date = d;
      }
      if ("notes" in body) voucherData.notes = norm(body.notes);
      if ("source" in body && (body.source === "physical" || body.source === "online")) {
        voucherData.source = body.source;
      }
      if ("external_reference" in body) {
        const ref = norm(body.external_reference);
        const effectiveSource = (voucherData.source as "physical" | "online" | undefined) ?? voucher.source;
        voucherData.external_reference =
          ref && effectiveSource === "online" && !ref.startsWith("#") ? `#${ref}` : ref;
      }

      if (Object.keys(voucherData).length > 0) {
        await tx.vouchers.update({ where: { id }, data: voucherData });
      }

      // Buyer client
      if (body.buyer_name !== undefined) {
        const email = norm(body.buyer_email);
        const phone = norm(body.buyer_phone);
        await assertContactFree(tx, voucher.buyer_id, "buyer", email, phone);
        await tx.clients.update({
          where: { id: voucher.buyer_id },
          data: {
            client_name: norm(body.buyer_name),
            client_surname: norm(body.buyer_surname),
            client_phone: phone,
            client_email: email,
          },
        });
      }

      // Recipient client (only when they are a different person from the buyer)
      const recipientId = voucher.recipient_id;
      if (body.recipient_name !== undefined && recipientId && recipientId !== voucher.buyer_id) {
        const email = norm(body.recipient_email);
        const phone = norm(body.recipient_phone);
        await assertContactFree(tx, recipientId, "recipient", email, phone);
        await tx.clients.update({
          where: { id: recipientId },
          data: {
            client_name: norm(body.recipient_name),
            client_surname: norm(body.recipient_surname),
            client_phone: phone,
            client_email: email,
          },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof ContactTakenError) {
      return NextResponse.json(
        {
          error: CLIENT_CONTACT_TAKEN,
          conflict: { party: err.party, field: err.field, name: err.clientName },
        },
        { status: 409 },
      );
    }
    if (typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: CLIENT_CONTACT_TAKEN }, { status: 409 });
    }
    console.error("Error updating voucher", err);
    return NextResponse.json({ error: "Error updating voucher" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const voucher = await prisma.vouchers.findFirst({
      where: { id, deleted_at: null },
      select: { id: true, balance: true },
    });
    if (!voucher) {
      return NextResponse.json({ error: "Voucher not found" }, { status: 404 });
    }

    const balance = Number(voucher.balance ?? 0);
    if (Math.abs(balance) >= BALANCE_ZERO_EPSILON) {
      return NextResponse.json(
        { error: "Voucher has a remaining balance. Refund it to 0 before deleting." },
        { status: 409 },
      );
    }

    await prisma.vouchers.update({
      where: { id },
      data: { deleted_at: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error deleting voucher", err);
    return NextResponse.json({ error: "Error deleting voucher" }, { status: 500 });
  }
}
