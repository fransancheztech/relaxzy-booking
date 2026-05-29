# Booking Groups — minimal implementation plan

**Date:** 2026-05-29
**Goal:** Replace the fragile `"Group."` notes-prefix convention with a real `booking_group_id` column on `bookings` and `bookings_history`. No parent table, no dedicated history table, no custom trigger — the existing `bookings_history` mechanism captures changes for free.

## Scope decisions (already agreed)

- **No `booking_groups` parent table.** Groups have no own state (no name, no group price, no group notes). Adding one now would be an empty shell. Revisit only if/when group-level data emerges.
- **No `booking_groups_history` table or `log_booking_group_changes` trigger.** Group membership changes are captured by the existing `bookings_history` rows whenever `booking_group_id` changes on a booking.
- **UUID, not human-readable id.** Receptionists never see or type the id; the UI shows "Group of N" and member chips.
- **Drop the `"Group."` notes prefix** at the same time the new column starts being written, so notes go back to being purely user content.

---

## 1) Migration SQL

Write to a new SQL file (user will apply it manually via Supabase, then run `prisma db pull` + `prisma generate` before downstream work — see [[feedback-db-migrations]]).

```sql
-- 1. Add column on bookings
ALTER TABLE bookings
  ADD COLUMN booking_group_id uuid;

-- 2. Add column on bookings_history (so history rows preserve group membership at each point in time)
ALTER TABLE bookings_history
  ADD COLUMN booking_group_id uuid;

-- 3. Partial index for fast sibling lookup on active grouped bookings
CREATE INDEX bookings_booking_group_id_active_idx
  ON bookings (booking_group_id)
  WHERE booking_group_id IS NOT NULL AND deleted_at IS NULL;
```

**No FK constraint** — `booking_group_id` is a free-floating shared marker, not a reference to a parent row.

**Backfill: skipped for now.** Historical bookings with `"Group."` prefix stay ungrouped. If we later want them grouped, a one-off script can match on `client_id + start_time + created_at within N seconds` where `notes LIKE 'Group.%'` and assign a shared uuid. Not worth doing pre-emptively.

**After applying the migration:** stop. User runs `prisma db pull` + `prisma generate`. Then resume with the code changes below.

---

## 2) Code changes

### 2a) [src/app/api/bookings/new/route.ts](src/app/api/bookings/new/route.ts)

Replace the `isGroup` / `groupNote` block (lines ~193–237) with:

```ts
const isGroup = companions.length > 0;
const groupId = isGroup ? crypto.randomUUID() : null;

const { booking, companionBookings } = await prisma.$transaction(async (tx) => {
  const primary = await tx.bookings.create({
    data: {
      client_id: clientId,
      service_id: serviceId,
      therapist_id: body.therapist_id?.trim() || null,
      therapist_requested: !!body.therapist_requested,
      start_time: start,
      end_time: end,
      notes: body.notes?.trim() || null,
      price,
      status: "confirmed",
      booking_group_id: groupId,
    },
  });

  const created = await Promise.all(
    companions.map(async (c, i) => {
      const dur = Number(c.duration);
      const companionEnd = new Date(start.getTime() + dur * 60 * 1000);
      const companionPrice =
        c.price !== undefined && c.price !== null && c.price !== ""
          ? Number(c.price)
          : null;

      return tx.bookings.create({
        data: {
          client_id: clientId,
          service_id: companionServiceIds[i],
          therapist_id: c.therapist_id?.trim() || null,
          start_time: start,
          end_time: companionEnd,
          notes: c.notes?.trim() || null,
          price: companionPrice,
          status: "confirmed",
          booking_group_id: groupId,
        },
      });
    }),
  );

  return { booking: primary, companionBookings: created };
});
```

Removed: the `groupNote` helper and the `"Group."` prefix injection. Notes now reflect only what the user typed.

### 2b) New API routes

**`src/app/api/bookings/[id]/group/route.ts`** (or wherever feels natural alongside existing booking actions):

- `GET` → `{ groupId, members: [{ id, start_time, service_name, therapist_name, ... }] }` for the sibling list. Returns `{ groupId: null, members: [] }` when the booking has no group.
- `PATCH { action: "remove" }` → sets `booking_group_id = NULL` on this booking. After the update, count remaining members; if exactly one remains, null it there too (a group of 1 is meaningless).
- `PATCH { action: "move", targetGroupId }` → sets this booking's `booking_group_id` to `targetGroupId`. Same "group of 1 cleanup" check on the *source* group.

Both PATCHes run in a `prisma.$transaction`. Dispatch `refreshCalendarData` / `refreshBookingsData` events on success per the SSE convention in CLAUDE.md.

> **Move is lower priority.** Ship Remove first; only add Move if a receptionist actually asks for it.

### 2c) UI — booking detail / update dialog

In [src/app/bookings/UpdateBookingDialogForm.tsx](src/app/bookings/UpdateBookingDialogForm.tsx) (or the detail view if separate):

- If `booking.booking_group_id` is set, render a **"Group members"** section that calls `GET /api/bookings/:id/group` and shows each sibling as a small clickable chip (client/therapist/time). Clicking a chip opens that booking.
- Add a **"Remove from group"** button next to the section header. Confirms, calls `PATCH … { action: "remove" }`, toasts on success, refreshes.
- Skip the Move UI for v1.

### 2d) UI — list & calendar visual cue

- [src/app/bookings/BookingsTable.tsx](src/app/bookings/BookingsTable.tsx): add a small group icon (e.g. MUI `GroupIcon`) in the row when `booking_group_id IS NOT NULL`. No new column — just a leading icon next to the client name.
- Calendar event renderer: same small icon overlay or a left-border accent. Cheap and makes group bookings legible at a glance.

### 2e) Zod schema

[src/schemas/booking.schema.ts](src/schemas/booking.schema.ts): no change to the create-booking input schema (the id is generated server-side). If any response/read schema declares booking fields explicitly, add `booking_group_id: z.string().uuid().nullable()`.

---

## 3) Out of scope / explicitly NOT doing

- No `booking_groups` table.
- No `booking_groups_history` table.
- No `log_booking_group_changes` function or trigger.
- No human-readable group id.
- No backfill of historical `"Group."`-prefixed bookings.
- No "Move to another group" UI (defer until requested).
- No bulk group operations (delete-whole-group, reschedule-whole-group). Add only if a real need surfaces.

---

## 4) Verification checklist

- [ ] `npm run typecheck` clean after `prisma generate`.
- [ ] Create a multi-companion booking via the New Booking dialog → all rows share a non-null `booking_group_id`, notes contain no `"Group."` prefix.
- [ ] Create a solo booking → `booking_group_id IS NULL`.
- [ ] Open a grouped booking → siblings render in the Group members section.
- [ ] Click "Remove from group" on a member of a group of 3 → that booking becomes null; remaining two still share the original id.
- [ ] Click "Remove from group" on a member of a group of 2 → both bookings become null (no orphan group-of-1).
- [ ] `bookings_history` rows generated by the remove action carry the *previous* `booking_group_id`, confirming change tracking works without any new trigger.

---

## 5) Rollout order

1. Write migration SQL → **stop**, hand to user.
2. User applies it, runs `prisma db pull` + `prisma generate`.
3. Apply the `/api/bookings/new` change (drops `"Group."` prefix, writes `booking_group_id`).
4. Add the `[id]/group` route (GET + PATCH remove only).
5. Wire the UI section + remove button in the update dialog.
6. Add the list/calendar icon cue.
7. Typecheck, manual smoke test per checklist above.
