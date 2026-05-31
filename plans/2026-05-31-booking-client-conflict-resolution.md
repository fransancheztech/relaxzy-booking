# Booking client conflict resolution

Date: 2026-05-31

## Problem

When a booking is saved with a **name not in the DB** but a **phone/email that matches
an existing client**, the two code paths behave inconsistently and silently:

- **Create** (`POST /api/bookings/new`): matches by email → phone, links to the existing
  client, and **silently ignores the typed name**.
- **Update** (`PUT /api/bookings/[id]`): matches by email → phone, links, and **silently
  overwrites** the existing client's name/email/phone (a silent rename across that client's
  whole history).

Both are surprising. Goal: a single, explicit, confirm-on-conflict behavior shared by create
and update (and companions).

## Decisions (confirmed with user)

1. **"Modify the client" overwrites ALL entered fields** (name, surname, email, phone). If the
   unique phone/email constraint is hit (P2002), abort the **entire** transaction (booking +
   client) and toast the reason.
2. **Companions get the same conflict prompt** (create flow can raise multiple conflicts at once).
3. **Surfaced at save** via a confirmation dialog, driven by a backend `409` conflict (backend
   is the source of truth; no writes happen until resolved).

## Conflict definition

A slot (primary client or a companion) is in conflict when:
- it has contact info, AND
- a match is found by email (priority) or phone among active clients, AND
- a **provided** (non-empty) name or surname differs (case-insensitive, trimmed) from the
  matched client's stored value, AND
- no resolution was supplied for that slot.

No match → create. Match with same name → link, no overwrite (never silently rename).

## Backend

### New: `src/lib/clients/resolveBookingClients.ts`
- Types: `ClientInput`, `ClientResolution = "use_existing" | "update_existing"`,
  `ClientConflict { slot, matchedBy, existing{...}, typed{...} }`.
- `ClientConflictError extends Error { conflicts: ClientConflict[] }`.
- `findClientMatch(tx, input)` → existing client or null (email→phone, `deleted_at: null`).
- `detectConflict(tx, slot, input, resolution?)` → `ClientConflict | null`.
- `applyClientSlot(tx, input, resolution?)` → `clientId | null`:
  - no info → null; no match → create; match + `update_existing` → update all fields (may
    throw P2002); match + `use_existing` or name-equal → link.

All callers run inside one `prisma.$transaction`. Throwing `ClientConflictError` or P2002
rolls everything back.

### `POST /api/bookings/new`
- Accept `clientResolutions?: Record<string, ClientResolution>` (slot keys: `"primary"`,
  `"companion-0"`, …).
- Move the primary client resolution INTO the existing transaction so booking+client are atomic.
- Phase 1 (detect): gather conflicts for primary + every companion; if any → throw
  `ClientConflictError`.
- Phase 2 (apply): resolve every slot, then create bookings.
- Catch: `ClientConflictError` → `409 { error: "CLIENT_NAME_CONFLICT", conflicts }`;
  `P2002` → `409 { error: "CLIENT_CONTACT_TAKEN" }` (friendly toast on FE).

### `PUT /api/bookings/[id]`
- Accept `clientResolution?: ClientResolution` (single slot `"primary"`).
- Replace the silent upsert block with `detectConflict` / `applyClientSlot`.
- Keep `wantsToRemoveClient` (clears `client_id`) and the cancelled-therapist guard.
- Add `409` for `CLIENT_NAME_CONFLICT` and `P2002` → `CLIENT_CONTACT_TAKEN`.

## Frontend

### New: `src/app/bookings/ClientConflictDialog.tsx`
- Props: `open`, `conflicts`, `onCancel`, `onResolve(Record<slot, ClientResolution>)`.
- One row per conflict: slot label ("Main client" / "Companion N"), "{phone|email} {value}
  already belongs to **{existing full name}**. You typed **{typed full name}**.", and a
  toggle [Use existing] / [Modify the client] (default: Use existing). "Modify" shows a small
  caution that it changes the client on all their bookings.
- Confirm button returns the resolution map.

### Handlers return a discriminated result (no longer swallow everything in toasts)
- `handleSubmitCreateBooking(data, clientResolutions?)` →
  `{ status: "ok" } | { status: "conflict", conflicts } | { status: "error" }`.
  Payments are registered only on `ok`.
- `handleSubmitUpdateBooking(data, clientResolution?)` → same shape (single conflict).

### Dialog wiring (`NewBookingDialogForm`, `UpdateBookingDialogForm`)
- On submit: call handler. `ok` → reset/close. `conflict` → stash pending data + conflicts,
  open `ClientConflictDialog`. `error` → handler already toasted, stay open.
- On `onResolve`: re-call handler with resolutions. `ok` → close all; `error` (e.g. P2002) →
  toast already shown, close conflict dialog, stay on form.

## i18n (en/es/th, `BookingForm` namespace)
`conflictTitle`, `conflictIntro`, `conflictMatchedPhone`, `conflictMatchedEmail`,
`conflictTyped`, `conflictUseExisting`, `conflictModify`, `conflictModifyWarning`,
`conflictPrimaryLabel`, `conflictCompanionLabel`, `conflictConfirm`, `conflictContactTaken`.

## Out of scope / notes
- Email-vs-phone matching two *different* clients: keep email priority (existing behavior).
- Edit dialog has no companions (groups handled separately) → PUT resolves primary only.
- `clients_history` already audits renames.

## Verify
- `npm run typecheck`.
- Manual: create with new name + existing phone → dialog; both choices; companion conflict;
  P2002 path; update path parity.
