import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Body = {
  recipient_name?: string;
  recipient_surname?: string;
  recipient_phone?: string;
  recipient_email?: string;
  buyer_name?: string;
  buyer_surname?: string;
  buyer_phone?: string;
  buyer_email?: string;
  initial_balance?: number | string;
  initial_payment_code?: string | null;
  notes?: string;
  expiration_date?: string | Date;
};

const normalizeString = (v?: string | null) =>
  v && v.trim() !== "" ? v.trim() : null;

/** DDMMYY in UTC, matching e.g. V-150326-1 */
function formatDdMmYyUtc(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}${pad(d.getUTCMonth() + 1)}${pad(d.getFullYear() % 100)}`;
}

function utcDayBounds(d: Date): { start: Date; end: Date } {
  const start = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
  );
  const end = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0, 0),
  );
  return { start, end };
}

function nextSequenceForPrefix(
  codes: { code: string }[],
  prefix: string,
): number {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${escaped}(\\d+)$`);
  let max = 0;
  for (const { code } of codes) {
    const m = code.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

async function findOrCreateClientFromVoucher(
  prefix: "buyer" | "recipient",
  body: Body,
) {
  const name = normalizeString(
    (body as Record<string, unknown>)[`${prefix}_name`] as string | undefined,
  );
  const surname = normalizeString(
    (body as Record<string, unknown>)[`${prefix}_surname`] as string | undefined,
  );
  const email = normalizeString(
    (body as Record<string, unknown>)[`${prefix}_email`] as string | undefined,
  );
  const phone = normalizeString(
    (body as Record<string, unknown>)[`${prefix}_phone`] as string | undefined,
  );

  if (!name || (!email && !phone)) {
    throw new Error(
      `${prefix} must have a name and at least an email or phone`,
    );
  }

  let clientId: string | null = null;

  if (email) {
    const clientByEmail = await prisma.clients.findFirst({
      where: { client_email: email, deleted_at: null },
    });
    clientId = clientByEmail?.id ?? null;
  }

  if (!clientId && phone) {
    const clientByPhone = await prisma.clients.findFirst({
      where: { client_phone: phone, deleted_at: null },
    });
    clientId = clientByPhone?.id ?? null;
  }

  if (!clientId) {
    const created = await prisma.clients.create({
      data: {
        client_name: name,
        client_surname: surname,
        client_email: email,
        client_phone: phone,
      },
    });
    clientId = created.id;
  }

  return clientId;
}

const MAX_CODE_RETRIES = 8;

function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

export async function POST(request: Request) {
  try {
    const body: Body = await request.json();

    if (
      body.initial_balance === undefined ||
      body.initial_balance === null ||
      body.initial_balance === ""
    ) {
      return NextResponse.json(
        { error: "Initial balance is required" },
        { status: 400 },
      );
    }

    const amount = Number(body.initial_balance);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid initial balance" },
        { status: 400 },
      );
    }

    if (!body.expiration_date) {
      return NextResponse.json(
        { error: "Expiration date is required" },
        { status: 400 },
      );
    }

    const expiration = new Date(body.expiration_date as string | Date);
    if (Number.isNaN(expiration.getTime())) {
      return NextResponse.json(
        { error: "Invalid expiration date" },
        { status: 400 },
      );
    }

    const buyerId = await findOrCreateClientFromVoucher("buyer", body);

    let recipientId: string;
    const hasRecipientInfo =
      body.recipient_name ||
      body.recipient_surname ||
      body.recipient_email ||
      body.recipient_phone;

    if (hasRecipientInfo) {
      recipientId = await findOrCreateClientFromVoucher("recipient", body);
    } else {
      recipientId = buyerId;
    }

    const voucherNotes = normalizeString(body.notes) ?? undefined;
    const paymentRef =
      body.initial_payment_code != null &&
      String(body.initial_payment_code).trim() !== ""
        ? String(body.initial_payment_code).trim()
        : null;

    const now = new Date();
    const { start: dayStart, end: dayEnd } = utcDayBounds(now);
    const ddmmyy = formatDdMmYyUtc(now);
    const codePrefix = `V-${ddmmyy}-`;

    let voucher: Awaited<ReturnType<typeof prisma.vouchers.create>> | undefined;
    let lastErr: unknown;

    for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt++) {
      try {
        const result = await prisma.$transaction(async (tx) => {
          const sameDay = await tx.vouchers.findMany({
            where: {
              deleted_at: null,
              created_at: { gte: dayStart, lt: dayEnd },
              code: { startsWith: codePrefix },
            },
            select: { code: true },
          });

          const seq = nextSequenceForPrefix(sameDay, codePrefix);
          const code = `${codePrefix}${seq}`;

          const v = await tx.vouchers.create({
            data: {
              code,
              buyer_id: buyerId,
              recipient_id: recipientId,
              expiration_date: expiration,
              notes: voucherNotes,
            },
          });

          await tx.voucher_uses.create({
            data: {
              voucher_id: v.id,
              recipient_id: recipientId,
              amount,
              code: paymentRef,
            },
          });

          return v;
        });

        voucher = result;
        break;
      } catch (e: unknown) {
        lastErr = e;
        if (isPrismaUniqueViolation(e)) {
          continue;
        }
        throw e;
      }
    }

    if (voucher === undefined) {
      console.error("Voucher code generation exhausted retries", lastErr);
      return NextResponse.json(
        { error: "Could not allocate a unique voucher code" },
        { status: 503 },
      );
    }

    return NextResponse.json({ voucher }, { status: 201 });
  } catch (err: unknown) {
    console.error("Error creating voucher", err);

    const message =
      err instanceof Error && typeof err.message === "string"
        ? err.message
        : "Error creating voucher";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
