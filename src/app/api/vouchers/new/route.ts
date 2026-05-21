import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "generated/prisma";
import { getCurrentUserId } from "@/lib/auth/getCurrentUserId";
import { VoucherContactSchema } from "@/schemas/clientContact.schema";
import { formatZodError } from "@/utils/zodApiError";

type Body = {
  buyer_name?: string;
  buyer_surname?: string;
  buyer_phone?: string;
  buyer_email?: string;
  recipient_name?: string;
  recipient_surname?: string;
  recipient_phone?: string;
  recipient_email?: string;
  initial_balance?: number | string;
  payment_method?: string;
  initial_payment_code?: string | null;
  notes?: string;
  expiration_date?: string | Date;
  created_at?: string | Date;
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
  tx: Prisma.TransactionClient,
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

  if (!name) {
    throw new Error(`${prefix} must have a name`);
  }

  let clientId: string | null = null;

  if (email) {
    const clientByEmail = await tx.clients.findFirst({
      where: { client_email: email, deleted_at: null },
    });
    clientId = clientByEmail?.id ?? null;
  }

  if (!clientId && phone) {
    const clientByPhone = await tx.clients.findFirst({
      where: { client_phone: phone, deleted_at: null },
    });
    clientId = clientByPhone?.id ?? null;
  }

  if (!clientId) {
    const created = await tx.clients.create({
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

    const contactCheck = VoucherContactSchema.safeParse(body);
    if (!contactCheck.success) {
      return NextResponse.json(
        { error: formatZodError(contactCheck.error) },
        { status: 400 }
      );
    }

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

    if (!["cash", "credit_card"].includes(body.payment_method ?? "")) {
      return NextResponse.json(
        { error: "Invalid payment method" },
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

    const performedBy = await getCurrentUserId();

    const hasRecipientInfo =
      body.recipient_name ||
      body.recipient_surname ||
      body.recipient_email ||
      body.recipient_phone;

    const voucherNotes = normalizeString(body.notes) ?? undefined;
    const paymentRef =
      body.initial_payment_code != null &&
      String(body.initial_payment_code).trim() !== ""
        ? String(body.initial_payment_code).trim()
        : null;

    const createdAt = body.created_at ? new Date(body.created_at as string | Date) : new Date();
    if (Number.isNaN(createdAt.getTime())) {
      return NextResponse.json({ error: "Invalid created_at date" }, { status: 400 });
    }
    const { start: dayStart, end: dayEnd } = utcDayBounds(createdAt);
    const ddmmyy = formatDdMmYyUtc(createdAt);
    const codePrefix = `V-${ddmmyy}-`;

    let voucher: Awaited<ReturnType<typeof prisma.vouchers.create>> | undefined;
    let lastErr: unknown;

    for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt++) {
      try {
        const result = await prisma.$transaction(async (tx) => {
          const buyerId = await findOrCreateClientFromVoucher(tx, "buyer", body);

          const recipientId = hasRecipientInfo
            ? await findOrCreateClientFromVoucher(tx, "recipient", body)
            : buyerId;

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
              created_at: createdAt,
            },
          });

          await tx.$queryRaw`
            SELECT register_payment_event(
              'CHARGE'::payment_types,
              ${amount}::numeric,
              ${body.payment_method}::payment_methods,
              ${performedBy}::uuid,
              ${paymentRef ? `Internal reference: ${paymentRef}` : null}::text,
              NULL::uuid,
              ${v.id}::uuid
            )
          `;

          await tx.vouchers.update({
            where: { id: v.id },
            data: { balance: amount },
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
