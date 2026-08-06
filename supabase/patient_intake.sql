-- ======================================================================
-- Patient Intake (Cold & Flu symptom form) — database schema.
--
-- Run this in the Supabase SQL Editor (Project -> SQL Editor -> New query).
-- It is INDEPENDENT of schema.sql (the rent-management tables) and only adds
-- the single table the patient-intake module needs.
-- ======================================================================

create extension if not exists "pgcrypto";

create table if not exists public.patient_submissions (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),

  -- Patient-entered identity / visit fields
  encounter_id text,
  patient_id   text,
  name         text,
  age          text,
  sex          text,
  visit_date   text,
  visit_time   text,
  complaint    text,

  -- Structured answers (keys match ids in src/patientform/formSchema.js)
  history      jsonb not null default '{}'::jsonb,  -- { travel: 'yes'|'no', substance: ... }
  symptoms     jsonb not null default '{}'::jsonb,  -- { <symptomId>: true }
  others       jsonb not null default '{}'::jsonb   -- { <sectionId>: 'free text' }
);

create index if not exists patient_submissions_created_idx
  on public.patient_submissions (created_at desc);

-- ----------------------------------------------------------------------
-- Row Level Security
--
-- The patient form is public: anyone with the link may INSERT a submission.
-- Reading/deleting is what the doctor dashboard does.
--
-- IMPORTANT SECURITY NOTE:
-- The two policies below allow the anon (browser) key to READ and DELETE
-- submissions. That is the simplest setup and makes the demo work end-to-end,
-- but it means anyone who has the anon key could read patient data. For real
-- patient records you should instead:
--   * keep only the INSERT policy for `anon`, and
--   * gate SELECT/DELETE behind Supabase Auth (role = 'authenticated'),
--     logging the doctor in with a real Supabase account.
-- See PATIENT_FORM.md ("Hardening for real patient data").
-- ----------------------------------------------------------------------
alter table public.patient_submissions enable row level security;

-- Patients (anon) can submit the form.
drop policy if exists "anon can insert submissions" on public.patient_submissions;
create policy "anon can insert submissions"
  on public.patient_submissions for insert
  to anon
  with check (true);

-- Demo convenience: anon can read + delete (see security note above).
drop policy if exists "anon can read submissions" on public.patient_submissions;
create policy "anon can read submissions"
  on public.patient_submissions for select
  to anon
  using (true);

drop policy if exists "anon can delete submissions" on public.patient_submissions;
create policy "anon can delete submissions"
  on public.patient_submissions for delete
  to anon
  using (true);
