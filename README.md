# Rent Management CMS

A web app for landlords to manage buildings, rooms, tenants, and monthly
rent + electricity invoices, with a separate tenant portal for viewing bills
and submitting payments.

**Live:** https://rental-management-cms.vercel.app/

## Features

**Landlord**
- Dashboard with this-month collection, all-time received, pending, overdue,
  and open-maintenance counters.
- Buildings & rooms, tenants (with searchable roster and image document
  uploads), and monthly billing with a month **dropdown** (no more free text).
- Invoices: generate (auto rent + electricity + water/other + carried
  balance), **edit** with automatic recalculation, **void**, or **delete** —
  all keeping tenant balances in sync. Search, status filter, and **CSV export**.
- Per-invoice **Print / Save-as-PDF** and **Send-on-WhatsApp** (pre-filled bill).
- Payment requests with receipt preview + one-click accept (records a dated
  **payment ledger**).
- **Maintenance** tab to triage tenant-reported issues (open → in progress →
  resolved).

**Tenant**
- Profile, bill breakdown with due date, partial or full **Pay Now** with
  screenshot upload, downloadable bills, payment history.
- **Maintenance** requests and a **Lease Details** view.

## Tech stack

- **Vite** + **React 19**
- **react-router-dom 7** for routing
- **lucide-react** for icons
- State in React Context (`src/context/AppContext.jsx`)

> ⚠️ **Current data storage:** the app currently persists all data in the
> browser's `localStorage`. This means data is per-device and not shared
> between the landlord and tenants. Migrating to a real backend
> (Supabase) is in progress.

## Roles & login

- **Landlord:** username `landlord`, password `123456`
- **Tenant:** logs in with their phone number; the initial password is their
  full phone number (changeable after login).

## Routes

- `/login` — login (landlord / tenant tabs)
- `/landlord` — landlord dashboard
- `/tenant` — tenant portal

## Project structure

```
src/
  main.jsx                 App entry
  App.jsx                  Routes + ErrorBoundary + AppProvider
  context/AppContext.jsx   All state + business logic
  pages/
    Login.jsx
    LandlordDashboard.jsx
    TenantDashboard.jsx
  index.css                Global theme (dark glassmorphism)
```

## Develop

```bash
npm install
npm run dev      # start dev server
npm run build    # production build
npm run preview  # preview the build
```

## Deploy

Hosted on Vercel. Pushing to the connected GitHub repository triggers an
automatic deployment.
