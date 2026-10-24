import { getGridDateOperators, getGridStringOperators, type GridFilterItem } from "@mui/x-data-grid";

/** Operators that need no value: the filter applies as soon as it's chosen. */
export const NO_VALUE_OPERATORS = new Set(["isEmpty", "isNotEmpty"]);

/**
 * Whether a DataGrid filter item is complete enough to send to the server: "is empty" / "is not
 * empty" need no value, "is any of" needs at least one, everything else needs a value. The tables
 * used to drop every item without a value, which silently disabled "is empty" and "is not empty".
 */
export function isActiveFilterItem(item: GridFilterItem): boolean {
  if (!item.field || !item.operator) return false;
  if (NO_VALUE_OPERATORS.has(item.operator)) return true;
  if (Array.isArray(item.value)) return item.value.some((v) => v !== "" && v !== null && v !== undefined);
  return item.value !== undefined && item.value !== null && item.value !== "";
}

export const activeFilterItems = (items: GridFilterItem[]) => items.filter(isActiveFilterItem);

/**
 * Phone columns: every text operator except "starts with" / "ends with". Numbers are stored with
 * their country code first (+34…), so "starts with 689" would never match; "contains" works on
 * digits instead.
 */
export const PHONE_FILTER_OPERATORS = getGridStringOperators().filter(
  (op) => op.value !== "startsWith" && op.value !== "endsWith",
);

/**
 * Date-time columns filtered by DAY ("created on 24/10"), with a date-only picker. The server
 * reads it as that business (Madrid) day; a time picker would suggest minute precision it never
 * applied.
 */
export const DAY_FILTER_OPERATORS = getGridDateOperators(false);
