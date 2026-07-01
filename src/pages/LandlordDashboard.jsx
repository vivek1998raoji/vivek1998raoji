import React, { useState, useContext } from 'react';
import { Home, Users, DollarSign, Bell, LogOut, CheckCircle, Plus, FileText, ClipboardList, PenSquare, MessageCircle, Printer, Trash2, Ban, Search, Wrench, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { MONTHS, formatMoney, formatDate, currentMonthName, currentYear, daysBetween, statusLabel } from '../lib/format';
import { openInvoicePrint } from '../lib/invoiceDoc';
import { buildBillMessage, waLink } from '../lib/whatsapp';
import { toCSV, downloadCSV } from '../lib/csv';
import { fileToDownscaledDataUrl } from '../lib/image';

// Shared colours (accessible on a white background)
const GREEN = '#15803D';
const RED = '#DC2626';
const AMBER = '#B45309';
const BLUE = '#2563EB';
const ALT = 'var(--surface-alt)';

function LandlordDashboard() {
  const navigate = useNavigate();
  const context = useContext(AppContext);

  const [activeTab, setActiveTab] = useState('overview');

  // Form States
  const [bForm, setBForm] = useState({ name: '', electricityRate: '' });
  const [rForm, setRForm] = useState({ buildingId: '', roomNumber: '', rentAmount: '', hasKitchen: false, currentMeterReading: '' });
  const [tForm, setTForm] = useState({ roomId: '', name: '', fatherName: '', phone: '', whatsapp: '', notes: '', joinDate: new Date().toISOString().split('T')[0] });
  const [tDocs, setTDocs] = useState([]);
  const [invForm, setInvForm] = useState({ roomId: '', currentMeter: '', waterBill: '', otherCharges: '', month: currentMonthName(), year: new Date().getFullYear() });

  // Modal State
  const [editingBuilding, setEditingBuilding] = useState(null);
  const [editingRoom, setEditingRoom] = useState(null);
  const [editingTenant, setEditingTenant] = useState(null);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [deactivatingTenant, setDeactivatingTenant] = useState(null);
  const [historyTenant, setHistoryTenant] = useState(null);
  const [deactivateForm, setDeactivateForm] = useState({ leaveDate: new Date().toISOString().split('T')[0], finalMeter: '', additionalCharges: '' });

  // Search / filter State
  const [tenantSearch, setTenantSearch] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  if (!context) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}><h2>Loading… Please refresh.</h2></div>;
  }

  const { currentUser, logout, addBuilding, updateBuilding, addRoom, updateRoom, addTenant, updateTenant, deactivateTenant, generateInvoice, acceptPayment, updateInvoice, voidInvoice, deleteInvoice, maintenanceRequests, updateMaintenanceRequest } = context;
  const buildings = (Array.isArray(context.buildings) ? context.buildings : []).filter(Boolean);
  const rooms = (Array.isArray(context.rooms) ? context.rooms : []).filter(Boolean);
  const tenants = (Array.isArray(context.tenants) ? context.tenants : []).filter(Boolean);
  const invoices = (Array.isArray(context.invoices) ? context.invoices : []).filter(Boolean);
  const maintenance = (Array.isArray(maintenanceRequests) ? maintenanceRequests : []).filter(Boolean);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  let fallbackUser = null;
  try {
    const localUser = localStorage.getItem('currentUser');
    if (localUser && localUser !== 'null' && localUser !== 'undefined') {
       fallbackUser = JSON.parse(localUser);
    }
  } catch(e) {}

  const activeUser = currentUser || fallbackUser;

  if (!activeUser || activeUser?.role !== 'landlord') {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Please sign in again</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Your session has ended. Sign in from the main page to continue.</p>
        <button className="btn btn-primary" onClick={() => navigate('/login')}>Go to Sign In</button>
      </div>
    );
  }

  // --- Helpers ---
  const buildingFor = (roomId) => {
    const r = rooms.find(rm => rm.id === roomId);
    return buildings.find(b => b.id === r?.buildingId);
  };
  const isThisMonth = (iso) => {
    if (!iso) return false;
    const d = new Date(iso);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  };
  const openWhatsApp = (invoice, tenant) => {
    const room = rooms.find(r => r.id === invoice.roomId);
    const msg = buildBillMessage(invoice, tenant, room, buildingFor(invoice.roomId));
    window.open(waLink(tenant?.whatsapp || tenant?.phone, msg), '_blank');
  };
  const printInvoice = (invoice) => {
    const tenant = tenants.find(t => t.id === invoice.tenantId);
    const room = rooms.find(r => r.id === invoice.roomId);
    openInvoicePrint(invoice, tenant, room, buildingFor(invoice.roomId), 'Owner');
  };
  const badgeClass = (s) => s === 'paid' ? 'badge-success' : s === 'partially_paid' ? 'badge-warning' : (s === 'rolled_over' || s === 'void') ? 'badge' : 'badge-danger';

  // --- Summary Calculations ---
  const totalBuildings = buildings.length;
  const totalRooms = rooms.length;
  const vacantRooms = rooms.filter(r => r.status === 'vacant').length;

  const partialInvoices = invoices.filter(i => i.status === 'partially_paid').length;
  const fullyPaidInvoices = invoices.filter(i => i.status === 'paid').length;

  const totalReceived = invoices.reduce((acc, curr) => acc + (Number(curr.amountPaid) || 0), 0);
  const pendingInvoices = invoices.filter(i => i.status === 'pending' || i.status === 'partially_paid');
  const totalPending = pendingInvoices.reduce((acc, curr) => acc + (Number(curr.previousPendingCarry) || 0), 0);

  const collectedThisMonth = invoices
    .flatMap(i => i.payments || [])
    .filter(p => isThisMonth(p.date))
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const overdueInvoices = pendingInvoices.filter(i => i.dueDate && daysBetween(i.dueDate) > 0);

  const nowMonthName = currentMonthName();
  const nowYear = currentYear();
  const tenantsDueForBilling = tenants.filter(t => {
    if (!t.isActive || !t.joinDate) return false;
    const joined = new Date(t.joinDate);
    const today = new Date();
    if (joined.getMonth() === today.getMonth() && joined.getFullYear() === today.getFullYear()) return false;
    const hasCurrentInvoice = invoices.some(i =>
      i.tenantId === t.id && i.month === nowMonthName && Number(i.year) === nowYear && i.status !== 'void'
    );
    return !hasCurrentInvoice;
  });

  const exportInvoicesCSV = () => {
    const rows = invoices.map(inv => {
      const t = tenants.find(x => x.id === inv.tenantId);
      const r = rooms.find(x => x.id === inv.roomId);
      return { inv, t, r };
    });
    const csv = toCSV(rows, [
      { label: 'Month', value: ({ inv }) => inv.month },
      { label: 'Year', value: ({ inv }) => inv.year },
      { label: 'Tenant', value: ({ t }) => t?.name || '' },
      { label: 'Room', value: ({ r }) => r?.roomNumber || '' },
      { label: 'Total', value: ({ inv }) => Number(inv.totalAmount || 0).toFixed(2) },
      { label: 'Paid', value: ({ inv }) => Number(inv.amountPaid || 0).toFixed(2) },
      { label: 'Balance', value: ({ inv }) => Number(inv.previousPendingCarry || 0).toFixed(2) },
      { label: 'Status', value: ({ inv }) => statusLabel(inv.status) },
      { label: 'Issued', value: ({ inv }) => inv.createdAt || '' },
      { label: 'Due', value: ({ inv }) => inv.dueDate || '' },
    ]);
    downloadCSV(`bills-${new Date().toISOString().split('T')[0]}.csv`, csv);
  };

  const StatCard = ({ label, value, color }) => (
    <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <h3 style={{ color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 600 }}>{label}</h3>
      <h2 style={{ fontSize: '2.1rem', color: color || 'var(--text-main)' }}>{value}</h2>
    </div>
  );

  const renderOverview = () => (
    <div className="fade-in">
      <h2 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '2rem' }}>Home</h2>

      {tenantsDueForBilling.length > 0 && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '1.5rem', borderRadius: '16px', marginBottom: '1.5rem' }}>
          <h3 style={{ color: RED, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bell size={22} /> {tenantsDueForBilling.length} tenant(s) need a bill for {nowMonthName} {nowYear}
          </h3>
          <ul style={{ marginTop: '0.5rem', listStyle: 'none', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {tenantsDueForBilling.map(t => (
              <li key={t.id} style={{ background: ALT, padding: '0.5rem 1rem', borderRadius: '10px', fontSize: '1rem' }}>
                <strong>{t.name}</strong> (Room {rooms.find(r=>r.id===t.roomId)?.roomNumber}) <span style={{color: BLUE}}>joined {formatDate(t.joinDate)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {overdueInvoices.length > 0 && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', padding: '1.25rem 1.5rem', borderRadius: '16px', marginBottom: '1.5rem' }}>
          <h3 style={{ color: AMBER, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bell size={20} /> {overdueInvoices.length} bill(s) are past their due date
          </h3>
        </div>
      )}

      <div className="stat-grid" style={{ marginBottom: '1.5rem' }}>
        <StatCard label="Collected This Month" value={formatMoney(collectedThisMonth)} color={GREEN} />
        <StatCard label="Received (All Time)" value={formatMoney(totalReceived)} color={GREEN} />
        <StatCard label="Money Still Owed" value={formatMoney(totalPending)} color={RED} />
        <StatCard label="Late Bills" value={overdueInvoices.length} color={AMBER} />
      </div>

      <div className="stat-grid" style={{ marginBottom: '1.5rem' }}>
        <StatCard label="Bills Fully Paid" value={fullyPaidInvoices} color={GREEN} />
        <StatCard label="Bills Part Paid" value={partialInvoices} color={AMBER} />
        <StatCard label="Open Repairs" value={maintenance.filter(m => m.status !== 'resolved').length} color={BLUE} />
      </div>

      <div className="stat-grid">
        <StatCard label="Buildings" value={totalBuildings} />
        <StatCard label="Rooms" value={totalRooms} />
        <StatCard label="Empty Rooms" value={vacantRooms} color={BLUE} />
      </div>
    </div>
  );

  const renderBuildingsAndRooms = () => (
    <div className="fade-in">
      <h2 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '2rem' }}>Buildings & Rooms</h2>

      <div className="two-col">
        {/* Buildings Form */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Add a Building</h3>
          <form onSubmit={e => { e.preventDefault(); addBuilding(bForm); setBForm({name:'', electricityRate:''}); }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input className="input-field" placeholder="Building name" value={bForm.name} onChange={e => setBForm({...bForm, name: e.target.value})} required />
            <input className="input-field" type="number" placeholder="Electricity rate per unit (₹)" value={bForm.electricityRate} onChange={e => setBForm({...bForm, electricityRate: e.target.value})} required />
            <button className="btn btn-primary" type="submit"><Plus size={20}/> Add Building</button>
          </form>

          <h4 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Your Buildings</h4>
          <ul style={{ listStyle: 'none' }}>
            {buildings.map(b => (
              <li key={b.id} style={{ padding: '0.85rem 1rem', background: ALT, marginBottom: '0.5rem', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                <div>{b.name} <span style={{color: GREEN, fontWeight: 600}}>(₹{b.electricityRate}/unit)</span></div>
                <button className="btn btn-secondary" style={{padding: '0.5rem 0.85rem', minHeight: 'auto', fontSize: '0.95rem'}} onClick={() => setEditingBuilding(b)}><PenSquare size={16}/> Edit</button>
              </li>
            ))}
          </ul>
        </div>

        {/* Rooms Form */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Add a Room</h3>
          <form onSubmit={e => { e.preventDefault(); addRoom(rForm); setRForm({buildingId:'', roomNumber:'', rentAmount:'', hasKitchen:false, currentMeterReading:''}); }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <select className="input-field" value={rForm.buildingId} onChange={e => setRForm({...rForm, buildingId: e.target.value})} required style={{background: 'var(--bg-card)'}}>
              <option value="">Choose building</option>
              {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <input className="input-field" placeholder="Room number" value={rForm.roomNumber} onChange={e => setRForm({...rForm, roomNumber: e.target.value})} required />
            <input className="input-field" type="number" placeholder="Monthly rent (₹)" value={rForm.rentAmount} onChange={e => setRForm({...rForm, rentAmount: e.target.value})} required />
            <input className="input-field" type="number" placeholder="Starting meter reading" value={rForm.currentMeterReading} onChange={e => setRForm({...rForm, currentMeterReading: e.target.value})} required />
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1.05rem' }}>
              <input type="checkbox" style={{ width: 22, height: 22 }} checked={rForm.hasKitchen} onChange={e => setRForm({...rForm, hasKitchen: e.target.checked})} />
              Has a kitchen
            </label>
            <button className="btn btn-primary" type="submit"><Plus size={20}/> Add Room</button>
          </form>

          <h4 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Your Rooms</h4>
          <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
            <ul style={{ listStyle: 'none' }}>
              {rooms.map(r => (
                <li key={r.id} style={{ padding: '0.85rem 1rem', background: ALT, marginBottom: '0.5rem', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                  <span>Room {r.roomNumber} ({r.hasKitchen?'Kitchen':'No kitchen'})</span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span className={`badge ${r.status === 'vacant' ? 'badge-success' : 'badge-warning'}`}>{r.status === 'vacant' ? 'Empty' : 'Occupied'}</span>
                    <button className="btn btn-secondary" style={{padding: '0.5rem 0.85rem', minHeight: 'auto', fontSize: '0.95rem'}} onClick={() => setEditingRoom(r)}><PenSquare size={16}/> Edit</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Edit Building Modal */}
      {editingBuilding && (
        <div className="modal-overlay">
          <div className="glass-panel fade-in modal-card" style={{ padding: '2.5rem' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>Edit Building</h2>
            <form onSubmit={e => { e.preventDefault(); updateBuilding(editingBuilding.id, editingBuilding); setEditingBuilding(null); alert('Building saved.'); }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="input-label">Building name</label>
                  <input className="input-field" value={editingBuilding.name} onChange={e => setEditingBuilding({...editingBuilding, name: e.target.value})} required/>
                </div>
                <div>
                  <label className="input-label">Electricity rate per unit (₹)</label>
                  <input type="number" className="input-field" value={editingBuilding.electricityRate} onChange={e => setEditingBuilding({...editingBuilding, electricityRate: e.target.value})} required/>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" style={{flex: 1}} onClick={() => setEditingBuilding(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{flex: 2}}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Room Modal */}
      {editingRoom && (
        <div className="modal-overlay">
          <div className="glass-panel fade-in modal-card" style={{ padding: '2.5rem' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>Edit Room</h2>
            <form onSubmit={e => { e.preventDefault(); updateRoom(editingRoom.id, editingRoom); setEditingRoom(null); alert('Room saved.'); }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="input-label">Building</label>
                  <select className="input-field" value={editingRoom.buildingId} onChange={e => setEditingRoom({...editingRoom, buildingId: e.target.value})} required style={{background: 'var(--bg-card)'}}>
                    {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">Room number</label>
                  <input className="input-field" value={editingRoom.roomNumber} onChange={e => setEditingRoom({...editingRoom, roomNumber: e.target.value})} required/>
                </div>
                <div>
                  <label className="input-label">Monthly rent (₹)</label>
                  <input type="number" className="input-field" value={editingRoom.rentAmount} onChange={e => setEditingRoom({...editingRoom, rentAmount: e.target.value})} required/>
                </div>
                <div>
                  <label className="input-label">Current meter reading</label>
                  <input type="number" className="input-field" value={editingRoom.currentMeterReading} onChange={e => setEditingRoom({...editingRoom, currentMeterReading: e.target.value})} required/>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1.05rem' }}>
                  <input type="checkbox" style={{ width: 22, height: 22 }} checked={editingRoom.hasKitchen} onChange={e => setEditingRoom({...editingRoom, hasKitchen: e.target.checked})} />
                  Has a kitchen
                </label>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" style={{flex: 1}} onClick={() => setEditingRoom(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{flex: 2}}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  const handleTenantSubmit = async (e) => {
    e.preventDefault();
    addTenant({ ...tForm, docs: tDocs });
    setTForm({roomId:'', name:'', fatherName:'', phone:'', whatsapp:'', notes:'', joinDate: new Date().toISOString().split('T')[0]});
    setTDocs([]);
    alert('Tenant added.');
  };

  const handleDocUpload = async (files) => {
    const list = Array.from(files || []);
    for (const f of list) {
      const doc = await fileToDownscaledDataUrl(f);
      if (doc) setTDocs(prev => [...prev, doc]);
    }
  };

  const visibleTenants = tenants.filter(t => t.isActive).filter(t => {
    if (!tenantSearch.trim()) return true;
    const q = tenantSearch.toLowerCase();
    const r = rooms.find(rm => rm.id === t.roomId);
    return (t.name || '').toLowerCase().includes(q) ||
           (t.phone || '').includes(q) ||
           (`room ${r?.roomNumber || ''}`).toLowerCase().includes(q);
  });

  const renderTenants = () => (
    <div className="fade-in">
      <h2 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '2rem' }}>Tenants</h2>
      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Add a New Tenant</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem', fontSize: '1rem' }}>The tenant's first password is their phone number. They can change it after signing in.</p>
        <form onSubmit={handleTenantSubmit} className="form-grid">

          <select className="input-field" value={tForm.roomId} onChange={e => setTForm({...tForm, roomId: e.target.value})} required style={{background: 'var(--bg-card)'}}>
            <option value="">Choose a room…</option>
            {rooms.map(r => <option key={r.id} value={r.id}>Room {r.roomNumber} ({buildings.find(b=>b.id===r.buildingId)?.name}) - {r.status === 'vacant' ? 'empty' : 'occupied'}</option>)}
          </select>
          <input className="input-field" placeholder="Full name" value={tForm.name} onChange={e => setTForm({...tForm, name: e.target.value})} required />
          <input className="input-field" placeholder="Father's name" value={tForm.fatherName} onChange={e => setTForm({...tForm, fatherName: e.target.value})} required />
          <input className="input-field" placeholder="Phone number" value={tForm.phone} onChange={e => setTForm({...tForm, phone: e.target.value})} required />
          <input className="input-field" placeholder="WhatsApp number" value={tForm.whatsapp} onChange={e => setTForm({...tForm, whatsapp: e.target.value})} required />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label className="input-label">Date moved in</label>
            <input type="date" className="input-field" value={tForm.joinDate} onChange={e => setTForm({...tForm, joinDate: e.target.value})} required />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', gridColumn: '1 / -1' }}>
            <label className="input-label">ID / document photos (optional)</label>
            <input type="file" accept="image/*" multiple className="input-field" style={{ padding: '0.6rem' }} onChange={e => handleDocUpload(e.target.files)} />
            {tDocs.length > 0 && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                {tDocs.map((d, i) => (
                  <span key={i} className="badge badge-success">
                    <FileText size={14}/> {d.name}
                    <button type="button" onClick={() => setTDocs(tDocs.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 700, fontSize: '1.1rem', lineHeight: 1 }}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <textarea className="input-field" placeholder="Notes (optional)…" value={tForm.notes} onChange={e => setTForm({...tForm, notes: e.target.value})} style={{ gridColumn: '1 / -1', minHeight: '90px' }}></textarea>

          <div style={{ gridColumn: '1 / -1', textAlign: 'right' }}>
            <button className="btn btn-primary" type="submit"><Plus size={20}/> Add Tenant</button>
          </div>
        </form>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <h3>Current Tenants</h3>
        <div style={{ position: 'relative', minWidth: '240px' }}>
          <Search size={18} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="input-field" placeholder="Search name / phone / room" value={tenantSearch} onChange={e => setTenantSearch(e.target.value)} style={{ paddingLeft: '2.5rem' }} />
        </div>
      </div>
      <div className="glass-panel table-wrap">
        <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)', background: ALT }}>
              <th style={{ padding: '1rem' }}>Name</th>
              <th style={{ padding: '1rem' }}>Room</th>
              <th style={{ padding: '1rem' }}>Phone</th>
              <th style={{ padding: '1rem' }}>Owes</th>
              <th style={{ padding: '1rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleTenants.map(t => {
              const r = rooms.find(rm => rm.id === t.roomId);
              const openInv = invoices.find(i => i.tenantId === t.id && (i.status === 'pending' || i.status === 'partially_paid'));
              return (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '1rem', fontWeight: 600 }}>{t.name}</td>
                  <td style={{ padding: '1rem' }}>Room {r?.roomNumber}</td>
                  <td style={{ padding: '1rem' }}>{t.phone}</td>
                  <td style={{ padding: '1rem', fontWeight: 700, color: Number(t.balancePending) > 0 ? RED : GREEN }}>{formatMoney(t.balancePending)}</td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary" style={{padding: '0.5rem 0.85rem', minHeight: 'auto', fontSize: '0.95rem'}} onClick={() => setHistoryTenant(t)}><FileText size={16}/> Bills</button>
                      <button className="btn btn-secondary" style={{padding: '0.5rem 0.85rem', minHeight: 'auto', fontSize: '0.95rem'}} onClick={() => setEditingTenant(t)}><PenSquare size={16}/> Edit</button>
                      {openInv && (
                        <button className="btn" style={{padding: '0.5rem 0.85rem', minHeight: 'auto', fontSize: '0.95rem', background: '#25D366', color: 'white'}} onClick={() => openWhatsApp(openInv, t)}><MessageCircle size={16}/> WhatsApp</button>
                      )}
                      <button className="btn" style={{padding: '0.5rem 0.85rem', minHeight: 'auto', fontSize: '0.95rem', background: '#FEE2E2', color: '#991B1B'}} onClick={() => {
                         setDeactivateForm({...deactivateForm, finalMeter: r?.currentMeterReading || ''});
                         setDeactivatingTenant(t);
                      }}><Ban size={16}/> Move Out</button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {visibleTenants.length === 0 && (
              <tr><td colSpan={5} style={{ padding: '1.5rem', color: 'var(--text-muted)', textAlign: 'center' }}>No matching tenants.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Tenant Modal */}
      {editingTenant && (
        <div className="modal-overlay">
          <div className="glass-panel fade-in modal-card" style={{ padding: '2.5rem' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>Edit Tenant</h2>
            <form onSubmit={e => { e.preventDefault(); updateTenant(editingTenant.id, editingTenant); setEditingTenant(null); alert('Tenant saved.'); }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="input-label">Full name</label>
                  <input className="input-field" value={editingTenant.name} onChange={e => setEditingTenant({...editingTenant, name: e.target.value})} required/>
                </div>
                <div>
                  <label className="input-label">Father's name</label>
                  <input className="input-field" value={editingTenant.fatherName} onChange={e => setEditingTenant({...editingTenant, fatherName: e.target.value})} required/>
                </div>
                <div>
                  <label className="input-label">Phone</label>
                  <input className="input-field" value={editingTenant.phone} onChange={e => setEditingTenant({...editingTenant, phone: e.target.value})} required/>
                </div>
                <div>
                  <label className="input-label">WhatsApp</label>
                  <input className="input-field" value={editingTenant.whatsapp} onChange={e => setEditingTenant({...editingTenant, whatsapp: e.target.value})} required/>
                </div>
                <div>
                  <label className="input-label">Notes</label>
                  <textarea className="input-field" value={editingTenant.notes} onChange={e => setEditingTenant({...editingTenant, notes: e.target.value})}></textarea>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" style={{flex: 1}} onClick={() => setEditingTenant(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{flex: 2}}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Move Out Modal */}
      {deactivatingTenant && (
        <div className="modal-overlay">
          <div className="glass-panel fade-in modal-card" style={{ padding: '2.5rem', border: '2px solid #FCA5A5' }}>
            <h2 style={{ marginBottom: '0.5rem', color: RED }}>Move Out Tenant</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '1rem' }}>This makes their final bill, empties Room {rooms.find(r=>r.id===deactivatingTenant.roomId)?.roomNumber}, and removes them from your current tenants.</p>
            <form onSubmit={e => {
                e.preventDefault();
                deactivateTenant(deactivatingTenant.id, deactivateForm.leaveDate, deactivateForm.finalMeter, deactivateForm.additionalCharges);
                setDeactivatingTenant(null);
                alert('Tenant moved out. Final bill created.');
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="input-label">Date leaving</label>
                  <input type="date" className="input-field" value={deactivateForm.leaveDate} onChange={e => setDeactivateForm({...deactivateForm, leaveDate: e.target.value})} required/>
                </div>
                <div>
                  <label className="input-label">Final meter reading</label>
                  <input type="number" className="input-field" value={deactivateForm.finalMeter} onChange={e => setDeactivateForm({...deactivateForm, finalMeter: e.target.value})} required/>
                </div>
                <div>
                  <label className="input-label">Extra charges, if any (₹)</label>
                  <input type="number" className="input-field" value={deactivateForm.additionalCharges} onChange={e => setDeactivateForm({...deactivateForm, additionalCharges: e.target.value})} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" style={{flex: 1}} onClick={() => setDeactivatingTenant(null)}>Cancel</button>
                <button type="submit" className="btn" style={{flex: 2, background: RED, color: 'white'}}>Confirm Move Out</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyTenant && (
        <div className="modal-overlay">
          <div className="glass-panel fade-in modal-card wide" style={{ padding: '2.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
               <h2 style={{ fontSize: '1.5rem' }}>Bills: {historyTenant.name}</h2>
               <button className="btn btn-secondary" style={{padding: '0.5rem 1rem', minHeight: 'auto'}} onClick={() => setHistoryTenant(null)}>Close</button>
            </div>

            {invoices.filter(i => i.tenantId === historyTenant.id).length === 0 ? (
               <p style={{color: 'var(--text-muted)'}}>No bills for this tenant yet.</p>
            ) : (
               <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                 <thead>
                   <tr style={{ borderBottom: '2px solid var(--border)' }}>
                     <th style={{ padding: '0.75rem' }}>Month</th>
                     <th style={{ padding: '0.75rem' }}>Total</th>
                     <th style={{ padding: '0.75rem' }}>Paid</th>
                     <th style={{ padding: '0.75rem' }}>Status</th>
                   </tr>
                 </thead>
                 <tbody>
                   {invoices.filter(i => i.tenantId === historyTenant.id).map(inv => (
                     <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)' }}>
                       <td style={{ padding: '0.75rem' }}>{inv.isFinalBill ? 'Final Bill' : `${inv.month} ${inv.year}`}</td>
                       <td style={{ padding: '0.75rem' }}>{formatMoney(inv.totalAmount)}</td>
                       <td style={{ padding: '0.75rem', color: GREEN }}>{formatMoney(inv.amountPaid)}</td>
                       <td style={{ padding: '0.75rem' }}><span className={`badge ${badgeClass(inv.status)}`}>{statusLabel(inv.status)}</span></td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            )}

            {(!historyTenant.isActive) && (
               <div style={{ marginTop: '2rem', padding: '1rem', background: '#FEF2F2', borderRadius: '10px' }}>
                  <p style={{color: RED}}><strong>Moved out:</strong> left on {formatDate(historyTenant.leaveDate)}</p>
                  <p style={{marginTop: '0.5rem'}}>Still owes: {formatMoney(historyTenant.balancePending)}</p>
               </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const filteredInvoices = [...invoices].reverse().filter(inv => {
    if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
    if (!invoiceSearch.trim()) return true;
    const q = invoiceSearch.toLowerCase();
    const r = rooms.find(rm => rm.id === inv.roomId);
    const t = tenants.find(tn => tn.id === inv.tenantId);
    return (t?.name || '').toLowerCase().includes(q) ||
           (`room ${r?.roomNumber || ''}`).toLowerCase().includes(q) ||
           (inv.month || '').toLowerCase().includes(q);
  });

  const renderBillings = () => (
    <div className="fade-in">
      <h2 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '2rem' }}>Bills</h2>

      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Create a Bill</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem', fontSize: '1rem' }}>Water and other charges are optional.</p>

        <form onSubmit={e => {
            e.preventDefault();
            const res = generateInvoice(invForm.roomId, invForm.currentMeter, invForm.waterBill, invForm.otherCharges, invForm.month, invForm.year);
            if (res?.error) { alert(res.error); return; }
            alert('Bill created and ready for the tenant.');
            setInvForm({...invForm, currentMeter:'', waterBill:'', otherCharges:''});
          }} className="form-grid">

          <select className="input-field" value={invForm.roomId} onChange={e => setInvForm({...invForm, roomId: e.target.value})} required style={{background: 'var(--bg-card)'}}>
            <option value="">Choose an occupied room…</option>
            {rooms.filter(r => r.status === 'occupied').map(r => {
              const b = buildings.find(b=>b.id===r.buildingId);
              return <option key={r.id} value={r.id}>Room {r.roomNumber} ({b?.name}) - meter now: {r.currentMeterReading}</option>
            })}
          </select>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select className="input-field" value={invForm.month} onChange={e => setInvForm({...invForm, month: e.target.value})} required style={{background: 'var(--bg-card)'}}>
              {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <input className="input-field" type="number" placeholder="Year" value={invForm.year} onChange={e => setInvForm({...invForm, year: e.target.value})} required style={{width: '110px'}}/>
          </div>

          <input className="input-field" type="number" placeholder="New meter reading" value={invForm.currentMeter} onChange={e => setInvForm({...invForm, currentMeter: e.target.value})} required />
          <input className="input-field" type="number" placeholder="Water bill (₹) — optional" value={invForm.waterBill} onChange={e => setInvForm({...invForm, waterBill: e.target.value})} />
          <input className="input-field" type="number" placeholder="Other charges (₹) — optional" value={invForm.otherCharges} onChange={e => setInvForm({...invForm, otherCharges: e.target.value})} />

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
             <button className="btn btn-primary" type="submit" disabled={!invForm.roomId}><FileText size={20}/> Create Bill</button>
          </div>
        </form>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <h3>All Bills</h3>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input className="input-field" placeholder="Search tenant / room / month" value={invoiceSearch} onChange={e => setInvoiceSearch(e.target.value)} style={{ paddingLeft: '2.5rem', minWidth: '230px' }} />
          </div>
          <select className="input-field" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ background: 'var(--bg-card)', width: 'auto' }}>
            <option value="all">All bills</option>
            <option value="pending">Not paid</option>
            <option value="payment_requested">Payment claimed</option>
            <option value="partially_paid">Part paid</option>
            <option value="paid">Paid</option>
            <option value="rolled_over">Moved to new bill</option>
            <option value="void">Cancelled</option>
          </select>
          <button className="btn btn-secondary" onClick={exportInvoicesCSV}><Download size={18}/> Export</button>
        </div>
      </div>
      <div className="glass-panel table-wrap">
        <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)', background: ALT }}>
              <th style={{ padding: '1rem' }}>Room / Tenant</th>
              <th style={{ padding: '1rem' }}>Month</th>
              <th style={{ padding: '1rem' }}>Details</th>
              <th style={{ padding: '1rem' }}>Total</th>
              <th style={{ padding: '1rem' }}>Status</th>
              <th style={{ padding: '1rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.map(inv => {
              const r = rooms.find(rm => rm.id === inv.roomId);
              const t = tenants.find(tn => tn.id === inv.tenantId);
              const overdue = (inv.status === 'pending' || inv.status === 'partially_paid') && inv.dueDate && daysBetween(inv.dueDate) > 0;
              const canEdit = inv.status !== 'void' && inv.status !== 'rolled_over';
              return (
                <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '1rem', fontWeight: 600 }}>Room {r?.roomNumber} ({t?.name})</td>
                  <td style={{ padding: '1rem' }}>
                    {inv.month} {inv.year}
                    {overdue && <span className="badge badge-danger" style={{ marginLeft: '0.4rem' }}>{daysBetween(inv.dueDate)}d late</span>}
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.95rem', color: 'var(--text-muted)' }}>
                    Rent {formatMoney(inv.baseRent)} · Elec {formatMoney(inv.electricityBill)} · Other {formatMoney(Number(inv.waterBill) + Number(inv.otherCharges))} · Old {formatMoney(inv.previousPending)}
                  </td>
                  <td style={{ padding: '1rem', fontWeight: '700' }}>{formatMoney(inv.totalAmount)}</td>
                  <td style={{ padding: '1rem' }}>
                    <span className={`badge ${badgeClass(inv.status)}`}>{statusLabel(inv.status)}</span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary" style={{ padding: '0.45rem 0.7rem', minHeight: 'auto', fontSize: '0.9rem' }} onClick={() => printInvoice(inv)}><Printer size={15}/> PDF</button>
                      {t && <button className="btn" style={{ padding: '0.45rem 0.7rem', minHeight: 'auto', fontSize: '0.9rem', background: '#25D366', color: 'white' }} onClick={() => openWhatsApp(inv, t)}><MessageCircle size={15}/> WhatsApp</button>}
                      {canEdit && <button className="btn btn-secondary" style={{ padding: '0.45rem 0.7rem', minHeight: 'auto', fontSize: '0.9rem' }} onClick={() => setEditingInvoice({ id: inv.id, currentMeter: inv.currentMeter, waterBill: inv.waterBill, otherCharges: inv.otherCharges, _label: `${inv.month} ${inv.year}` })}><PenSquare size={15}/> Edit</button>}
                      {canEdit && <button className="btn" style={{ padding: '0.45rem 0.7rem', minHeight: 'auto', fontSize: '0.9rem', background: '#FEF3C7', color: '#92400E' }} onClick={() => { if (window.confirm('Cancel this bill? It will not count toward what the tenant owes, but stays on record.')) voidInvoice(inv.id); }}><Ban size={15}/> Cancel</button>}
                      <button className="btn" style={{ padding: '0.45rem 0.7rem', minHeight: 'auto', fontSize: '0.9rem', background: '#FEE2E2', color: '#991B1B' }} onClick={() => { if (window.confirm('Delete this bill for good? This cannot be undone.')) deleteInvoice(inv.id); }}><Trash2 size={15}/> Delete</button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {filteredInvoices.length === 0 && (
              <tr><td colSpan={6} style={{ padding: '1.5rem', color: 'var(--text-muted)', textAlign: 'center' }}>No bills match your search.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Bill Modal */}
      {editingInvoice && (
        <div className="modal-overlay">
          <div className="glass-panel fade-in modal-card" style={{ padding: '2.5rem' }}>
            <h2 style={{ marginBottom: '0.5rem' }}>Edit Bill — {editingInvoice._label}</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '1rem' }}>The electricity and total update automatically. Any payments already recorded are kept.</p>
            <form onSubmit={e => {
                e.preventDefault();
                const res = updateInvoice(editingInvoice.id, {
                  currentMeter: editingInvoice.currentMeter,
                  waterBill: editingInvoice.waterBill,
                  otherCharges: editingInvoice.otherCharges,
                });
                if (res?.error) { alert(res.error); return; }
                setEditingInvoice(null);
                alert('Bill saved.');
              }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="input-label">New meter reading</label>
                  <input type="number" className="input-field" value={editingInvoice.currentMeter} onChange={e => setEditingInvoice({...editingInvoice, currentMeter: e.target.value})} required/>
                </div>
                <div>
                  <label className="input-label">Water bill (₹)</label>
                  <input type="number" className="input-field" value={editingInvoice.waterBill} onChange={e => setEditingInvoice({...editingInvoice, waterBill: e.target.value})} />
                </div>
                <div>
                  <label className="input-label">Other charges (₹)</label>
                  <input type="number" className="input-field" value={editingInvoice.otherCharges} onChange={e => setEditingInvoice({...editingInvoice, otherCharges: e.target.value})} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" style={{flex: 1}} onClick={() => setEditingInvoice(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{flex: 2}}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  const renderRequests = () => {
    const pendingRequests = invoices.filter(i => i.status === 'payment_requested');

    return (
      <div className="fade-in">
        <h2 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '2rem' }}>Payments to Approve</h2>
        {pendingRequests.length === 0 ? (
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <CheckCircle size={48} color={GREEN} style={{ margin: '0 auto 1rem' }} />
            <h3>Nothing to approve right now</h3>
            <p>When a tenant says they've paid, it shows up here.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            {pendingRequests.map(inv => {
              const r = rooms.find(rm => rm.id === inv.roomId);
              const t = tenants.find(tn => tn.id === inv.tenantId);
              return (
                <div key={inv.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{t?.name} — Room {r?.roomNumber}</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>Bill: {inv.month} {inv.year} · Total {formatMoney(inv.totalAmount)}</p>
                    <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <span className="badge badge-warning">Paid by: {inv.paymentMethod}</span>
                      <span className="badge badge-success">Tenant says paid: {formatMoney(inv.requestedAmount)}</span>
                    </div>
                    {inv.paymentScreenshot?.dataUrl && (
                      <a href={inv.paymentScreenshot.dataUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: '0.75rem' }}>
                        <img src={inv.paymentScreenshot.dataUrl} alt="Payment receipt" style={{ maxHeight: '100px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                      </a>
                    )}
                  </div>
                  <div>
                    <button className="btn btn-primary" onClick={() => acceptPayment(inv.id)}>
                      <CheckCircle size={20} /> Approve Payment
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderMaintenance = () => {
    const sorted = [...maintenance].sort((a, b) => (a.status === 'resolved' ? 1 : 0) - (b.status === 'resolved' ? 1 : 0));
    return (
      <div className="fade-in">
        <h2 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '2rem' }}>Repairs</h2>
        {sorted.length === 0 ? (
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Wrench size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <h3>No repair requests</h3>
            <p>When a tenant reports a problem, it shows up here.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {sorted.map(m => {
              const t = tenants.find(x => x.id === m.tenantId);
              const r = rooms.find(x => x.id === m.roomId);
              return (
                <div key={m.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ maxWidth: '60ch' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                      <strong>{t?.name || 'Unknown'}</strong>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Room {r?.roomNumber} · {formatDate(m.createdAt)}</span>
                    </div>
                    <p>{m.description}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span className={`badge ${m.status === 'resolved' ? 'badge-success' : m.status === 'in_progress' ? 'badge-warning' : 'badge-danger'}`}>{m.status === 'in_progress' ? 'In Progress' : m.status === 'resolved' ? 'Done' : 'New'}</span>
                    <select className="input-field" style={{ width: 'auto', background: 'var(--bg-card)' }} value={m.status} onChange={e => updateMaintenanceRequest(m.id, e.target.value)}>
                      <option value="open">New</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Done</option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const NavItem = ({ tabId, icon: Icon, label, badge }) => (
    <button
      onClick={() => setActiveTab(tabId)}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.95rem 1rem',
        background: activeTab === tabId ? 'rgba(37, 99, 235, 0.12)' : 'transparent',
        borderRadius: '12px', color: activeTab === tabId ? 'var(--primary)' : 'var(--text-muted)',
        border: 'none', cursor: 'pointer', textAlign: 'left', fontWeight: activeTab === tabId ? '700' : '600', transition: 'all 0.15s', width: '100%', fontSize: '1.05rem'
      }}>
      <Icon size={22} /> <span style={{ flex: 1 }}>{label}</span>
      {badge > 0 && <span className="badge badge-danger" style={{ fontSize: '0.8rem', padding: '0.15rem 0.55rem' }}>{badge}</span>}
    </button>
  );

  const paymentRequestCount = invoices.filter(i => i.status === 'payment_requested').length;
  const openMaintenanceCount = maintenance.filter(m => m.status !== 'resolved').length;

  return (
    <div className="dash-layout">
      {/* Sidebar */}
      <div className="glass-panel dash-sidebar" style={{ margin: '1rem', display: 'flex', flexDirection: 'column', padding: '1.5rem', borderRadius: '20px' }}>
        <div className="sidebar-brand" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2.5rem' }}>
          <div style={{ background: 'var(--primary)', padding: '0.5rem', borderRadius: '12px' }}>
            <Home size={26} color="white" />
          </div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: '800' }} className="text-gradient">Rent Manager</h1>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
          <NavItem tabId="overview" icon={Home} label="Home" />
          <NavItem tabId="buildings" icon={Home} label="Buildings & Rooms" />
          <NavItem tabId="tenants" icon={Users} label="Tenants" />
          <NavItem tabId="billings" icon={DollarSign} label="Bills" />
          <NavItem tabId="requests" icon={ClipboardList} label="Payments to Approve" badge={paymentRequestCount} />
          <NavItem tabId="maintenance" icon={Wrench} label="Repairs" badge={openMaintenanceCount} />
        </nav>

        <div className="signout" style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
          <button onClick={handleLogout} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'flex-start', padding: '0.95rem 1rem' }}>
            <LogOut size={20} /> Sign Out
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="dash-main">
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'buildings' && renderBuildingsAndRooms()}
        {activeTab === 'tenants' && renderTenants()}
        {activeTab === 'billings' && renderBillings()}
        {activeTab === 'requests' && renderRequests()}
        {activeTab === 'maintenance' && renderMaintenance()}
      </div>
    </div>
  );
}

export default LandlordDashboard;
