import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type VoucherRow = {
  id: string;
  code: string;
  balance: string | null;
  expiration_date: Date;
  notes: string | null;
  source: string;
  external_reference: string | null;
  recipient_name: string | null;
  recipient_surname: string | null;
  recipient_phone: string | null;
  recipient_email: string | null;
  buyer_name: string | null;
  buyer_surname: string | null;
  buyer_phone: string | null;
  buyer_email: string | null;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const pattern = q ? `%${q}%` : "%";
    // Relevance tiers for the ORDER BY: exact code, then code-prefix, then code-contains.
    const exact = q; // ILIKE with no wildcards = case-insensitive exact match
    const prefix = q ? `${q}%` : "%";

    const rows = await prisma.$queryRaw<VoucherRow[]>`
      SELECT
        v.id,
        v.code,
        v.balance::text,
        v.expiration_date,
        v.notes,
        v.source,
        v.external_reference,
        cr.client_name     AS recipient_name,
        cr.client_surname  AS recipient_surname,
        cr.client_phone    AS recipient_phone,
        cr.client_email    AS recipient_email,
        cb.client_name     AS buyer_name,
        cb.client_surname  AS buyer_surname,
        cb.client_phone    AS buyer_phone,
        cb.client_email    AS buyer_email
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
      ORDER BY
        CASE
          WHEN v.code ILIKE ${exact}  THEN 0
          WHEN v.code ILIKE ${prefix} THEN 1
          WHEN v.code ILIKE ${pattern} THEN 2
          ELSE 3
        END,
        v.created_at DESC
    `;

    return NextResponse.json({ vouchers: rows });
  } catch (err) {
    console.error("Voucher search error", err);
    return NextResponse.json({ error: "Error searching vouchers" }, { status: 500 });
  }
}
