// Whether IVA applies to a tip is determined solely by its payment method, never
// set by hand: cash tips carry no IVA; card (and voucher) tips do.
export function ivaAppliesForTipMethod(method: string): boolean {
  return method !== "cash";
}
