export const normalizeMoney = (raw: string | number) => {
  if (raw === "" || raw === null) return "";

  const normalized = String(raw).replace(",", ".");
  const num = Number(normalized);

  if (Number.isNaN(num)) return "";

  return num
};

export function normalizeMoneyInput(value: string) {
  if (value === "") return "";

  // Allow only digits, dot, comma
  let v = value.replace(/[^\d.,]/g, "");

  // Replace comma with dot (but keep typing flow)
  v = v.replace(",", ".");

  // Allow only one dot
  const parts = v.split(".");
  if (parts.length > 2) {
    v = parts[0] + "." + parts.slice(1).join("");
  }

  // Limit to 2 decimals (while typing)
  if (parts[1]?.length > 2) {
    v = parts[0] + "." + parts[1].slice(0, 2);
  }

  return v;
}
