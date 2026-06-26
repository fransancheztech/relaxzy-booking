# Plan: Pin the app to a fixed business timezone (Europe/Madrid)

**Date:** 2026-06-12
**Status:** Proposed (no code changed yet)
**Decisions taken:** (1) Do display + input + server day-math in a **single pass**. (2) Switch MUI pickers to **AdapterLuxon**.

---

## 1. Problem

The app renders **and accepts** times in the **browser's local timezone**. It only worked in Spain because the browser zone coincided with the business zone. After moving the laptop to Bangkok (UTC+7 vs Madrid UTC+1/+2), every instant shifts ~5–6h, which:

- Pushes evening bookings past the calendar's `slotMaxTime="22:00:00"` window → they vanish (the reported symptom).
- **Silently corrupts new data**: a booking entered as 20:00 in Thailand is stored as 20:00 Bangkok ≈ 15:00 Madrid.
- Skews server-side day grouping (stats buckets, "today", voucher-code date) which runs in UTC, not Madrid.

The business is, and for now always is, in **Spain**. Times must always be Madrid time regardless of the operator's machine.

## 2. Principle / architecture

- **Storage stays UTC** (`timestamptz` columns are already correct — do not touch the DB data).
- Treat the **browser/server zone as irrelevant**. Convert at every edge — display-out, input-in, and server day-math — to/from a single constant **`BUSINESS_TIMEZONE = "Europe/Madrid"`**.
- All conversions go through **one helper module + one constant**, so "localize per business later" is a one-place change (the future requirement).
- Always use the **named IANA zone** (`Europe/Madrid`), never a fixed `+01:00`, so DST is handled by luxon / Postgres.

## 3. New shared building blocks (create first)

1. **`src/constants` →** `export const BUSINESS_TIMEZONE = "Europe/Madrid";`
2. **`src/utils/businessTime.ts`** (luxon-based — luxon is already a dependency):
   - `formatBusinessDate(value)` → `dd/MM/yyyy`
   - `formatBusinessDateTime(value)` → `dd/MM/yyyy HH:mm` (replaces `src/utils/formatDateTime.ts` behavior, in Madrid)
   - `formatBusinessTime(value)` → `HH:mm`
   - `businessDayStartUtc(date)` / `businessDayEndExclusiveUtc(date)` → UTC `Date` for the Madrid day bounds (for ranges)
   - `nowBusiness()` → Madrid `DateTime`
   - `businessDdMmYy(date)` → `DDMMYY` in Madrid (for voucher codes)
   - `jsDateToBusinessDateTime(date)` / `businessDateTimeToJsDate(dt)` → adapter boundary conversions for the pickers
3. **`src/components/BusinessLocalizationProvider.tsx`** — wraps `LocalizationProvider` with `AdapterLuxon` + `es` locale; pickers inside pass `timezone="Europe/Madrid"`. Centralizes the adapter so the 6 picker sites stop repeating `AdapterDateFns`.
4. **Server SQL helper** — a `Prisma.sql` fragment / convention for `(<col> AT TIME ZONE 'Europe/Madrid')` used in `date_trunc` and day-boundary expressions.

## 4. Work items by layer

### 4a. INPUT — pickers → AdapterLuxon + `timezone="Europe/Madrid"` (do first; correctness)
Switch these from inline `AdapterDateFns` provider to `BusinessLocalizationProvider`, and make each picker `timezone="Europe/Madrid"`:
- `src/app/bookings/NewBookingFormFields.tsx` — booking `start_time` `DateTimePicker`
- `src/app/bookings/UpdateBookingFormFields.tsx` — booking `start_time` `DateTimePicker`
- `src/app/vouchers/NewVoucherFormFields.tsx` — expiry (+ created_at if editable)
- `src/app/vouchers/VoucherDetailDialog.tsx` — expiry / created_at editing
- `src/app/stats/components/DateRangeFilter.tsx` — From/To `DatePicker`s (Stats + Tips)
- `src/components/GridFormElement.tsx` — generic `DatePicker`/`DateTimePicker` (verify it's still used by any live form; migrate or delete)

**Key ripple to handle:** AdapterLuxon makes picker values **Luxon `DateTime`**, but `booking.schema.ts` uses `z.date()` and forms hold JS `Date`. Convert at the **Controller boundary**: build the picker's value from the stored JS `Date` as a Madrid `DateTime`, and on change convert back to a JS `Date` (same instant) before it hits RHF/zod. Use the `jsDateToBusinessDateTime` / `businessDateTimeToJsDate` helpers. (Alternative — change schema to DateTime — rejected to keep the blast radius small.)

### 4b. DISPLAY — render every instant in Madrid (must ship with 4a)
- **Calendar** (`src/app/calendar/CalendarUI.tsx`):
  - Install **`@fullcalendar/luxon3`**, register the plugin, set `timeZone="Europe/Madrid"` on `<FullCalendar>`. Now `slotMinTime/slotMaxTime` (10:00–22:00) mean Madrid time → evening bookings reappear.
  - Simplify the existing event mapping (lines ~172-173): feed FC the UTC/`Z` ISO and let the plugin zone it (remove the now-redundant manual `DateTime.fromISO(..., {zone})`).
  - The daily-totals & close-day ranges derive from FC `datesSet` (`range.start/end`, posted at line ~277) — they become correct Madrid day bounds automatically once FC `timeZone` is set. **Verify** after the change.
- **Central util:** reimplement `src/utils/formatDateTime.ts` to delegate to `formatBusinessDateTime` (or replace call sites). It's widely used.
- **Replace ad-hoc `toLocale*` instant formatting** (client) with the Madrid helpers in: `ManagePaymentsDialog`, `DailyTotalsDialog`, `TipsPageContent` (booking cell time), `VoucherDetailDialog`, `BookingGroupSection`, `VouchersTable`, `BookingsTable`, `DialogPayment`, `ServicesTable`, `TipSection`, `guidelines/page`, `VoucherInfoTooltip` (expiry via date-fns `format`).
- **Charts** formatting period labels with `toLocaleDateString` (`RevenueSection`, `VoucherSection`, `ClientSection`, `TipsSection`): format the bucket label in Madrid (the bucket value itself is fixed in 4c).
- **Server-rendered date columns** (latent UTC bug — these run in Node, currently UTC): `api/bookings/search`, `api/vouchers/list`, `api/payments/search`, `api/clients/search` use `toLocale*` server-side. Format in Madrid (or return ISO and format client-side).

### 4c. SERVER — day math in Madrid
- **`src/app/api/stats/route.ts`** — every `date_trunc(${bSql}, b.start_time)` / `(…, v.created_at)` becomes `date_trunc(${bSql}, (<col> AT TIME ZONE 'Europe/Madrid'))` and convert the bucket back for output. Also `getBucket` day-count math is fine, but the **range boundaries** come from `StatsPageContent` (`startOfDay(pickFrom)` etc., browser-zone) → compute them as **Madrid** day bounds via `businessDayStartUtc/EndExclusiveUtc`.
- **`src/app/api/calendar/daily-totals/route.ts`** & **`batch-complete` (close day)** — `startDate/endDate` come from the calendar range; verify they're Madrid bounds post-4b. If any "today"/now is computed server-side, base it on `nowBusiness()`.
- **`src/app/api/vouchers/new/route.ts`** — `formatDdMmYyUtc` + `utcDayBounds` + `createdAt = new Date()` → use **Madrid** date for the `V-DDMMYY-N` code and the same-day uniqueness window (`businessDdMmYy`, Madrid day bounds).
- **DB session timezone:** prefer **explicit `AT TIME ZONE`** over setting the connection `TimeZone` globally (clearer, no hidden global coupling). Note in PR description.

## 5. Sequencing (single pass, ordered to avoid the "looks-fixed-but-wrong" trap)
1. Constant + `businessTime.ts` + `BusinessLocalizationProvider`.
2. **Inputs (4a)** — so new bookings/vouchers are saved correctly immediately.
3. **Display (4b)** — FC plugin/timeZone + helper sweep.
4. **Server day-math (4c)**.
5. `npm run typecheck`, then manual TZ-emulated testing (§6).

> Do **not** land 4b without 4a — a display-only fix makes the calendar look right while inputs keep saving shifted times (worst case).

## 6. Testing
- **Emulate, don't relocate:** Chrome DevTools → Rendering → **"Emulate timezone: Asia/Bangkok"** for the browser (pickers + calendar). For server math, run dev with **`TZ=Asia/Bangkok`**.
- **Round-trip:** create a booking at 21:00 → stored UTC is the correct instant (19:00Z summer / 20:00Z winter) → re-reads as 21:00 in calendar, list, and edit dialog.
- **Calendar window:** a 21:30 Madrid booking is visible (not clipped by 22:00).
- **Stats/daily totals:** "today" totals match a Madrid calendar day; a 23:30 Madrid booking buckets into that Madrid day, not the UTC one.
- **Voucher code:** created near Madrid-midnight gets the Madrid `DDMMYY`.
- **DST:** test one **summer** (UTC+2) and one **winter** (UTC+1) date, plus a booking near Madrid midnight and across the Madrid↔Bangkok date line.

## 7. Risks & edge cases
- **Adapter value-type ripple** (DateTime vs Date) — see 4a; the main implementation hazard. Keep conversions at the Controller boundary.
- **DST correctness** — guaranteed only with the named zone; never hardcode offsets.
- **Mixed libraries** — luxon (calendar + helpers + pickers) alongside date-fns elsewhere is fine; avoid using date-fns `format`/`startOfDay` on **instants** going forward (they're browser-zone).
- **Backdated voucher `created_at`** — must zone correctly too.
- **`date-fns-tz`/`@date-fns/tz` not installed** — we standardize on **luxon** to avoid adding another tz lib.

## 8. Out of scope / future
- **Per-business timezone** setting: the `BUSINESS_TIMEZONE` constant is the seam. Later, store a zone per business/location and read it where the constant is used. All conversions already funnel through the helper, so this becomes a small change.
- No data migration: stored UTC instants are already correct; only presentation/intake/bucketing change.

## 9. Affected files (checklist)
**New:** `constants` (BUSINESS_TIMEZONE), `utils/businessTime.ts`, `components/BusinessLocalizationProvider.tsx`
**Inputs:** `NewBookingFormFields`, `UpdateBookingFormFields`, `NewVoucherFormFields`, `VoucherDetailDialog`, `stats/components/DateRangeFilter`, `components/GridFormElement`
**Display:** `calendar/CalendarUI` (+ `@fullcalendar/luxon3` dep), `utils/formatDateTime`, `ManagePaymentsDialog`, `DailyTotalsDialog`, `components/VoucherInfoTooltip`, `TipsPageContent`, `VoucherDetailDialog`, `BookingGroupSection`, `VouchersTable`, `BookingsTable`, `DialogPayment`, `ServicesTable`, `TipSection`, `guidelines/page`, chart sections (`RevenueSection`, `VoucherSection`, `ClientSection`, `TipsSection`), server list routes (`api/bookings/search`, `api/vouchers/list`, `api/payments/search`, `api/clients/search`)
**Server day-math:** `api/stats/route`, `StatsPageContent` (range bounds), `api/calendar/daily-totals/route`, `api/bookings/batch-complete/route`, `api/vouchers/new/route`
