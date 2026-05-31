# Therapist archiving + restore

Date: 2026-05-31

## Goal
Treat deleted (soft) and inactive therapists as "not on the current roster": hide them
from the therapist-keyed analytics and the Tips page, and add a restore path for when a
therapist returns. Departures are handled with Delete; temporary/seasonal with Disable.

## Decisions (confirmed with user)
- Hide **deleted AND inactive** therapists from: Stats → Therapist Hours, Stats →
  Tips-by-therapist, and the Tips page list.
- Restore is available to **receptionists too** (not admin-only), but less casual than the
  active toggle (behind a "Show archived" view + confirm dialog).
- Restore reinstates as **active** (`deleted_at = null, active = true`).
- Calendar keeps showing deleted/inactive therapists' past appointments (greyed) — unchanged.

## Known trade-off (accepted)
Hiding deleted+inactive makes historical totals non-reproducible: past "tips"/"hours" for a
period shrink once a therapist leaves or is deactivated. Accepted; restore/activate brings
them back into view.

## Schema note
`therapists` has **no unique constraints** (only PK). Restore can never collide, and reusing
the record re-links all historical bookings/tips automatically — the correct path for a
returning therapist (vs. re-adding, which would orphan history).

## Backend changes
1. `api/stats/therapist-hours/route.ts` — add `AND t.active = true` (already filters `deleted_at`).
2. `api/stats/route.ts` tips query — add `AND th.active = true` (already filters `deleted_at`).
3. `api/tips/list/route.ts` — add `therapists: { active: true, deleted_at: null }` to the where.
4. `api/therapists/route.ts` (POST list) — accept `archived?: boolean`:
   - `false`/absent → `deleted_at: null` (current behavior).
   - `true` → `deleted_at: { not: null }`; return `deleted_at` in rows.
5. `api/therapists/[id]/route.ts` — add `PATCH` → restore: `{ deleted_at: null, active: true }`.

## Frontend changes
6. `therapists/page.tsx` — add a "Show archived" toggle; thread `archived` into `loadTherapists`
   and pass `archived` + `onRestore` to the table. Restore calls `PATCH`, then reload.
7. `TherapistsTable.tsx` — `archived` prop: in archived mode show a **Restore** action (behind
   a confirm dialog) instead of Edit (Edit would 404 on a deleted therapist via GET).
8. i18n (en/es/th, `Therapists`): `showArchived`, `restore`, `restoreTitle`, `restoreMessage`,
   `therapistRestored`.

## Verify
- `npm run typecheck`; message JSON parses.
- Manual: delete a therapist → gone from Therapist Hours, Tips-by-therapist, Tips page;
  "Show archived" lists them; restore → reappears everywhere and is bookable again.
