# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server with Turbopack
npm run build        # Production build
npm run typecheck    # Run tsc --noEmit
npm run lint         # ESLint
```

There are no automated tests. Type-check with `npm run typecheck` to verify correctness after changes.

## Architecture Overview

This is a **Next.js 16 app-router** booking management system for a massage therapy business. It uses Supabase for auth and PostgreSQL (via Prisma) for the database.

### Stack

- **UI:** MUI v7 + Tailwind v4. Tables use `@mui/x-data-grid`, date pickers use `@mui/x-date-pickers` with `date-fns` + `es` locale.
- **Forms:** `react-hook-form` + `zod` (schemas in `src/schemas/`). All forms use `zodResolver` and `FormProvider`/`useFormContext`.
- **DB:** Prisma with `@prisma/adapter-pg` (connection pooling). Generated client output is `generated/prisma` (not the default location — import from `"generated/prisma"`, not `"@prisma/client"`).
- **Auth:** Supabase SSR. Server helpers in `src/utils/supabase/server.ts`, browser client in `src/utils/supabase/client.ts`. `getCurrentUserId()` in `src/lib/auth/` resolves the authenticated user server-side.
- **Notifications:** `react-toastify` for success/error toasts.

### Request Flow

All data fetching is client-side. Pages are `"use client"` components that call their own `fetch()` to `/api/` routes. There are no server components fetching data — the pattern is always: page → `fetch("/api/...")` → route handler → Prisma → DB.

### API Route Conventions

Routes live at `src/app/api/[resource]/[action]/route.ts`. All routes:
- Parse body with `await request.json()`
- Return `NextResponse.json(...)` with appropriate status codes
- Wrap in `try/catch` returning `{ error: string }` on failure

For **paginated list endpoints**, the request body is `{ page, limit, sort: { field, sort: "asc"|"desc" } }` and the response is `{ rows, total }`. `FETCH_LIMIT = 100` is the page size constant (from `src/constants/index.ts`).

For **Supabase stored procedures** (e.g. `register_payment_event`, `register_voucher_event`), use `prisma.$queryRaw` with tagged template literals — these can be called inside a `prisma.$transaction` via the `tx` client.

### Transactions

All multi-step writes use `prisma.$transaction(async (tx) => { ... })`. The `tx` client is passed into helper functions — never use the global `prisma` inside a transaction helper.

### Realtime Updates

List pages subscribe to Server-Sent Events via `new EventSource("/api/[resource]/stream")`. When a write succeeds, the route (or client handler) dispatches a `CustomEvent` (e.g. `refreshCalendarData`, `refreshVouchersData`) on `window`, and the table's `useEffect` listener calls `loadX(currentPage)` to refetch.

### Layout & Navigation

`LayoutContext` (`src/app/context/LayoutContext.tsx`) provides `setButtonLabel` and `setOnButtonClick` — every page calls these in a `useEffect` to configure the top-right header action button (e.g. "New Booking", "New Voucher"). The cleanup in the `useEffect` return resets them to `""` / `null`.

### Soft Deletes

All main entities use `deleted_at: null` as the "active" filter. Always include `where: { deleted_at: null }` in Prisma queries.

### Vouchers

Voucher balance is maintained by the Supabase function `register_voucher_event(voucher_id, event_type, amount, recipient_id, ...)`. Event type `'TOPUP'` credits the balance; `'CHARGE'` debits it. Do not update `vouchers.balance` directly — always go through this function.

### Environment Variables

```
DATABASE_URL                    # Pooled connection (Prisma runtime)
DIRECT_URL                      # Direct connection (migrations)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```
