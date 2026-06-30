# Rent Management CMS

A web app for landlords to manage buildings, rooms, tenants, and monthly
rent + electricity invoices, with a separate tenant portal for viewing bills
and submitting payments.

**Live:** https://rental-management-cms.vercel.app/

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
