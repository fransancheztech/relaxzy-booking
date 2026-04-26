import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth/getCurrentUserId";
import { recalculateVoucherBalance } from "@/lib/recalculateVoucherBalance";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.booking_id && !body.voucher_id) {
      return NextResponse.json(
        { error: "Either booking_id or voucher_id is required" },
        { status: 400 },
      );
    }

    if (body.booking_id && body.voucher_id) {
      return NextResponse.json(
        { error: "Provide only one of booking_id or voucher_id" },
        { status: 400 },
      );
    }

    if (!body.amount || body.amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    if (!["cash", "credit_card"].includes(body.method)) {
      return NextResponse.json(
        { error: "Invalid payment method" },
        { status: 400 },
      );
    }

    if (!["CHARGE", "REFUND"].includes(body.payment_type)) {
      return NextResponse.json(
        { error: "Invalid payment type" },
        { status: 400 },
      );
    }

    const performed_by = await getCurrentUserId();

    const payment_id = await prisma.$transaction(async (tx) => {
      const result = await tx.$queryRaw<{ register_payment_event: string }[]>`
        SELECT register_payment_event(
          ${body.payment_type}::payment_types,
          ${body.amount}::numeric,
          ${body.method}::payment_methods,
          ${performed_by}::uuid,
          ${body.notes ?? null}::text,
          ${body.booking_id ?? null}::uuid,
          ${body.voucher_id ?? null}::uuid
        )
      `;

      if (body.voucher_id) {
        await recalculateVoucherBalance(tx, body.voucher_id);
      }

      return result[0].register_payment_event;
    });

    return NextResponse.json({ payment_id });
  } catch (err) {
    console.error("Create payment error:", err);
    const isBalanceCheck =
      typeof err === "object" &&
      err !== null &&
      "message" in err &&
      typeof (err as { message: unknown }).message === "string" &&
      (err as { message: string }).message.includes("vouchers_balance_check");
    return NextResponse.json(
      {
        error: isBalanceCheck
          ? "Refund amount exceeds the current voucher balance"
          : "Error creating payment",
      },
      { status: 500 },
    );
  }
}
