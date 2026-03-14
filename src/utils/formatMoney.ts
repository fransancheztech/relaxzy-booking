import Decimal from "decimal.js";

export function formatMoney(
  value: number | Decimal | null | undefined
): string {
  if (value == null) return "";

  const decimalValue = value instanceof Decimal ? value : new Decimal(value);

  const fractionDigits = decimalValue.mod(1).equals(0) ? 0 : 2;

  return (
    decimalValue.toNumber().toLocaleString("es-ES", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: 2,
    }) + " €"
  );
}

export const formatMoneyInput = (value: string | number) => {
  if (value === "" || value === null) return "";

  const num = Number(value);
  if (Number.isNaN(num)) return "";

  // If integer, no decimals; if fractional, 2 decimals
  return Number.isInteger(num) ? String(num) : num.toFixed(2);
};