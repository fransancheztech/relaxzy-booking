import { Prisma } from "generated/prisma";
import { BUSINESS_TIMEZONE } from "@/constants";

// SQL counterpart of isVoucherExpired() in ./expiry: because the expiry day counts in
// full, these compare CALENDAR DAYS in business time rather than instants. Pass the
// qualified column, e.g. voucherNotExpiredSql(Prisma.sql`v.expiration_date`).
//
// vouchers.expiration_date is NOT NULL, so neither fragment handles nulls.

export const voucherNotExpiredSql = (col: Prisma.Sql) =>
  Prisma.sql`(${col} AT TIME ZONE ${BUSINESS_TIMEZONE})::date >= (now() AT TIME ZONE ${BUSINESS_TIMEZONE})::date`;

export const voucherExpiredSql = (col: Prisma.Sql) =>
  Prisma.sql`(${col} AT TIME ZONE ${BUSINESS_TIMEZONE})::date < (now() AT TIME ZONE ${BUSINESS_TIMEZONE})::date`;
