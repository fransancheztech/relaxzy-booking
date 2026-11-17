import { z } from "zod";
import type {
  CardUsage,
  OnlineOrderDetails,
  OnlineOrderRef,
  VoucherCandidate,
  VoucherCardDecision,
  VoucherCardDetails,
  VoucherCardProposal,
} from "@/lib/review/types";
import { ONLINE_KIND } from "./voucherOnlineOrder";
import { asDate, daysBetween, loadSystemVouchers, nameSimilarity } from "./voucherShared";
import type { Candidate, ReviewCheck } from "./types";

const CARD_KIND = "voucher_card";
const USAGES: CardUsage[] = ["recorded", "unrecorded", "unused", "unknown"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A card and its voucher can be a few days apart: the card is dated the day it was sold, and the
// voucher was sometimes entered later (or, before Dec 2025, not at all).
const WINDOW_DAYS = 3;
// Same day plus a recognisable name (the buyer's at least); anything weaker is shown but not preselected.
const SUGGEST_SCORE = 1.6;

const nullableString = z.string().nullable().optional().transform((v) => v ?? null);
const CardSchema = z.object({
  card: z.string().min(1),
  code: nullableString,
  de: nullableString,
  para: nullableString,
  tratamiento_raw: nullableString,
  service: nullableString,
  duracion_raw: nullableString,
  duration_min: z.number().nullable().optional().transform((v) => v ?? null),
  fecha_raw: nullableString,
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  expiracion_raw: nullableString,
  expiracion: nullableString,
  redeemed_line: z.boolean(),
  stamp: z.boolean(),
  notes: nullableString,
  confidence: z.string(),
});

/**
 * People (or sessions) on the card: "60x2", "2 ps", "parejas", "60 min + 60 min", or two names
 * joined by y / e / & / commas. "60 + 30 minutos" is one person with two treatments.
 */
function peopleOf(duracion: string | null, para: string | null): number {
  const d = (duracion ?? "").toLowerCase();
  const fromDuration = /x\s*3|3\s*p/.test(d) ? 3 : /x\s*2|2\s*p|pareja|(\d+)\s*min\w*\s*\+\s*\1/.test(d) ? 2 : 1;
  const names = (para ?? "").replace(/\(.*?\)/g, "").split(/\s+y\s+|\s*&\s*|\s*,\s*|\s+and\s+|\s+e\s+/i).filter((s) => s.trim());
  return Math.min(4, Math.max(fromDuration, names.length));
}

const codesOf = (code: string | null) => (code ?? "").split(/[,\s]+/).map((c) => c.trim().toUpperCase()).filter((c) => /^V-\d{6}-\d+$/.test(c));

const digitsOf = (s: string | null | undefined) => (s ?? "").match(/\d+/g)?.join(",") ?? "";

/**
 * How well a card fits a voucher sold `days` apart: the date, the recipient (Para, or De when the
 * card has no Para: bought for oneself) and the buyer. Weak name likenesses (under 0.6) count as
 * nothing. Numbers in the names must agree ("You Work #4" is not "You Work 1").
 */
function scoreCard(card: VoucherCardDetails, v: { recipient: string; buyer: string }, days: number) {
  const why: string[] = [days === 0 ? "same_day" : `days_${days}`];
  const floor = (x: number) => (x >= 0.6 ? x : 0);
  const toRecipient = card.para ? floor(nameSimilarity(card.para, v.recipient)) : 0.8 * floor(nameSimilarity(card.de, v.recipient));
  const fromBuyer = floor(nameSimilarity(card.de, v.buyer));
  if (toRecipient) why.push("para_recipient");
  if (fromBuyer) why.push("de_buyer");
  let score = (days === 0 ? 1 : days === 1 ? 0.7 : 0.4) + toRecipient + 0.6 * fromBuyer;
  const [a, b] = [digitsOf(card.para), digitsOf(v.recipient)];
  if (a && b && a !== b) {
    score -= 1;
    why.push("number_differs");
  }
  return { score: Math.round(score * 100) / 100, why };
}

/** Distinct words of `a` that also appear (or nearly: Susi / Suzie) in `b`. */
function sharedWords(a: string, b: string): number {
  const wa = [...new Set(a.split(/[\s,&/]+/).filter((w) => w.length >= 3))];
  const wb = b.split(/[\s,&/]+/).filter((w) => w.length >= 3);
  return wa.filter((x) => wb.some((y) => nameSimilarity(x, y) >= 0.9)).length;
}

/**
 * Physical gift cards (tarjetas.json, uploaded on the page) against the vouchers in the system.
 * For each card it proposes the system vouchers it most likely is (by a code written on the card,
 * else by date and names), or the online order it is a printed copy of, and compares the card's
 * redeemed mark with the uses recorded. The reviewer confirms or corrects; nothing in the data
 * changes here. Vouchers to add and uses to record go into a SQL file later.
 */
export const voucherCard: ReviewCheck = {
  source: "tarjetas.json",

  importItems(raw) {
    const parsed = z.array(CardSchema).safeParse(raw);
    if (!parsed.success) return { error: "This doesn't look like tarjetas.json." };
    const candidates: Candidate[] = parsed.data.map((c) => {
      const details: VoucherCardDetails = {
        ...c,
        people: peopleOf(`${c.duracion_raw ?? ""} ${c.tratamiento_raw ?? ""}`, c.para),
        shop_gift: /relaxzy\s+thai\s+massage/i.test(c.de ?? "") || /^chalida\b/i.test(c.de ?? ""),
      };
      return { item_key: c.card, business_date: asDate(c.fecha), details, proposal: null };
    });
    return { candidates };
  },

  async find(db) {
    const [items, orderItems, vouchers] = await Promise.all([
      db.review_items.findMany({ where: { kind: CARD_KIND } }),
      db.review_items.findMany({ where: { kind: ONLINE_KIND } }),
      loadSystemVouchers(db),
    ]);
    const orders = orderItems.map((o) => o.details as unknown as OnlineOrderDetails);

    // Vouchers already confirmed for another card are not offered again.
    const taken = new Map<string, string>();
    for (const it of items) {
      const d = it.status === "decided" ? (it.decision as unknown as VoucherCardDecision | null) : null;
      if (d?.link === "system") d.voucher_ids.forEach((id) => taken.set(id, it.item_key));
    }

    // 1. Score every card against the physical vouchers sold within a few days. Online vouchers
    //    are left to the online-order link: a card that is an online order printed is offered that.
    const perCard = items.map((item) => {
      const card = item.details as unknown as VoucherCardDetails;
      const free = vouchers.filter((v) => !taken.has(v.id) || taken.get(v.id) === item.item_key);
      const codes = codesOf(card.code);
      const byCode = free.filter((v) => codes.includes(v.code.toUpperCase()));
      const scored: VoucherCandidate[] = [];
      if (card.fecha) {
        for (const v of free) {
          if (v.source !== "physical" || byCode.some((b) => b.id === v.id)) continue;
          const days = daysBetween(v.sold, card.fecha);
          if (days > WINDOW_DAYS) continue;
          scored.push({ ...v, ...scoreCard(card, v, days) });
        }
      }
      scored.sort((a, b) => b.score - a.score);
      const candidates = [...byCode.map((v): VoucherCandidate => ({ ...v, score: 9, why: ["code"] })), ...scored].slice(0, 6);
      return { item, card, byCode, candidates };
    });

    // 2. Suggest the best pairs across all cards at once, so one voucher is never suggested for two
    //    cards (four "You Work" cards, four "You Work" vouchers). A code on the card always wins.
    const pairs = perCard.flatMap(({ item, card, byCode, candidates }) => [
      ...byCode.map((v) => ({ key: item.item_key, id: v.id, score: 9, people: Math.max(card.people, byCode.length) })),
      ...candidates.filter((c) => c.score < 9 && c.score >= SUGGEST_SCORE && !c.deleted)
        .map((c) => ({ key: item.item_key, id: c.id, score: c.score, people: card.people })),
    ]).sort((a, b) => b.score - a.score);
    const suggestedFor = new Map<string, string[]>();
    const usedIds = new Set<string>();
    for (const p of pairs) {
      const list = suggestedFor.get(p.key) ?? [];
      if (usedIds.has(p.id) || list.length >= p.people) continue;
      list.push(p.id);
      usedIds.add(p.id);
      suggestedFor.set(p.key, list);
    }

    return perCard.map(({ item, card, byCode, candidates }): Candidate => {
      const suggested = suggestedFor.get(item.item_key) ?? [];

      // 3. The online order this card may be a printed copy of: same day and the buyer's first
      //    name, or at least two names in common within a few days.
      const online: OnlineOrderRef[] = [];
      if (card.fecha) {
        for (const o of orders) {
          const days = daysBetween(o.date.slice(0, 10), card.fecha);
          if (days > WINDOW_DAYS) continue;
          const names = [o.buyer, ...o.forms.flatMap((f) => [f.para, f.de])];
          const sameBuyer = days === 0 && nameSimilarity(card.de, o.buyer.split(/\s+/)[0]) >= 0.9;
          if (sameBuyer || sharedWords(`${card.de ?? ""} ${card.para ?? ""}`, names.join(" ")) >= 2) {
            online.push({ invoice: o.invoice, date: o.date, buyer: o.buyer, vouchers: o.vouchers, total: o.total, names, strong: sameBuyer });
          }
        }
      }

      // 4. The card's redeemed mark against the uses recorded on the suggested vouchers.
      const chosen = vouchers.filter((v) => suggested.includes(v.id));
      const usage: CardUsage = chosen.some((v) => v.uses.length) ? "recorded" : card.redeemed_line ? "unrecorded" : "unknown";

      const proposal: VoucherCardProposal = { by_code: byCode.length > 0, suggested, candidates, online_orders: online, usage };
      return { item_key: item.item_key, business_date: item.business_date, details: card, proposal };
    });
  },

  async apply(tx, _item, input) {
    const v = (input.values ?? {}) as Partial<VoucherCardDecision>;
    if (!["system", "online_order", "missing"].includes(v.link as string)) return { error: "INVALID_INPUT", status: 400 };
    if (!USAGES.includes(v.used as CardUsage)) return { error: "INVALID_INPUT", status: 400 };
    const ids = Array.isArray(v.voucher_ids) ? v.voucher_ids.filter((id): id is string => typeof id === "string" && UUID.test(id)) : [];
    if (v.link === "system") {
      if (!ids.length) return { error: "INVALID_INPUT", status: 400 };
      const found = await tx.vouchers.count({ where: { id: { in: ids } } });
      if (found !== ids.length) return { error: "VOUCHER_NOT_FOUND", status: 404 };
    }
    const invoice = v.link === "online_order" && Number.isInteger(v.invoice) ? (v.invoice as number) : null;
    if (v.link === "online_order" && invoice == null) return { error: "INVALID_INPUT", status: 400 };
    const decision: VoucherCardDecision = {
      action: "apply",
      link: v.link as VoucherCardDecision["link"],
      voucher_ids: v.link === "system" ? ids : [],
      invoice,
      used: v.used as CardUsage,
      shop_gift: v.shop_gift === true,
    };
    return { decision };
  },

  async revert() {
    return null; // nothing in the data was changed
  },

  needsFollowUp(decision) {
    const d = decision as unknown as VoucherCardDecision;
    return d.link === "missing" || d.used === "unrecorded";
  },
};
