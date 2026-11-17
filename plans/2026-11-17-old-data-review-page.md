# Old-data review page

A temporary, admin-only page where the owner goes through data problems one at a time and decides
what to do with each. It is step 3 of the old-data cleanup (Sep 2024 – May 2026). It starts with
three client checks that don't need the scans, so the page is useful before the scans are read.

## One table for every kind of problem

`review_items` holds one row per problem found. It is generic, so the scan, notes and voucher checks
added later need no new table unless they bring bulky data of their own.

| column | meaning |
|---|---|
| `kind` | what was found, e.g. `client_missing_accent` |
| `item_key` | stable identity within the kind (e.g. the client id). `(kind, item_key)` is unique, so running a check again updates its rows instead of duplicating them |
| `source` | the check or import that created the row |
| `business_date` | the day it is about (Madrid), when there is one; used to work day by day through the scans |
| `client_id`, `booking_id`, `voucher_id` | what it is about. No foreign keys, so the core models get no relation fields for a temporary table |
| `details` | what was found: the current values and the evidence |
| `proposal` | the suggested change, if there is one |
| `status` | `open`, `decided` or `deferred` ("ask Chalida", "look at it later") |
| `decision` | what the reviewer chose, e.g. `{ "action": "apply", "client_name": "Darío" }` or `{ "action": "keep" }` |
| `note`, `decided_by`, `decided_at` | the reviewer's comment and who decided when |
| `applied_at` | when the real data was brought in line with the decision (straight away for `keep`) |

Same protection as `client_duplicate_dismissals`: RLS on with no policies, no grants for anon or
authenticated. Only the app, through Prisma, reads and writes it.

## How a check works

1. **Find.** An admin presses "Search again" on a tab. An API route runs the check against the
   current data and upserts one row per problem by `(kind, item_key)`. Open rows the check no longer
   finds are deleted (nothing was decided on them). Decided and deferred rows are never touched.
2. **Decide.** The page shows one item at a time: what was found, the proposal (editable), and
   Apply / Keep as is / Later, plus a note.
3. **Apply.** For the client checks, Apply makes the change at once through the same code the client
   form uses (`normalizeClientName`, the soft-delete rules), so it is logged in `clients_history`
   like any other edit. The scan checks will mostly record decisions; I turn the decided items into
   SQL files that the owner runs, and `applied_at` is set after that.

## First three checks (no scans needed)

- **`client_missing_accent`**: a name or surname written without the accent it normally has
  ("Dario" → "Darío", "Garcia" → "García"). Evidence: the same name stored with the accent on other
  clients, plus a short list of common Spanish names and surnames. Suggestions only. Some people
  write their name without the accent, and foreign clients ("Maria" from France) are right as they
  are. One item per client and field.
- **`client_surname_in_name`**: the name field holds name and surname, and the surname field is
  empty ("Rocío Sotomayor"). The proposal splits off the last word, but not inside known compound
  first names (José María, María del Mar, Ana Belén, Juan Carlos). Every split is confirmed by hand.
- **`client_inactive`**: active clients with no live bookings, vouchers or voucher uses (156 on
  16/11/2026; 125 of them only have deleted bookings). Retire or keep. Before retiring, check
  `vouchers.buyer_id`/`recipient_id` and `voucher_uses.recipient_id` (no foreign keys).

## Voucher tabs (built 2026-11-17)

Two imported kinds. Their source files hold client data, so they live outside the repo
(Documents/Relaxzy/Transcripciones Vouchers) and are uploaded on the page (`/api/review/import`).
The details of each item keep the uploaded data, and "Search again" works the proposals out again
against the current vouchers.

- **`voucher_online_order`** (`pedidos_online.json`, built by `tools/pedidos.py` from the shop
  export and the order and form e-mails). One item per real order, compared with the system
  vouchers whose external reference is the order number. An order that matches (count and money)
  is decided "ok" by itself (`decided_by` empty, shown as "auto"). The others: missing, only
  deleted vouchers, different count or amount. Outcomes: ok, missing (add the vouchers), fix
  (note required), test.
- **`voucher_card`** (`tarjetas.json`, the 98 transcribed cards). One item per card. Proposal: the
  physical vouchers it most likely is (a code written on the card, else date ±3 days and names;
  suggestions are assigned across all cards so a voucher is never suggested twice), the online
  order it may be a printed copy of, and the usage (card line vs uses recorded). The reviewer
  confirms: these vouchers / this online order / missing; used or not; shop gift.

Both only record decisions. `needsFollowUp` keeps `applied_at` empty for decisions that still have
to reach the data (vouchers to add, a use to record, a fix); a SQL file built from them sets it.

## Later

- Scan import: the extraction JSON goes in through an upload on the page (client data stays out of
  the repo), and each mismatch between a sheet and the system becomes an item with `business_date`.
- Proposals from booking notes: therapist letters (1,492 bookings in 2026), tips (163 notes), couple
  groups (787 bookings). They are applied only after the scans have confirmed them.
- Voucher cards matched to sales and uses.
- When the cleanup is over: remove the page and `DROP TABLE public.review_items`.

## Steps

1. Migration `2026-11-17-review-items.sql`, then the owner runs db pull + prisma generate.
2. API routes under `/api/review/` (list with counts, find for one kind, decide), admin only.
3. The `/review` page: tabs per check with open / decided / later counts, one item at a time, and
   an admin-only menu entry.
4. The three client checks.
