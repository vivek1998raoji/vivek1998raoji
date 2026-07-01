// ======================================================================
//  Supabase data-access layer.
//
//  This is the single module the app talks to for the *real* shared
//  backend. It mirrors every action in AppContext, but reads/writes
//  Postgres (via Supabase) instead of localStorage, and maps between the
//  DB's snake_case columns and the app's camelCase fields.
//
//  It is intentionally decoupled from React so it can be unit-tested and
//  reused. AppContext switches to this layer when `isSupabaseConfigured`
//  is true (see BACKEND.md for the wiring steps + activation checklist).
//
//  NOTE: nothing here runs until a real Supabase project + schema exist.
//  Until then AppContext keeps using localStorage, so the app never breaks.
// ======================================================================
import { supabase, isSupabaseConfigured } from './supabaseClient';

export { isSupabaseConfigured };

// ---------- Row <-> app-object mappers -------------------------------

const mapBuildingRow = (r) => ({ id: r.id, name: r.name, electricityRate: Number(r.electricity_rate) });
const toBuildingRow = (b) => ({ name: b.name, electricity_rate: Number(b.electricityRate) });

const mapRoomRow = (r) => ({
  id: r.id, buildingId: r.building_id, roomNumber: r.room_number,
  rentAmount: Number(r.rent_amount), hasKitchen: !!r.has_kitchen,
  status: r.status, currentMeterReading: Number(r.current_meter_reading),
});
const toRoomRow = (r) => ({
  building_id: r.buildingId, room_number: r.roomNumber, rent_amount: Number(r.rentAmount),
  has_kitchen: !!r.hasKitchen, status: r.status, current_meter_reading: Number(r.currentMeterReading) || 0,
});

const mapTenantRow = (t) => ({
  id: t.id, authUserId: t.auth_user_id, roomId: t.room_id, name: t.name,
  fatherName: t.father_name, phone: t.phone, whatsapp: t.whatsapp, notes: t.notes,
  joinDate: t.join_date, leaveDate: t.leave_date, isActive: !!t.is_active,
  balancePending: Number(t.balance_pending), docs: t.docs || [],
});
const toTenantRow = (t) => ({
  room_id: t.roomId, name: t.name, father_name: t.fatherName, phone: t.phone,
  whatsapp: t.whatsapp, notes: t.notes, join_date: t.joinDate || null,
  leave_date: t.leaveDate || null, is_active: t.isActive, balance_pending: Number(t.balancePending) || 0,
});

const mapInvoiceRow = (i) => ({
  id: i.id, tenantId: i.tenant_id, roomId: i.room_id, month: i.month, year: i.year,
  baseRent: Number(i.base_rent), previousMeter: Number(i.previous_meter), currentMeter: Number(i.current_meter),
  unitsUsed: Number(i.units_used), electricityBill: Number(i.electricity_bill), waterBill: Number(i.water_bill),
  otherCharges: Number(i.other_charges), previousPending: Number(i.previous_pending), totalAmount: Number(i.total_amount),
  amountPaid: Number(i.amount_paid), previousPendingCarry: Number(i.previous_pending_carry), status: i.status,
  paymentMethod: i.payment_method, requestedAmount: i.requested_amount != null ? Number(i.requested_amount) : undefined,
  paymentScreenshot: i.payment_screenshot, isFinalBill: !!i.is_final_bill,
  createdAt: i.created_at, dueDate: i.due_date, payments: i.payments || [],
});
const toInvoiceRow = (i) => ({
  tenant_id: i.tenantId, room_id: i.roomId, month: i.month, year: i.year,
  base_rent: i.baseRent, previous_meter: i.previousMeter, current_meter: i.currentMeter,
  units_used: i.unitsUsed, electricity_bill: i.electricityBill, water_bill: i.waterBill,
  other_charges: i.otherCharges, previous_pending: i.previousPending, total_amount: i.totalAmount,
  amount_paid: i.amountPaid, previous_pending_carry: i.previousPendingCarry, status: i.status,
  payment_method: i.paymentMethod, requested_amount: i.requestedAmount ?? null,
  payment_screenshot: i.paymentScreenshot ?? null, is_final_bill: !!i.isFinalBill,
  due_date: i.dueDate || null, payments: i.payments || [],
});

const mapMaintRow = (m) => ({
  id: m.id, tenantId: m.tenant_id, roomId: m.room_id, description: m.description,
  status: m.status, createdAt: m.created_at,
});

// ---------- Auth -----------------------------------------------------

// Tenants log in with a phone number; we derive a synthetic email so the
// same Supabase Auth (email+password) can back both roles.
export const phoneToEmail = (phone) => `${String(phone).replace(/\D/g, '')}@tenant.rentcms.local`;

export async function signInLandlord(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  return { user: data.user };
}

export async function signInTenant(phone, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: phoneToEmail(phone), password });
  if (error) return { error: error.message };
  return { user: data.user };
}

export async function signOut() {
  await supabase.auth.signOut();
}

export async function getRole() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  return data?.role || null;
}

// ---------- Storage --------------------------------------------------

// Upload a File to a private bucket and return its storage path. Reading it
// back later uses createSignedUrl (docs) so files stay private.
export async function uploadFile(bucket, path, file) {
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
  if (error) return { error: error.message };
  return { path };
}

export async function signedUrl(bucket, path, expiresIn = 3600) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) return null;
  return data?.signedUrl || null;
}

// ---------- Bulk load (landlord dashboard) ---------------------------

export async function loadAll() {
  const [b, r, t, i, m] = await Promise.all([
    supabase.from('buildings').select('*').order('created_at'),
    supabase.from('rooms').select('*').order('created_at'),
    supabase.from('tenants').select('*').order('created_at'),
    supabase.from('invoices').select('*').order('created_at'),
    supabase.from('maintenance_requests').select('*').order('created_at', { ascending: false }),
  ]);
  return {
    buildings: (b.data || []).map(mapBuildingRow),
    rooms: (r.data || []).map(mapRoomRow),
    tenants: (t.data || []).map(mapTenantRow),
    invoices: (i.data || []).map(mapInvoiceRow),
    maintenanceRequests: (m.data || []).map(mapMaintRow),
  };
}

// ---------- CRUD (return the mapped, inserted/updated object) --------

const insert = async (table, row, mapRow) => {
  const { data, error } = await supabase.from(table).insert(row).select().single();
  if (error) return { error: error.message };
  return { data: mapRow(data) };
};
const update = async (table, id, row, mapRow) => {
  const { data, error } = await supabase.from(table).update(row).eq('id', id).select().single();
  if (error) return { error: error.message };
  return { data: mapRow(data) };
};
const remove = async (table, id) => {
  const { error } = await supabase.from(table).delete().eq('id', id);
  return error ? { error: error.message } : {};
};

export const addBuilding = (b) => insert('buildings', toBuildingRow(b), mapBuildingRow);
export const updateBuilding = (id, patch) => update('buildings', id, toBuildingRow(patch), mapBuildingRow);

export const addRoom = (r) => insert('rooms', toRoomRow({ ...r, status: 'vacant' }), mapRoomRow);
export const updateRoom = (id, patch) => update('rooms', id, toRoomRow(patch), mapRoomRow);

export const addTenant = (t) => insert('tenants', toTenantRow(t), mapTenantRow);
export const updateTenant = (id, patch) => update('tenants', id, toTenantRow(patch), mapTenantRow);

export const addInvoice = (i) => insert('invoices', toInvoiceRow(i), mapInvoiceRow);
export const updateInvoiceRow = (id, patch) => update('invoices', id, toInvoiceRow(patch), mapInvoiceRow);
export const deleteInvoice = (id) => remove('invoices', id);

export const addMaintenance = (m) =>
  insert('maintenance_requests', { tenant_id: m.tenantId, room_id: m.roomId, description: m.description, status: 'open' }, mapMaintRow);
export const updateMaintenance = (id, status) => update('maintenance_requests', id, { status }, mapMaintRow);

// Provision a tenant auth account via the Edge Function (keeps the service
// key server-side). Returns { authUserId } to link onto the tenant row.
export async function provisionTenantAccount(phone, password) {
  const { data, error } = await supabase.functions.invoke('create-tenant', {
    body: { email: phoneToEmail(phone), password },
  });
  if (error) return { error: error.message };
  return { authUserId: data?.user?.id };
}
