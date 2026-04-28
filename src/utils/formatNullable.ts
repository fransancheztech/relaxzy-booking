export const formatNullable = (value: string | null | undefined): string =>
  value != null && value !== "" ? value : "—";
