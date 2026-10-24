# Step 2: accent-insensitive matching, "same person?" prompt, manual merge

Goal: stop new duplicate clients at the moment they're typed. Three parts, built in this order
(B depends on A; C is independent).

Migration for part A: `prisma/manual-migrations/2026-10-24-accent-insensitive-names.sql`
(unaccent extension, `fold_text()`, generated columns `client_name_folded`,
`client_surname_folded`, `client_full_name_folded`). Nothing below is built until it has been run and
`db pull` + `prisma generate` have picked up the new columns.

## A. Accent-insensitive matching

A JS `foldText()` (new `src/utils/text.ts`) mirrors the database's `fold_text()`: lower-case, accents
removed, ß→ss, æ→ae, œ→oe, ø→o, ł→l, đ→d, extra spaces collapsed. The search term is folded in JS and
compared with the folded columns, so Prisma `where` objects keep working (no raw SQL needed).

Surfaces switched to the folded columns:

| Surface | Today | After |
|---|---|---|
| Client suggestions dropdown (booking/voucher forms) — `api/clients/find-similar` | name contains, accent-sensitive | folded name/surname; ranking folds too |
| Clients table filters — `api/clients/search` | `client_name` contains | `client_name_folded` / `client_surname_folded` contains |
| Bookings search and client filter — `api/bookings/search` | name OR surname contains | full name folded, so "rocio soto" finds "Rocío Sotomayor" |
| Vouchers table buyer/recipient filters — `api/vouchers/list` | name OR surname contains | full name folded |
| Voucher search — `api/vouchers/search` (raw SQL) | ILIKE on name/surname | `client_full_name_folded LIKE` |
| Top clients in Stats — `api/stats` | hand-written `translate()` accent list | `fold_text()` |
| Duplicate detection — `lib/clients/duplicates.ts` | `normalizeNameForCompare` | built on `foldText()` so app and DB agree |

Stored names are never rewritten. ñ→n is folded for searching ("Munoz" finds "Muñoz") but never merges
anything on its own.

## B. "Is this the same person?" (the Carina case)

Today: "Carina" saved with no phone (e.g. as a voucher recipient), later "Carina" + phone in a booking →
no phone match → a second Carina is created. Nothing links the two.

New check in the shared client resolver (`resolveBookingClients.ts`, used by booking create/edit and
voucher create): when the typed client has a phone or email that matches nobody, look for **active
clients with no phone and no email whose folded full name equals the typed one**. If any exist, the
existing conflict dialog shows a new case:

> "Carina" already exists without contact details (created 04/09/2026, 0 bookings, recipient of
> V-040926-1). Is this the same person?
> - **Same person**: add the phone to that record and use it
> - **Different person**: create a new client

- Several candidates (common names like "María"): list up to 5, most recent activity first, plus
  "None of these".
- The existing contactless name-only link (name typed, no contact, exact same name) also becomes
  accent-insensitive. When the match is only accent-insensitive ("Rocio" vs existing "Rocío"), it asks
  instead of linking silently, so ñ/accents never join two people without a human saying so.
- No prompt when the receptionist picked a client from the suggestions dropdown (already decided).

## C. "Merge into another client…" on the Clients page (admin only)

For duplicates the phone-based review can't see (one record has no phone, different numbers, etc.).

- Client row menu → "Merge into another client…" → search and pick the client to keep.
- Preview: bookings and vouchers that move, and the resulting name / surname / phone / email. When both
  have a phone (or email), pick which one stays; the other record is retired with it.
- Same `merge_clients()` as the review screen: logged, listed in Recent merges, undoable (toast with
  Undo too).
- Guards: both active, not the same client, admin only; errors reuse the existing MERGE_* codes.

## Verification

- `npm run typecheck` + `npm run build`.
- Read-only checks on live data: "Rocio" search returns all 17 Rocío/Rocio clients; the Carina-type
  candidates count (contactless clients sharing a folded full name with someone typed with contact).
- Manual run-through in the app: booking with "Rocio" + new phone when a contactless "Rocío" exists →
  prompt → "Same person" adds the phone to her.
