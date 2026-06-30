-- ======================================================================
--  Rent Management CMS — Supabase schema
--  Run this in your Supabase project: SQL Editor -> New query -> paste -> Run.
--  Safe to re-run (drops & recreates policies).
-- ======================================================================

-- ---------- Profiles: link an auth user to a role --------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'landlord' check (role in ('landlord','tenant')),
  created_at timestamptz not null default now()
);

-- Helper: is the current auth user a landlord?
create or replace function public.is_landlord()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'landlord');
$$;

-- ---------- Core tables ----------------------------------------------
create table if not exists public.buildings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  electricity_rate numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  building_id uuid not null references public.buildings(id) on delete cascade,
  room_number text not null,
  rent_amount numeric not null default 0,
  has_kitchen boolean not null default false,
  status text not null default 'vacant' check (status in ('vacant','occupied')),
  current_meter_reading numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null, -- the tenant's login
  room_id uuid references public.rooms(id) on delete set null,
  name text not null,
  father_name text,
  phone text not null,
  whatsapp text,
  notes text,
  join_date date,
  leave_date date,
  is_active boolean not null default true,
  balance_pending numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  month text,
  year int,
  base_rent numeric not null default 0,
  previous_meter numeric not null default 0,
  current_meter numeric not null default 0,
  units_used numeric not null default 0,
  electricity_bill numeric not null default 0,
  water_bill numeric not null default 0,
  other_charges numeric not null default 0,
  previous_pending numeric not null default 0,
  total_amount numeric not null default 0,
  amount_paid numeric not null default 0,
  previous_pending_carry numeric not null default 0,
  status text not null default 'pending'
    check (status in ('pending','payment_requested','partially_paid','paid','rolled_over')),
  payment_method text,
  requested_amount numeric,
  payment_screenshot text,
  is_final_bill boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  description text not null,
  status text not null default 'open' check (status in ('open','in_progress','resolved')),
  created_at timestamptz not null default now()
);

-- ---------- Row Level Security ---------------------------------------
alter table public.profiles enable row level security;
alter table public.buildings enable row level security;
alter table public.rooms enable row level security;
alter table public.tenants enable row level security;
alter table public.invoices enable row level security;
alter table public.maintenance_requests enable row level security;

-- profiles: a user can read/insert their own profile row.
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- Landlord: full control of everything they own.
-- Tenant: read the building/room they live in; read & update (payment
-- requests, profile, maintenance) their own tenant + invoices.

drop policy if exists buildings_rw on public.buildings;
create policy buildings_rw on public.buildings for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists buildings_tenant_read on public.buildings;
create policy buildings_tenant_read on public.buildings for select
  using (exists (
    select 1 from public.rooms r join public.tenants t on t.room_id = r.id
    where r.building_id = buildings.id and t.auth_user_id = auth.uid()
  ));

drop policy if exists rooms_rw on public.rooms;
create policy rooms_rw on public.rooms for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists rooms_tenant_read on public.rooms;
create policy rooms_tenant_read on public.rooms for select
  using (exists (
    select 1 from public.tenants t where t.room_id = rooms.id and t.auth_user_id = auth.uid()
  ));

drop policy if exists tenants_landlord_rw on public.tenants;
create policy tenants_landlord_rw on public.tenants for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists tenants_self on public.tenants;
create policy tenants_self on public.tenants for select
  using (auth_user_id = auth.uid());

drop policy if exists tenants_self_update on public.tenants;
create policy tenants_self_update on public.tenants for update
  using (auth_user_id = auth.uid());

drop policy if exists invoices_landlord_rw on public.invoices;
create policy invoices_landlord_rw on public.invoices for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists invoices_tenant_read on public.invoices;
create policy invoices_tenant_read on public.invoices for select
  using (exists (
    select 1 from public.tenants t where t.id = invoices.tenant_id and t.auth_user_id = auth.uid()
  ));

drop policy if exists invoices_tenant_update on public.invoices;
create policy invoices_tenant_update on public.invoices for update
  using (exists (
    select 1 from public.tenants t where t.id = invoices.tenant_id and t.auth_user_id = auth.uid()
  ));

drop policy if exists maint_landlord_rw on public.maintenance_requests;
create policy maint_landlord_rw on public.maintenance_requests for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists maint_tenant on public.maintenance_requests;
create policy maint_tenant on public.maintenance_requests for all
  using (exists (
    select 1 from public.tenants t where t.id = maintenance_requests.tenant_id and t.auth_user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.tenants t where t.id = maintenance_requests.tenant_id and t.auth_user_id = auth.uid()
  ));
