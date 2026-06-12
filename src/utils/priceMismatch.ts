// When the entered price disagrees with the catalog price for a known service+duration,
// return the data for a soft mismatch hint. This is order-independent (unlike the form's
// autofill, which only fills blanks), so it catches mismatches regardless of the order the
// receptionist fills service/duration/price. Returns null when there's nothing to flag:
// missing service/duration/price, an unknown service+duration combo, or a matching price.
export function priceMismatch(
  service: string | null | undefined,
  duration: number | string | null | undefined,
  price: number | string | null | undefined,
  lookupPrice: (serviceName: string, durationMinutes: number) => number | undefined,
): { service: string; duration: number; catalogPrice: number; entered: number } | null {
  if (!service || duration == null || duration === "" || price == null || String(price) === "") return null;
  const dur = Number(duration);
  const entered = Number(price);
  if (!Number.isFinite(dur) || !Number.isFinite(entered)) return null;
  const catalogPrice = lookupPrice(String(service), dur);
  if (catalogPrice == null || catalogPrice === entered) return null;
  return { service: String(service), duration: dur, catalogPrice, entered };
}
