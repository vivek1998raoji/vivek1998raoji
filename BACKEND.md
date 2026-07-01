# Backend (Supabase) — plan & activation

The app currently stores everything in the browser's `localStorage`, so data
isn't shared between the landlord and tenants. This document describes the
move to a real shared backend on **Supabase** (Postgres + Auth + Storage).

## Architecture

- **Database:** the tables in [`supabase/schema.sql`](supabase/schema.sql) —
  `buildings`, `rooms`, `tenants`, `invoices`, `maintenance_requests`, plus a
  `profiles` table mapping each auth user to a role.
- **Security:** Row Level Security. Landlord-owned rows carry `owner_id =
  auth.uid()`. Tenants get read access to their own room/invoices and can
  update payment requests / their profile. The anon key is therefore safe in
  the browser.
- **Auth:**
  - *Landlord* — one Supabase Auth account (email + password) with a
    `profiles.role = 'landlord'` row.
  - *Tenant* — when the landlord adds a tenant, a tenant auth account is
    created (login = phone-derived email, initial password = phone number),
    and `tenants.auth_user_id` is linked. Creating tenant accounts safely
    (without exposing the service key) uses a small **Supabase Edge Function**
    invoked by the landlord; this is implemented during wiring.
- **Storage:** a private bucket for tenant documents (govt IDs) and payment
  screenshots, replacing today's non-functional file inputs.
- **Billing math:** stays in [`src/lib/billing.js`](src/lib/billing.js) (pure,
  unit-tested) and is reused by the data layer unchanged.

## Activation steps (what unblocks the wiring)

1. Create a Supabase project (free tier).
2. SQL Editor → paste & run [`supabase/schema.sql`](supabase/schema.sql).
3. Authentication → create the landlord user; insert its `profiles` row
   (`role = 'landlord'`).
4. Copy **Project URL** + **anon key** into a local `.env`
   (see [`.env.example`](.env.example)) and into Vercel's Environment
   Variables (so the deployed site has them too).
5. The app reads these via [`src/lib/supabaseClient.js`](src/lib/supabaseClient.js).
   While they're absent, `isSupabaseConfigured` is `false` and the app keeps
   using `localStorage`, so nothing breaks before cut-over.

## Wiring (done once the project exists, so each piece can be tested live)

The backend code is now written and ready in [`src/lib/db.js`](src/lib/db.js):

- **Data layer** — `db.js` mirrors every `AppContext` action as an async
  Supabase call, with snake_case↔camelCase mappers and a `loadAll()` bulk
  fetch for the landlord dashboard.
- **Auth** — `signInLandlord` / `signInTenant` (tenants use a synthetic
  `<digits>@tenant.rentcms.local` email so one email+password Auth backs both
  roles), plus `getRole()`.
- **Edge Function** — [`supabase/functions/create-tenant/index.ts`](supabase/functions/create-tenant/index.ts)
  provisions tenant auth accounts without exposing the service key. Deploy
  with `supabase functions deploy create-tenant`.
- **Storage** — a private `tenant-files` bucket (created in `schema.sql`) with
  `uploadFile` / `signedUrl` helpers for documents & payment screenshots.

### Remaining step: flip `AppContext` to the data layer

`AppContext` still uses `localStorage` today (so the app keeps working while
the backend is verified). The final cutover is to make its actions call
`db.js` when `isSupabaseConfigured` is true — load via `db.loadAll()` on
mount, and route each mutator through the matching `db.*` function. This is
deliberately kept as one small, testable change to do against a live project
so we can confirm each flow end-to-end (rather than a blind switch).

### Activation checklist

1. Create the Supabase project (free tier) and run [`schema.sql`](supabase/schema.sql).
2. Create the landlord Auth user; insert its `profiles` row (`role='landlord'`).
3. Put the **Project URL** + **anon/publishable key** in `.env` and in Vercel's
   env vars. (`.env` currently holds placeholder-looking values — replace with
   the real project URL + a full publishable/anon key; the current key did not
   respond to a connectivity probe.)
4. Deploy the `create-tenant` Edge Function.
5. Do the `AppContext` cutover above and test: landlord login → add
   building/room/tenant → generate invoice → tenant login → pay → accept.
- Data migration of any existing localStorage records is optional.
