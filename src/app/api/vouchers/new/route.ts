import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/getCurrentUserId";
import { VoucherContactSchema } from "@/schemas/clientContact.schema";
import { formatZodError } from "@/utils/zodApiError";
import {
  applyClientSlot,
  ClientConflictError,
  PlaceholderNameError,
  detectClientConflict,
  type ClientInput,
} from "@/lib/clients/resolveBookingClients";
import { CLIENT_CONTACT_TAKEN, CLIENT_NAME_CONFLICT } from "@/types/clientConflict";
import type { ClientConflict, ClientResolution } from "@/types/clientConflict";
import { businessDdMmYy } from "@/utils/businessTime";

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

// Which field(s) a P2002 was raised on. Prisma's payload shape varies by driver: under the pg
// driver adapter `meta.target` is frequently absent, so matching on it alone silently failed —
// in the 2026-09-11 incident all 13 code collisions rethrew instead of retrying. The message
// always names the field, so both sources are searched.
function uniqueViolationFields(err: unknown): string {
  if (!isPrismaUniqueViolation(err)) return "";
  const target = (err as { meta?: { target?: unknown } }).meta?.target;
  const fromTarget = Array.isArray(target) ? target.join(",") : String(target ?? "");
  const fromMessage = String((err as { message?: unknown }).message ?? "");
  return `${fromTarget} ${fromMessage}`;
}

// A genuine clients phone/email clash — the only case that may tell the receptionist her
// client's contact details are taken. Previously ANY P2002 claimed this, so a voucher-code
// collision sent her hunting for a duplicate client that did not exist.
function isClientContactCollision(err: unknown): boolean {
  return /client_email|client_phone|clients_email|clients_phone/.test(uniqueViolationFields(err));
}

// Within this route the only other unique constraint is vouchers.code, so any P2002 that is not
// a contact clash is a code collision — retryable with a freshly computed sequence number.
// Classifying by exhaustion keeps this correct whatever shape the driver reports.
function isVoucherCodeCollision(err: unknown): boolean {
  return isPrismaUniqueViolation(err) && !isClientContactCollision(err);
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

    // created_at is the real purchase datetime — date AND time — as entered by the receptionist,
    // and is taken verbatim. It is pure business data: it dates the sale for all revenue
    // reporting (Stats and Daily Totals both scope voucher sales by v.created_at). Tracing when
    // a voucher was actually keyed in, and by whom, lives in vouchers_history.changed_at /
    // changed_by, so nothing here needs to encode data-entry time.
    const createdAt = body.created_at ? new Date(body.created_at as string | Date) : new Date();
    if (Number.isNaN(createdAt.getTime())) {
      return NextResponse.json({ error: "Invalid created_at date" }, { status: 400 });
    }
    // The voucher code encodes the sale day on the business calendar (Madrid).
    const ddmmyy = businessDdMmYy(createdAt);
    const codePrefix = `V-${ddmmyy}-`;

    let voucher: Awaited<ReturnType<typeof prisma.vouchers.create>> | undefined;
    let lastErr: unknown;

    for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt++) {
      try {
        const result = await prisma.$transaction(async (tx) => {
          // Attribute every vouchers_history row the triggers write in this transaction.
          // auth.uid() is NULL under Prisma's pooled connection, so the user must be passed
          // explicitly via this transaction-local GUC.
          await tx.$queryRaw`SELECT set_config('app.user_id', ${performedBy ?? ""}, true)`;

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
            // Keyed on the code prefix alone: `code` carries a GLOBAL unique constraint, so the
            // only thing that can collide is another row with this prefix — whatever its
            // created_at now says (it is editable) and whether or not it is soft-deleted.
            where: {
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
    if (err instanceof PlaceholderNameError) {
      return NextResponse.json({ error: err.message }, { status: err.httpStatus });
    }
    if (isClientContactCollision(err)) {
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
