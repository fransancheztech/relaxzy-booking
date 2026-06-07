import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/getCurrentUserId";
import { VoucherContactSchema } from "@/schemas/clientContact.schema";
import { formatZodError } from "@/utils/zodApiError";
import {
  applyClientSlot,
  ClientConflictError,
  detectClientConflict,
  type ClientInput,
} from "@/lib/clients/resolveBookingClients";
import { CLIENT_CONTACT_TAKEN, CLIENT_NAME_CONFLICT } from "@/types/clientConflict";
import type { ClientConflict, ClientResolution } from "@/types/clientConflict";

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
  notes?: string;
  expiration_date?: string | Date;
  created_at?: string | Date;
  source?: "physical" | "online";
  external_reference?: string;
  // Per-slot decisions for name conflicts: "buyer", "recipient".
  clientResolutions?: Record<string, ClientResolution>;
};

const clientInputFor = (body: Body, prefix: "buyer" | "recipient"): ClientInput => ({
  client_name: (body as Record<string, string | undefined>)[`${prefix}_name`],
  client_surname: (body as Record<string, string | undefined>)[`${prefix}_surname`],
  client_email: (body as Record<string, string | undefined>)[`${prefix}_email`],
  client_phone: (body as Record<string, string | undefined>)[`${prefix}_phone`],
});

const normalizeString = (v?: string | null) =>
  v && v.trim() !== "" ? v.trim() : null;

/** When the voucher comes from the online channel, prefix the stored reference with `#`
 * so the channel marker is embedded in the value itself (not only shown as an input adornment). */
const normalizeExternalRef = (
  value: string | null | undefined,
  source: "physical" | "online",
) => {
  if (!value) return undefined;
  if (source === "online" && !value.startsWith("#")) return `#${value}`;
  return value;
};

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

const MAX_CODE_RETRIES = 8;

function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

// Only the voucher *code* unique collision should be retried. A client phone/email
// collision must surface to the user, not loop.
function isVoucherCodeCollision(err: unknown): boolean {
  if (!isPrismaUniqueViolation(err)) return false;
  const target = (err as { meta?: { target?: unknown } }).meta?.target;
  const s = Array.isArray(target) ? target.join(",") : String(target ?? "");
  return s.includes("code");
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

    if (!["physical", "online"].includes(body.source ?? "")) {
      return NextResponse.json(
        { error: "Invalid voucher source" },
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

    const hasRecipientInfo = !!(
      body.recipient_name ||
      body.recipient_surname ||
      body.recipient_email ||
      body.recipient_phone
    );
    const resolutions = body.clientResolutions ?? {};
    const buyerInput = clientInputFor(body, "buyer");
    const recipientInput = clientInputFor(body, "recipient");

    const voucherNotes = normalizeString(body.notes) ?? undefined;
    const source = body.source as "physical" | "online";
    const externalReference = normalizeExternalRef(normalizeString(body.external_reference), source);

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
          // Phase 1 — detect name conflicts before any write (buyer + recipient).
          const conflicts: ClientConflict[] = [];
          const buyerConflict = await detectClientConflict(tx, "buyer", buyerInput, resolutions["buyer"]);
          if (buyerConflict) conflicts.push(buyerConflict);
          if (hasRecipientInfo) {
            const recipientConflict = await detectClientConflict(tx, "recipient", recipientInput, resolutions["recipient"]);
            if (recipientConflict) conflicts.push(recipientConflict);
          }
          if (conflicts.length > 0) throw new ClientConflictError(conflicts);

          // Phase 2 — resolve clients (contact optional for vouchers).
          const buyerId = await applyClientSlot(tx, buyerInput, resolutions["buyer"], { requireContact: false });
          if (!buyerId) throw new Error("Buyer name is required");
          const recipientId = hasRecipientInfo
            ? await applyClientSlot(tx, recipientInput, resolutions["recipient"], { requireContact: false })
            : buyerId;

          const sameDay = await tx.vouchers.findMany({
            where: {
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
              source,
              external_reference: externalReference,
              created_at: createdAt,
            },
          });

          await tx.$queryRaw`
            SELECT register_payment_event(
              'CHARGE'::payment_types,
              ${amount}::numeric,
              ${body.payment_method}::payment_methods,
              ${performedBy}::uuid,
              NULL::text,
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
        if (isVoucherCodeCollision(e)) {
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
    if (err instanceof ClientConflictError) {
      return NextResponse.json(
        { error: CLIENT_NAME_CONFLICT, conflicts: err.conflicts },
        { status: 409 },
      );
    }
    if (isPrismaUniqueViolation(err)) {
      return NextResponse.json({ error: CLIENT_CONTACT_TAKEN }, { status: 409 });
    }
    console.error("Error creating voucher", err);

    const message =
      err instanceof Error && typeof err.message === "string"
        ? err.message
        : "Error creating voucher";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
