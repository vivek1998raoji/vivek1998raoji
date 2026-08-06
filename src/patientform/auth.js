// ======================================================================
// Minimal doctor-side login for the intake dashboard.
//
// This gate only protects the doctor DASHBOARD in the browser; the patient
// form itself is public (that is the whole point — patients open it from a
// shared link without any account). Credentials can be overridden with Vite
// env vars; otherwise sensible defaults are used for a demo.
//
// NOTE: for real patient data, pair this with Supabase Auth + Row Level
// Security so submissions aren't readable with just the anon key. See
// PATIENT_FORM.md for the hardening checklist.
// ======================================================================

const SESSION_KEY = 'pcm_doctor_session';

const DOCTOR_USER = import.meta.env.VITE_DOCTOR_USER || 'doctor';
const DOCTOR_PASS = import.meta.env.VITE_DOCTOR_PASS || 'clinic123';

export function login(username, password) {
  const ok =
    String(username).trim() === DOCTOR_USER && String(password) === DOCTOR_PASS;
  if (ok) localStorage.setItem(SESSION_KEY, '1');
  return ok;
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
}

export function isLoggedIn() {
  return localStorage.getItem(SESSION_KEY) === '1';
}
