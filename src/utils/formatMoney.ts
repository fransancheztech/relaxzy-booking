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
