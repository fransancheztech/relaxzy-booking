# Phone normalisation (E.164) — scope and plan

Issue 1 from the Top clients review: the same person stored three times because their phone was
typed three ways (`+34 689 59 01 23`, `+34689590123`, `689590123`). The unique index
`clients_phone_active_unique` compares raw strings, and `phoneValidator` only validates — it never
normalises — so every format variant passes as a "new" number.

## What the live data says (2026-10-18)

| | clients | therapists |
|---|---|---|
| rows with a phone | 2,843 | 5 |
| already E.164 | 1,675 | 1 |
| would change | 1,168 | 4 |
| invalid / unparseable | 0 | 0 |
| E.164 duplicate clusters | 125 (148 extra rows) | 0 |
| rewritable without collision | 984 | 4 |

- The legacy import script (`src/scripts/importBookings.mjs`) already stored E.164. Every import-era
  row (2025-10) is canonical. The app's own write paths never normalised, and the share of
  non-canonical numbers has grown month by month (Sep 2026: 243 of 299 new clients).
- **A SQL regex key is not safe.** 31 numbers carry a national trunk `0` after the country code
  (`+44 07368…`, `+33 06…`, `+31 06…`). libphonenumber drops it; a digits-only SQL key does not.
  So the canonical form must come from libphonenumber, and the DB-side guard must check the
  *shape* of what the app wrote, not recompute it. This replaces my earlier idea of a regex
  generated column.

## The trap: normalise-on-write alone would CREATE duplicates

`PUT /api/bookings/[id]` re-resolves the client on every save (`applyClientSlot` →
`findClientMatch`) and re-links `bookings.client_id`. The form sends back the phone exactly as
stored. If the input is normalised but matching stays exact-string, a legacy row stored as
`689 59 01 23` no longer matches `+34689590123` → a new client is created on every booking save.

And the opposite trap: if collision checks become format-insensitive, then editing *anything* on a
client that belongs to a duplicate cluster (notes, a voucher's buyer name) fails with "phone taken",
because its sibling owns the canonical number. 148 rows would become uneditable until merged.

So the design needs three rules:

1. **Write canonical** — new or changed numbers are stored as E.164.
2. **Match exact-first, then canonical** — the stored string first (keeps an edited booking on the
   same row, including cluster siblings), then the canonical form (catches the same number typed
   differently). Both are exact lookups on the unique btree index.
3. **Don't rewrite what didn't change** — on update, if the typed number equals the stored one
   canonically, keep the stored string untouched and skip the collision check. Existing duplicates
   are the merge review's job; this change only stops new ones.

## Surfaces

### Write paths (`clients.client_phone`)
- `src/lib/clients/resolveBookingClients.ts` — `applyClientSlot` create + `update_existing`
  (used by bookings/new primary + companions, bookings/[id], vouchers/new buyer + recipient)
- `src/app/api/clients/new/route.ts`
- `src/app/api/clients/[clientId]/route.ts` — also has its own inline copy of the collision check;
  consolidate onto `assertContactFree`
- `src/app/api/vouchers/[id]/route.ts` — buyer/recipient edits
- `src/scripts/importBookings.mjs` — already E.164, untouched

### Write paths (`therapists.phone`) — no unique index, consistency only
- `src/app/api/therapists/add/route.ts`, `src/app/api/therapists/[id]/route.ts`

### Validation gaps found (server-side)
- `PATCH /api/vouchers/[id]` validates no phone/email at all.
- `POST /api/bookings/new` validates the primary's contact only; companions go unchecked into
  `applyClientSlot`. The UI validates both, direct API calls don't.

### Matching / collision
- `findClientMatch` (phone tier), `detectClientConflict` (typed value shown in the dialog),
  `assertContactFree`

### Search (substring) — strip non-digits from the query
- `src/app/api/clients/find-similar/route.ts` (the client dropdown in New/Edit Booking, companions,
  New Voucher, Edit Voucher) — filter and ranking
- `src/app/api/clients/search/route.ts` (Clients page phone filter)
- `src/app/api/bookings/search/route.ts` (customer phone filter + global search)
- `src/app/api/vouchers/search/route.ts` (voucher picker)
- `src/app/api/therapists/route.ts` (Therapists page search)

### Display — one formatter, international format (`+34 689 59 01 23`)
- `ClientsTable`, `BookingsTable`, `TherapistsTable`, `TopClientsTable`
- `ClientDropdown`, `VoucherClientSection` dropdown (+ digit-aware highlight)
- `ClientConflictDialog`, `VoucherDetailDialog`, `VoucherInfoTooltip`, `UpdateClientFormFields`
  read-only view

### Not affected
- Unique violation classification by constraint name (`vouchers/new`) — unchanged
- `bookings/range` returns the phone but nothing renders it
- `clients_phone_idx` (trigram) still serves substring search

### Dead code touching phones — left alone, listed for a separate cleanup
- `useSimilarClients()` (only its `ClientRow` type is used) and `find-similar`'s `handleLegacy`
- `src/app/calendar/ClientSearch.tsx`
- DB function `search_clients_fuzzy` (no callers; also ignores `deleted_at`)

## Backfill

Generated SQL, reviewed and run by hand (`prisma/manual-migrations/`):
- Every row whose canonical form collides with nothing → rewritten.
- Each duplicate cluster with no canonical row yet → exactly one row canonicalised (most bookings,
  then oldest), so every number has one canonical owner that exact matching finds.
- Every statement guarded by `AND client_phone = '<old value>'` → idempotent, skips rows edited since.
- `updated_at` untouched (format change, not a user edit). `clients_history` will log one UPDATE
  per row — it has no actor/timestamp columns, so the sweep is not attributable there.

## Order

1. Deploy code (works on mixed raw + canonical data).
2. Run the backfill SQL.
3. Later, after the duplicate-merge review: `CHECK (client_phone ~ '^\+[1-9][0-9]{6,14}$')`
   as the DB-level guarantee, covering console edits too.

## Adjacent, out of scope
- Emails are lowercased only in `PUT /api/clients/[clientId]`; 52 clients have an email, 4 with
  uppercase.
