// ======================================================================
// Storage layer for patient intake submissions.
//
// Mirrors the pattern already used in this repo: if Supabase env vars are
// present we use the shared Postgres backend (so a patient on their phone and
// the doctor on a laptop see the same data); otherwise we fall back to the
// browser's localStorage so the app still runs for a local demo on one device.
//
// Cross-device use (doctor sends a link, patient fills on their own phone)
// REQUIRES Supabase to be configured — see PATIENT_FORM.md.
// ======================================================================

import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const LS_KEY = 'pcm_submissions_v1';
const TABLE = 'patient_submissions';

// ---- localStorage helpers -------------------------------------------------

function lsReadAll() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function lsWriteAll(list) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

// A small, dependency-free unique id for localStorage rows.
function localId() {
  return 'loc_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ---- Supabase row <-> app object mappers ---------------------------------

// DB row (snake_case columns + jsonb) -> the shape the UI works with.
function fromRow(row) {
  return {
    id: row.id,
    createdAt: row.created_at,
    encounterId: row.encounter_id || '',
    patientId: row.patient_id || '',
    name: row.name || '',
    age: row.age || '',
    sex: row.sex || '',
    visitDate: row.visit_date || '',
    visitTime: row.visit_time || '',
    complaint: row.complaint || '',
    history: row.history || {},
    symptoms: row.symptoms || {},
    others: row.others || {},
  };
}

// UI object -> DB row for insert.
function toRow(sub) {
  return {
    encounter_id: sub.encounterId || null,
    patient_id: sub.patientId || null,
    name: sub.name || null,
    age: sub.age || null,
    sex: sub.sex || null,
    visit_date: sub.visitDate || null,
    visit_time: sub.visitTime || null,
    complaint: sub.complaint || null,
    history: sub.history || {},
    symptoms: sub.symptoms || {},
    others: sub.others || {},
  };
}

// ---- Public API -----------------------------------------------------------

export { isSupabaseConfigured };

// Save a new patient submission. Returns the saved record.
export async function saveSubmission(sub) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(toRow(sub))
      .select()
      .single();
    if (error) throw new Error(error.message);
    return fromRow(data);
  }

  // localStorage fallback
  const record = {
    ...sub,
    id: localId(),
    createdAt: new Date().toISOString(),
  };
  const all = lsReadAll();
  all.unshift(record);
  lsWriteAll(all);
  return record;
}

// List all submissions, newest first.
export async function listSubmissions() {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map(fromRow);
  }
  return lsReadAll();
}

// Delete a submission by id (used by the doctor dashboard).
export async function deleteSubmission(id) {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw new Error(error.message);
    return;
  }
  lsWriteAll(lsReadAll().filter((r) => r.id !== id));
}
