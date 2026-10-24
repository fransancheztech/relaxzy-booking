import { DateTime } from "luxon";
import { BUSINESS_TIMEZONE } from "@/constants";
import { phoneLookupValues, phoneSearchTerms } from "@/utils/phone";

// Server side of the DataGrid filters (Clients, Bookings, Vouchers, Payments tables).
//
// Every table used to translate its filter items by hand, and the text columns all ignored the
// operator: "equals", "starts with"… all ran "contains"; "is empty" / "is not empty" never reached
// the server; "is any of" (a list) was discarded. These helpers implement each DataGrid operator
// once, as plain Prisma where-objects, so every table behaves the same.
//
// Negative operators ("does not contain", "does not equal", "is not") also keep rows whose value
// is empty: SQL's NOT (NULL LIKE …) is unknown, which would quietly drop them, while the grid's
// own meaning is "doesn't contain it" — and an empty value doesn't.

export type FilterItem = { field?: string; operator?: string; value?: unknown };
// Plain objects in Prisma's where-syntax; each route returns them as its own model's WhereInput.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Where = Record<string, any>;

/** Operators whose result includes rows with an empty value (and, through a relation, rows with none). */
export const INCLUDES_EMPTY = new Set(["doesNotContain", "doesNotEqual", "isEmpty", "not"]);

/** The positive operator behind a negative one ("does not contain" → "contains"). */
export const POSITIVE_OF: Record<string, string> = { doesNotContain: "contains", doesNotEqual: "equals" };

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim()) : [];

const toNumber = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v.replace(",", ".")) : NaN;
  return Number.isFinite(n) ? n : null;
};

type TextOptions = {
  /** Applied to the typed value: foldText for the accent-insensitive *_folded columns. */
  normalize?: (s: string) => string;
  /** Case-insensitive comparison (not needed on folded columns, which are already lower-case). */
  insensitive?: boolean;
  /** A NOT NULL column: Prisma rejects `{ column: null }` on those, so empty means "" only. */
  required?: boolean;
};

/** A condition no row matches / every row matches (an empty `in` list is always false). */
const nothing = (column: string): Where => ({ [column]: { in: [] } });
const everything = (column: string): Where => ({ NOT: nothing(column) });

/** One text column, any DataGrid string operator. */
export function textFilter(column: string, op: string, value: unknown, opts: TextOptions = {}): Where | null {
  const norm = opts.normalize ?? ((s: string) => s);
  const mode = opts.insensitive ? { mode: "insensitive" } : {};
  const empty: Where = opts.required ? { [column]: "" } : { OR: [{ [column]: null }, { [column]: "" }] };

  if (op === "isEmpty") return empty;
  if (op === "isNotEmpty") return { NOT: empty };
  if (op === "isAnyOf") {
    const values = strings(value).map(norm).filter(Boolean);
    return values.length ? { OR: values.map((v) => ({ [column]: { equals: v, ...mode } })) } : null;
  }

  if (typeof value !== "string") return null;
  const v = norm(value.trim());
  if (!v) return null;
  const orEmpty = (cond: Where): Where => (opts.required ? { NOT: cond } : { OR: [{ [column]: null }, { NOT: cond }] });

  switch (op) {
    case "equals":         return { [column]: { equals: v, ...mode } };
    case "doesNotEqual":   return orEmpty({ [column]: { equals: v, ...mode } });
    case "startsWith":     return { [column]: { startsWith: v, ...mode } };
    case "endsWith":       return { [column]: { endsWith: v, ...mode } };
    case "doesNotContain": return orEmpty({ [column]: { contains: v, ...mode } });
    case "contains":
    default:               return { [column]: { contains: v, ...mode } };
  }
}

/**
 * Text shown from several columns (a therapist's nickname / name / surname, a service's short and
 * long name): positive operators match if ANY column matches, negative ones only if NONE does.
 */
export function textFilterAny(
  columns: string[],
  op: string,
  value: unknown,
  opts: Omit<TextOptions, "required"> & { requiredColumns?: string[] } = {},
): Where | null {
  const parts = columns
    .map((c) => textFilter(c, op, value, { ...opts, required: opts.requiredColumns?.includes(c) }))
    .filter((p): p is Where => !!p);
  if (parts.length === 0) return null;
  const all = INCLUDES_EMPTY.has(op);
  return all ? { AND: parts } : { OR: parts };
}

/**
 * A phone column (stored E.164). "contains" matches on digits so "689 59" finds +34689590123;
 * "equals" is the same number in any spelling. "starts/ends with" aren't offered for phones: with
 * the country code stored first, "starts with 689" would never match.
 */
export function phoneFilter(column: string, op: string, value: unknown): Where | null {
  const empty: Where = { OR: [{ [column]: null }, { [column]: "" }] };
  if (op === "isEmpty") return empty;
  if (op === "isNotEmpty") return { NOT: empty };
  if (op === "isAnyOf") {
    const values = strings(value).flatMap((v) => phoneLookupValues(v));
    return values.length ? { [column]: { in: values } } : null;
  }
  if (typeof value !== "string" || !value.trim()) return null;

  const containsAny: Where = {
    OR: phoneSearchTerms(value).map((term) => ({ [column]: { contains: term, mode: "insensitive" } })),
  };
  const sameNumber: Where = { [column]: { in: phoneLookupValues(value) } };
  switch (op) {
    case "equals":         return sameNumber;
    case "doesNotEqual":   return { OR: [{ [column]: null }, { NOT: sameNumber }] };
    case "doesNotContain": return { OR: [{ [column]: null }, { NOT: containsAny }] };
    case "contains":
    default:               return containsAny;
  }
}

/** A number column: = != > >= < <=, is empty / is not empty, is any of. */
export function numberFilter(column: string, op: string, value: unknown): Where | null {
  if (op === "isEmpty") return { [column]: null };
  if (op === "isNotEmpty") return { NOT: { [column]: null } };
  if (op === "isAnyOf") {
    const values = (Array.isArray(value) ? value : []).map(toNumber).filter((n): n is number => n !== null);
    return values.length ? { [column]: { in: values } } : null;
  }
  const n = toNumber(value);
  if (n === null) return null;
  switch (op) {
    case "!=": return { OR: [{ [column]: null }, { NOT: { [column]: n } }] };
    case ">":  return { [column]: { gt: n } };
    case ">=": return { [column]: { gte: n } };
    case "<":  return { [column]: { lt: n } };
    case "<=": return { [column]: { lte: n } };
    case "=":
    default:   return { [column]: n };
  }
}

/**
 * The business (Madrid) day a date filter value refers to. The grid's date input sends the chosen
 * calendar day as UTC midnight ("2026-10-24T00:00:00.000Z"), so the day is the first 10 characters.
 */
function filterDay(value: unknown): { start: Date; end: Date } | null {
  const raw = value instanceof Date ? value.toISOString() : typeof value === "string" ? value : "";
  const day = raw.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (!day) return null;
  const start = DateTime.fromISO(day, { zone: BUSINESS_TIMEZONE });
  if (!start.isValid) return null;
  return { start: start.toUTC().toJSDate(), end: start.plus({ days: 1 }).toUTC().toJSDate() };
}

/**
 * A timestamp column filtered by business day: "is 24/10" means any time on 24/10 in Madrid.
 * Used with date-only filter inputs (getGridDateOperators()), also on date-time columns.
 */
export function dateFilter(column: string, op: string, value: unknown, opts: { required?: boolean } = {}): Where | null {
  if (op === "isEmpty") return opts.required ? nothing(column) : { [column]: null };
  if (op === "isNotEmpty") return opts.required ? everything(column) : { NOT: { [column]: null } };
  const day = filterDay(value);
  if (!day) return null;
  const sameDay: Where = { [column]: { gte: day.start, lt: day.end } };
  switch (op) {
    case "not":        return opts.required ? { NOT: sameDay } : { OR: [{ [column]: null }, { NOT: sameDay }] };
    case "after":      return { [column]: { gte: day.end } };
    case "onOrAfter":  return { [column]: { gte: day.start } };
    case "before":     return { [column]: { lt: day.start } };
    case "onOrBefore": return { [column]: { lt: day.end } };
    case "is":
    default:           return sameDay;
  }
}

/** A column with a fixed set of values (status, source): is, is not, is any of. */
export function selectFilter(column: string, op: string, value: unknown, allowed: readonly string[]): Where | null {
  if (op === "isAnyOf") {
    const values = strings(value).filter((v) => allowed.includes(v));
    return values.length ? { [column]: { in: values } } : null;
  }
  if (typeof value !== "string" || !allowed.includes(value)) return null;
  return op === "not" ? { NOT: { [column]: value } } : { [column]: value };
}

/**
 * A filter on a related record (a booking's client, therapist or service). Operators that include
 * empty values also include rows with no related record at all — "customer is empty" finds the
 * anonymous bookings.
 */
export function viaRelation(relation: string, foreignKey: string, op: string, inner: Where | null): Where | null {
  if (!inner) return null;
  const through: Where = { [relation]: { is: inner } };
  return INCLUDES_EMPTY.has(op) ? { OR: [{ [foreignKey]: null }, through] } : through;
}
