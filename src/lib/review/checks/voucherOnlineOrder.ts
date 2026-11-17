import { z } from "zod";
import type {
  OnlineOrderDecision,
  OnlineOrderDetails,
  OnlineOrderOutcome,
  OnlineOrderProposal,
  OnlineOrderStatus,
} from "@/lib/review/types";
import { asDate, loadSystemVouchers, referenceNumber } from "./voucherShared";
import type { Candidate, ReviewCheck } from "./types";

export const ONLINE_KIND = "voucher_online_order";
const OUTCOMES: OnlineOrderOutcome[] = ["ok", "missing", "fix", "test"];

const OrderSchema = z.object({
  invoice: z.number().int().positive(),
  order_id: z.number().int(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  buyer: z.string(),
  email: z.string().nullable(),
  total: z.number(),
  payment_type: z.string(),
  paid: z.boolean(),
  status: z.string(),
  test: z.boolean(),
  items: z.array(z.object({ name: z.string(), qty: z.number().int(), line_total: z.number() })),
  forms: z.array(z.object({ date: z.string(), para: z.string(), de: z.string(), message: z.string() })),
  vouchers: z.number().int(),
});

export const onlineOrderKey = (invoice: number) => `#${invoice}`;

/**
 * Online gift-voucher orders (pedidos_online.json, uploaded on the page) against the vouchers in
 * the system whose external reference is the order number. An order whose vouchers are all there,
 * with the money paid, is decided as "ok" by itself. The others wait for the reviewer: vouchers
 * missing (most orders before Dec 2025), deleted, a different count or a different amount.
 * Decisions are only recorded; vouchers to add or fix go into a SQL file later.
 */
export const voucherOnlineOrder: ReviewCheck = {
  source: "pedidos_online.json",

  importItems(raw) {
    const parsed = z.array(OrderSchema).safeParse(raw);
    if (!parsed.success) return { error: "This doesn't look like pedidos_online.json." };
    const candidates: Candidate[] = parsed.data
      .filter((o) => !o.test)
      .map((o) => {
        const { test: _test, ...details } = o;
        void _test;
        return { item_key: onlineOrderKey(o.invoice), business_date: asDate(o.date), details: details as OnlineOrderDetails, proposal: null };
      });
    return { candidates };
  },

  async find(db) {
    const [items, vouchers] = await Promise.all([
      db.review_items.findMany({ where: { kind: ONLINE_KIND } }),
      loadSystemVouchers(db),
    ]);
    return items.map((item): Candidate => {
      const order = item.details as unknown as OnlineOrderDetails;
      const system = vouchers.filter((v) => referenceNumber(v.external_reference) === order.invoice);
      const live = system.filter((v) => !v.deleted);
      const paidTotal = live.reduce((s, v) => s + v.paid, 0);
      const status: OnlineOrderStatus =
        !system.length ? "missing"
          : !live.length ? "only_deleted"
            : live.length !== order.vouchers ? "count_differs"
              : Math.abs(paidTotal - order.total) > 0.01 ? "amount_differs"
                : "ok";
      const proposal: OnlineOrderProposal = { status, system, live_count: live.length, paid_total: paidTotal };
      return { item_key: item.item_key, business_date: item.business_date, details: order, proposal };
    });
  },

  autoDecide(candidate) {
    const proposal = candidate.proposal as unknown as OnlineOrderProposal | null;
    if (proposal?.status !== "ok") return null;
    const decision: OnlineOrderDecision = { action: "apply", outcome: "ok", auto: true };
    return decision;
  },

  async apply(_tx, _item, input) {
    const outcome = (input.values as { outcome?: unknown } | undefined)?.outcome;
    if (!OUTCOMES.includes(outcome as OnlineOrderOutcome)) return { error: "INVALID_INPUT", status: 400 };
    if (outcome === "fix" && !input.note) return { error: "NOTE_REQUIRED", status: 400 };
    const decision: OnlineOrderDecision = { action: "apply", outcome: outcome as OnlineOrderOutcome };
    return { decision };
  },

  async revert() {
    return null; // nothing in the data was changed
  },

  needsFollowUp(decision) {
    const outcome = (decision as { outcome?: string }).outcome;
    return outcome === "missing" || outcome === "fix";
  },
};
