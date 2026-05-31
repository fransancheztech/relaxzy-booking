# Stats: unified, always-visible date range as single source of truth

Date: 2026-05-31

## Goals (from user)
1. Date pickers always visible (not only under a "Custom" toggle). Remove the "Custom" option.
2. The dates shown in the pickers reflect the chosen preset (coherent display).
3. These Options + Date Pickers are the single source of truth for the Therapist Hours
   section too — remove its dedicated month picker.
4. Access: the Options + Date Pickers are visible to **all** roles. For therapists, only the
   Therapist Hours section remains visible on the Stats page (the rest stays admin-only).

## Model
- State in `StatsPageContent`: `preset`, `pickFrom`, `pickTo` (inclusive, date-only display
  dates). Effective query range derived: `from = startOfDay(pickFrom)`,
  `to = addDays(startOfDay(pickTo), 1)` (half-open, so the end day is fully included).
- Presets just set `pickFrom`/`pickTo` to inclusive display dates; editing a picker sets
  `preset = "custom"` (no toggle highlighted, since "custom" is removed from the button list).
- This single derived `from`/`to` drives **both** `/api/stats` (admin) and
  `/api/stats/therapist-hours` (all roles).

Note: presets now include the rest of *today* (To = today, inclusive) rather than stopping at
`now()`. This matches the visible To picker and the calendar's day window.

## Changes
- `DateRangeFilter.tsx`: drop "custom" from the visible presets; always render both pickers;
  bind them to `from`/`to`; `resolvePreset` returns inclusive display dates (all = 1970..2099,
  keeping `from` < 1990 so the API's all-time branch still triggers).
- `StatsPageContent.tsx`: replace custom-only state with `pickFrom`/`pickTo` + derived
  `from`/`to`; render the filter for all roles; keep KPIs/sections admin-only; only call
  `/api/stats` for admins; pass derived `from`/`to` to Therapist Hours.
- `TherapistHoursSection.tsx`: remove month nav/state; accept `from`/`to` props; fetch
  `/api/stats/therapist-hours?from=&to=`. Keep therapist filter + table + therapist-account
  behavior.
- `api/stats/therapist-hours/route.ts`: accept `from`/`to` ISO params; filter
  `b.start_time >= from AND b.start_time < to` (drop the `month` param). Keep
  `t.deleted_at IS NULL AND t.active = true`.

## Verify
- `npm run typecheck`.
- Admin: presets update pickers; editing a date deselects presets; KPIs + Therapist Hours both
  follow the range. Today = pick `from`/`to` = today.
- Therapist: sees only the filter + Therapist Hours; no 403 from `/api/stats` (not called).
