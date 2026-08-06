# Patient Intake — Cold & Flu Symptom Form

A digital version of the Quantum ProCytronics MediClinic paper symptom
checklist. The doctor shares one link; patients open it on their phone, tick
their symptoms and fill their details, and every submission shows up on a
doctor-only dashboard, patient by patient.

> This module is **self-contained** and lives entirely under
> `src/patientform/`. It does not touch or depend on the other app in this
> repo — it only registers its own routes in `src/App.jsx`.

## The flow

1. **Doctor** opens `/clinic/login` and signs in, then copies the **patient
   form link** (`/intake`) from the dashboard.
2. **Patient** opens that link, ticks the symptoms they have, fills their
   name / age / etc., and presses **Submit to Clinic**.
3. **Doctor** sees the new submission on the dashboard (`/clinic`), can search
   it, open it to read every ticked symptom, print it, or delete it.

## Routes

| Route            | Who        | What                                            |
| ---------------- | ---------- | ----------------------------------------------- |
| `/intake`        | Patient    | Public symptom form (this is the shared link)   |
| `/clinic/login`  | Doctor     | Doctor login                                    |
| `/clinic`        | Doctor     | Dashboard: patient-wise submissions + detail    |

## Doctor login

Defaults (override with env vars — see below):

- **Username:** `doctor`
- **Password:** `clinic123`

Set `VITE_DOCTOR_USER` and `VITE_DOCTOR_PASS` to change them.

## Data storage

Like the rest of this repo, storage auto-detects Supabase:

- **Supabase configured** (env vars present) → submissions are saved to a
  shared Postgres table, so a patient submitting on their phone appears on the
  doctor's dashboard on a different device. **This is required for the real
  "send a link" flow.**
- **Not configured** → falls back to the browser's `localStorage` so you can
  demo the whole thing on a single device. The dashboard shows a yellow
  "Demo mode" banner in this case.

### Enabling the shared backend (Supabase)

1. Create a free Supabase project.
2. SQL Editor → run [`supabase/patient_intake.sql`](supabase/patient_intake.sql).
   (Independent of the other `schema.sql` in this repo.)
3. Put the project URL + anon key in `.env` and in your host's env vars:
   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```
4. Redeploy. The dashboard's "Demo mode" banner disappears once it's live.

## Hardening for real patient data

The starter SQL lets the browser (anon) key read submissions so the demo works
without a login backend. Patient symptom data is sensitive — before using this
for real patients you should:

- Keep only the **INSERT** policy for the `anon` role (patients submitting).
- Move **SELECT / DELETE** behind Supabase Auth (`authenticated` role) and log
  the doctor in with a real Supabase account instead of the local password
  gate in `src/patientform/auth.js`.
- Serve the site over HTTPS (Vercel does this automatically).

Comments in `supabase/patient_intake.sql` mark exactly which policies to
change.

## Where things live

```
src/patientform/
  formSchema.js       The digitalized form (sections, symptoms, clinic header)
  store.js            Save/list/delete — Supabase with localStorage fallback
  auth.js             Doctor login gate (browser-side)
  PatientForm.jsx     Public patient form  (/intake)
  DoctorLogin.jsx     Doctor login         (/clinic/login)
  DoctorDashboard.jsx Doctor dashboard     (/clinic)
  patientform.css     Styles scoped to this module (pf- prefix)
supabase/
  patient_intake.sql  The patient_submissions table + RLS policies
```

## Extending the form

The paper form is 8 pages; this digitalizes page 1 (the symptom checklist). To
add more symptoms or sections, edit the `SECTIONS` array in
`src/patientform/formSchema.js` — the patient form and the doctor dashboard
both render from it, so a new item appears in both places automatically. No
database change is needed (symptoms are stored as JSON).
