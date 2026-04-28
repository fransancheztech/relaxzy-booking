import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type VoucherRow = {
  id: string;
  code: string;
  balance: string | null;
  expiration_date: Date;
  recipient_name: string | null;
  recipient_surname: string | null;
  buyer_name: string | null;
  buyer_surname: string | null;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const pattern = q ? `%${q}%` : "%";

    const rows = await prisma.$queryRaw<VoucherRow[]>`
      SELECT
        v.id,
        v.code,
        v.balance::text,
        v.expiration_date,
        cr.client_name     AS recipient_name,
        cr.client_surname  AS recipient_surname,
        cb.client_name     AS buyer_name,
        cb.client_surname  AS buyer_surname
      FROM vouchers v
      LEFT JOIN clients cr ON cr.id = v.recipient_id AND cr.deleted_at IS NULL
      LEFT JOIN clients cb ON cb.id = v.buyer_id     AND cb.deleted_at IS NULL
      WHERE v.deleted_at IS NULL
        AND COALESCE(v.balance, 0) > 0
        AND v.expiration_date > NOW()
        AND (
          v.code               ILIKE ${pattern}
          OR v.notes           ILIKE ${pattern}
          OR cr.client_name    ILIKE ${pattern}
          OR cr.client_surname ILIKE ${pattern}
          OR cr.client_phone   ILIKE ${pattern}
          OR cr.client_email   ILIKE ${pattern}
          OR cr.client_notes   ILIKE ${pattern}
          OR cb.client_name    ILIKE ${pattern}
          OR cb.client_surname ILIKE ${pattern}
          OR cb.client_phone   ILIKE ${pattern}
          OR cb.client_email   ILIKE ${pattern}
          OR cb.client_notes   ILIKE ${pattern}
          OR EXISTS (
            SELECT 1 FROM voucher_uses vu
            WHERE vu.voucher_id = v.id
              AND vu.deleted_at IS NULL
              AND vu.notes ILIKE ${pattern}
          )
        )
      ORDER BY v.created_at DESC
      LIMIT 10
    `;

    return NextResponse.json({ vouchers: rows });
  } catch (err) {
    console.error("Voucher search error", err);
    return NextResponse.json({ error: "Error searching vouchers" }, { status: 500 });
  }
}
