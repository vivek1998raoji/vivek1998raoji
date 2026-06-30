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

- `AppContext` data actions read/write Supabase instead of `localStorage`.
- Login uses `supabase.auth.signInWithPassword` (landlord + tenant).
- Edge Function for tenant account provisioning.
- Storage upload for documents & payment screenshots.
- Data migration of any existing localStorage records (optional).
