import React, { useState, useContext } from 'react';
import { Home, Users, DollarSign, Bell, LogOut, CheckCircle, Plus, FileText, ClipboardList, PenSquare, MessageCircle, Printer, Trash2, Ban, Search, Wrench, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { MONTHS, formatMoney, formatDate, currentMonthName, currentYear, daysBetween } from '../lib/format';
import { openInvoicePrint } from '../lib/invoiceDoc';
import { buildBillMessage, waLink } from '../lib/whatsapp';
import { toCSV, downloadCSV } from '../lib/csv';
import { fileToDownscaledDataUrl } from '../lib/image';

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
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'white' }}><h2>Loading Data... Please refresh.</h2></div>;
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
      <div style={{ padding: '2rem', textAlign: 'center', color: 'white' }}>
        <h2>Session Expired / Access Denied</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Please log in from the main portal to refresh your secure session.</p>
        <button className="btn btn-primary" onClick={() => navigate('/login')}>Go to Login</button>
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
    openInvoicePrint(invoice, tenant, room, buildingFor(invoice.roomId), 'Landlord');
  };

  // --- Summary Calculations ---
  const totalBuildings = buildings.length;
  const totalRooms = rooms.length;
  const vacantRooms = rooms.filter(r => r.status === 'vacant').length;

  const partialInvoices = invoices.filter(i => i.status === 'partially_paid').length;
  const fullyPaidInvoices = invoices.filter(i => i.status === 'paid').length;

  const totalReceived = invoices.reduce((acc, curr) => acc + (Number(curr.amountPaid) || 0), 0);
  const pendingInvoices = invoices.filter(i => i.status === 'pending' || i.status === 'partially_paid');
  const totalPending = pendingInvoices.reduce((acc, curr) => acc + (Number(curr.previousPendingCarry) || 0), 0);

  // Collected this calendar month (from the payment ledger).
  const collectedThisMonth = invoices
    .flatMap(i => i.payments || [])
    .filter(p => isThisMonth(p.date))
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);

  // Overdue = open invoices whose due date has passed.
  const overdueInvoices = pendingInvoices.filter(i => i.dueDate && daysBetween(i.dueDate) > 0);

  // Reminders Logic — flag active tenants who have completed at least one full
  // calendar month since joining and have no (non-void) invoice for this month.
  const nowMonthName = currentMonthName();
  const nowYear = currentYear();
  const tenantsDueForBilling = tenants.filter(t => {
    if (!t.isActive || !t.joinDate) return false;
    const joined = new Date(t.joinDate);
    const today = new Date();
    // Joined this very month/year -> not due yet.
    if (joined.getMonth() === today.getMonth() && joined.getFullYear() === today.getFullYear()) return false;
    // Already billed for the current month?
    const hasCurrentInvoice = invoices.some(i =>
      i.tenantId === t.id && i.month === nowMonthName && Number(i.year) === nowYear &&
      i.status !== 'void'
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
      { label: 'Status', value: ({ inv }) => inv.status },
      { label: 'Issued', value: ({ inv }) => inv.createdAt || '' },
      { label: 'Due', value: ({ inv }) => inv.dueDate || '' },
    ]);
    downloadCSV(`invoices-${new Date().toISOString().split('T')[0]}.csv`, csv);
  };

  const renderOverview = () => (
    <div className="fade-in">
      <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '2rem' }}>Detailed Overview</h2>

      {tenantsDueForBilling.length > 0 && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '1.5rem', borderRadius: '16px', marginBottom: '2rem' }}>
          <h3 style={{ color: '#F87171', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bell size={20} /> Billing Cycle Completed: {tenantsDueForBilling.length} Tenants Due
          </h3>
          <p style={{ color: 'var(--text-muted)' }}>The following tenants have completed a full month since their occupation date, and do not have an invoice generated for {nowMonthName} {nowYear} yet:</p>
          <ul style={{ marginTop: '0.5rem', listStyle: 'none', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {tenantsDueForBilling.map(t => (
              <li key={t.id} style={{ background: '#0F172A', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.9rem' }}>
                <strong style={{color: 'white'}}>{t.name}</strong> (Room {rooms.find(r=>r.id===t.roomId)?.roomNumber}) <span style={{color: '#60A5FA'}}>Joined: {t.joinDate}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {overdueInvoices.length > 0 && (
        <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '1.25rem 1.5rem', borderRadius: '16px', marginBottom: '2rem' }}>
          <h3 style={{ color: '#FBBF24', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bell size={18} /> {overdueInvoices.length} invoice(s) are past their due date
          </h3>
        </div>
      )}

      <div className="stat-grid" style={{ marginBottom: '2rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
           <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Collected This Month</h3>
           <h2 style={{ fontSize: '2rem', color: '#34D399' }}>{formatMoney(collectedThisMonth)}</h2>
        </div>
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
           <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Total Amount Received (All Time)</h3>
           <h2 style={{ fontSize: '2rem', color: '#34D399' }}>{formatMoney(totalReceived)}</h2>
        </div>
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
           <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Total Amount Pending</h3>
           <h2 style={{ fontSize: '2rem', color: '#F87171' }}>{formatMoney(totalPending)}</h2>
        </div>
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
           <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Overdue Invoices</h3>
           <h2 style={{ fontSize: '2rem', color: '#FBBF24' }}>{overdueInvoices.length}</h2>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: '2rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
           <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Full Amount Paid (Invoices)</h3>
           <h2 style={{ fontSize: '2rem', color: '#34D399' }}>{fullyPaidInvoices}</h2>
        </div>
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
           <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Partial Paid (Invoices)</h3>
           <h2 style={{ fontSize: '2rem', color: '#FBBF24' }}>{partialInvoices}</h2>
        </div>
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
           <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Open Maintenance</h3>
           <h2 style={{ fontSize: '2rem', color: '#60A5FA' }}>{maintenance.filter(m => m.status !== 'resolved').length}</h2>
        </div>
      </div>

      <div className="stat-grid">
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
           <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Total Buildings</h3>
           <h2 style={{ fontSize: '2rem' }}>{totalBuildings}</h2>
        </div>
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
           <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Total Rooms</h3>
           <h2 style={{ fontSize: '2rem' }}>{totalRooms}</h2>
        </div>
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
           <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Vacant Rooms</h3>
           <h2 style={{ fontSize: '2rem', color: '#60A5FA' }}>{vacantRooms}</h2>
        </div>
      </div>
    </div>
  );

  const renderBuildingsAndRooms = () => (
    <div className="fade-in">
      <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '2rem' }}>Buildings & Rooms</h2>

      <div className="two-col">
        {/* Buildings Form */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Add Building</h3>
          <form onSubmit={e => { e.preventDefault(); addBuilding(bForm); setBForm({name:'', electricityRate:''}); }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input className="input-field" placeholder="Building Name" value={bForm.name} onChange={e => setBForm({...bForm, name: e.target.value})} required />
            <input className="input-field" type="number" placeholder="Electricity Rate per Unit (₹)" value={bForm.electricityRate} onChange={e => setBForm({...bForm, electricityRate: e.target.value})} required />
            <button className="btn btn-primary" type="submit"><Plus size={18}/> Add Building</button>
          </form>

          <h4 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Current Buildings</h4>
          <ul style={{ listStyle: 'none' }}>
            {buildings.map(b => (
              <li key={b.id} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.05)', marginBottom: '0.5rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>{b.name} <span style={{color:'var(--secondary)'}}>(₹{b.electricityRate}/unit)</span></div>
                <button className="btn btn-secondary" style={{padding: '0.25rem 0.5rem', fontSize: '0.8rem'}} onClick={() => setEditingBuilding(b)}><PenSquare size={14}/> Edit</button>
              </li>
            ))}
          </ul>
        </div>

        {/* Rooms Form */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Add Room</h3>
          <form onSubmit={e => { e.preventDefault(); addRoom(rForm); setRForm({buildingId:'', roomNumber:'', rentAmount:'', hasKitchen:false, currentMeterReading:''}); }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <select className="input-field" value={rForm.buildingId} onChange={e => setRForm({...rForm, buildingId: e.target.value})} required style={{background: 'var(--bg-card)'}}>
              <option value="">Select Building</option>
              {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <input className="input-field" placeholder="Room Number" value={rForm.roomNumber} onChange={e => setRForm({...rForm, roomNumber: e.target.value})} required />
            <input className="input-field" type="number" placeholder="Rent Amount (₹)" value={rForm.rentAmount} onChange={e => setRForm({...rForm, rentAmount: e.target.value})} required />
            <input className="input-field" type="number" placeholder="Initial Meter Reading" value={rForm.currentMeterReading} onChange={e => setRForm({...rForm, currentMeterReading: e.target.value})} required />
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={rForm.hasKitchen} onChange={e => setRForm({...rForm, hasKitchen: e.target.checked})} />
              Has Kitchen
            </label>
            <button className="btn btn-primary" type="submit"><Plus size={18}/> Add Room</button>
          </form>

          <h4 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Current Rooms</h4>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            <ul style={{ listStyle: 'none' }}>
              {rooms.map(r => (
                <li key={r.id} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.05)', marginBottom: '0.5rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Room {r.roomNumber} ({r.hasKitchen?'Kitchen':'No Kitchen'})</span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span className={`badge ${r.status === 'vacant' ? 'badge-success' : 'badge-warning'}`}>{r.status}</span>
                    <button className="btn btn-secondary" style={{padding: '0.25rem 0.5rem', fontSize: '0.8rem'}} onClick={() => setEditingRoom(r)}><PenSquare size={14}/> Edit</button>
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
          <div className="glass-panel fade-in modal-card" style={{ padding: '2.5rem', background: '#0F172A' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>Edit Building Details</h2>
            <form onSubmit={e => { e.preventDefault(); updateBuilding(editingBuilding.id, editingBuilding); setEditingBuilding(null); alert('Building updated.'); }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="input-label">Building Name</label>
                  <input className="input-field" value={editingBuilding.name} onChange={e => setEditingBuilding({...editingBuilding, name: e.target.value})} required/>
                </div>
                <div>
                  <label className="input-label">Electricity Rate per Unit (₹)</label>
                  <input type="number" className="input-field" value={editingBuilding.electricityRate} onChange={e => setEditingBuilding({...editingBuilding, electricityRate: e.target.value})} required/>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" style={{flex: 1}} onClick={() => setEditingBuilding(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{flex: 2}}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Room Modal */}
      {editingRoom && (
        <div className="modal-overlay">
          <div className="glass-panel fade-in modal-card" style={{ padding: '2.5rem', background: '#0F172A' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>Edit Room Details</h2>
            <form onSubmit={e => { e.preventDefault(); updateRoom(editingRoom.id, editingRoom); setEditingRoom(null); alert('Room updated.'); }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="input-label">Select Building</label>
                  <select className="input-field" value={editingRoom.buildingId} onChange={e => setEditingRoom({...editingRoom, buildingId: e.target.value})} required style={{background: 'var(--bg-card)'}}>
                    {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">Room Number</label>
                  <input className="input-field" value={editingRoom.roomNumber} onChange={e => setEditingRoom({...editingRoom, roomNumber: e.target.value})} required/>
                </div>
                <div>
                  <label className="input-label">Rent Amount (₹)</label>
                  <input type="number" className="input-field" value={editingRoom.rentAmount} onChange={e => setEditingRoom({...editingRoom, rentAmount: e.target.value})} required/>
                </div>
                <div>
                  <label className="input-label">Current Meter Reading</label>
                  <input type="number" className="input-field" value={editingRoom.currentMeterReading} onChange={e => setEditingRoom({...editingRoom, currentMeterReading: e.target.value})} required/>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                  <input type="checkbox" checked={editingRoom.hasKitchen} onChange={e => setEditingRoom({...editingRoom, hasKitchen: e.target.checked})} />
                  Has Kitchen
                </label>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" style={{flex: 1}} onClick={() => setEditingRoom(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{flex: 2}}>Save Changes</button>
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
    alert('Tenant Added successfully!');
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
      <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '2rem' }}>Tenants Management</h2>
      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1.5rem' }}>Add New Tenant</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>The tenant's initial password will be their full phone number. They can change it after logging in.</p>
        <form onSubmit={handleTenantSubmit} className="form-grid">

          <select className="input-field" value={tForm.roomId} onChange={e => setTForm({...tForm, roomId: e.target.value})} required style={{background: 'var(--bg-card)'}}>
            <option value="">Assign to Room...</option>
            {rooms.map(r => <option key={r.id} value={r.id}>Room {r.roomNumber} ({buildings.find(b=>b.id===r.buildingId)?.name}) - {r.status}</option>)}
          </select>
          <input className="input-field" placeholder="Full Name" value={tForm.name} onChange={e => setTForm({...tForm, name: e.target.value})} required />
          <input className="input-field" placeholder="Father's Name" value={tForm.fatherName} onChange={e => setTForm({...tForm, fatherName: e.target.value})} required />
          <input className="input-field" placeholder="Phone Number" value={tForm.phone} onChange={e => setTForm({...tForm, phone: e.target.value})} required />
          <input className="input-field" placeholder="WhatsApp Number" value={tForm.whatsapp} onChange={e => setTForm({...tForm, whatsapp: e.target.value})} required />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label className="input-label">Date Occupied</label>
            <input type="date" className="input-field" value={tForm.joinDate} onChange={e => setTForm({...tForm, joinDate: e.target.value})} required />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', gridColumn: 'span 2' }}>
            <label className="input-label">Upload Govt IDs / Documents (images)</label>
            <input type="file" accept="image/*" multiple className="input-field" style={{ padding: '0.5rem' }} onChange={e => handleDocUpload(e.target.files)} />
            {tDocs.length > 0 && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                {tDocs.map((d, i) => (
                  <span key={i} className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <FileText size={12}/> {d.name}
                    <button type="button" onClick={() => setTDocs(tDocs.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 700 }}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <textarea className="input-field" placeholder="Additional Notes..." value={tForm.notes} onChange={e => setTForm({...tForm, notes: e.target.value})} style={{ gridColumn: 'span 2', minHeight: '80px' }}></textarea>

          <div style={{ gridColumn: 'span 2', textAlign: 'right' }}>
            <button className="btn btn-primary" type="submit"><Plus size={18}/> Assign Tenant</button>
          </div>
        </form>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <h3>Active Tenants</h3>
        <div style={{ position: 'relative', minWidth: '220px' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="input-field" placeholder="Search name / phone / room" value={tenantSearch} onChange={e => setTenantSearch(e.target.value)} style={{ paddingLeft: '2.25rem' }} />
        </div>
      </div>
      <div className="glass-panel table-wrap">
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(15, 23, 42, 0.4)' }}>
              <th style={{ padding: '1rem' }}>Name</th>
              <th style={{ padding: '1rem' }}>Room</th>
              <th style={{ padding: '1rem' }}>Phone/Login ID</th>
              <th style={{ padding: '1rem' }}>Balance</th>
              <th style={{ padding: '1rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleTenants.map(t => {
              const r = rooms.find(rm => rm.id === t.roomId);
              const openInv = invoices.find(i => i.tenantId === t.id && (i.status === 'pending' || i.status === 'partially_paid'));
              return (
                <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '1rem' }}>{t.name}</td>
                  <td style={{ padding: '1rem' }}>Room {r?.roomNumber}</td>
                  <td style={{ padding: '1rem' }}>{t.phone}</td>
                  <td style={{ padding: '1rem', color: Number(t.balancePending) > 0 ? '#F87171' : '#34D399' }}>{formatMoney(t.balancePending)}</td>
                  <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary" style={{padding: '0.5rem'}} onClick={() => setHistoryTenant(t)}><FileText size={16}/> History</button>
                    <button className="btn btn-secondary" style={{padding: '0.5rem'}} onClick={() => setEditingTenant(t)}><PenSquare size={16}/> Edit</button>
                    {openInv && (
                      <button className="btn" style={{padding: '0.5rem', background: 'rgba(37, 211, 102, 0.2)', color: '#25D366'}} title="Send bill on WhatsApp" onClick={() => openWhatsApp(openInv, t)}><MessageCircle size={16}/> WhatsApp</button>
                    )}
                    <button className="btn" style={{padding: '0.5rem', background: 'rgba(239, 68, 68, 0.2)', color: '#F87171'}} onClick={() => {
                       setDeactivateForm({...deactivateForm, finalMeter: r?.currentMeterReading || ''});
                       setDeactivatingTenant(t);
                    }}><Ban size={16}/> Deactivate</button>
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
          <div className="glass-panel fade-in modal-card" style={{ padding: '2.5rem', background: '#0F172A' }}>
            <h2 style={{ marginBottom: '1.5rem' }}>Edit Tenant Details</h2>
            <form onSubmit={e => { e.preventDefault(); updateTenant(editingTenant.id, editingTenant); setEditingTenant(null); alert('Tenant updated.'); }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="input-label">Full Name</label>
                  <input className="input-field" value={editingTenant.name} onChange={e => setEditingTenant({...editingTenant, name: e.target.value})} required/>
                </div>
                <div>
                  <label className="input-label">Father's Name</label>
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
                <button type="submit" className="btn btn-primary" style={{flex: 2}}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate Tenant Modal */}
      {deactivatingTenant && (
        <div className="modal-overlay">
          <div className="glass-panel fade-in modal-card" style={{ padding: '2.5rem', background: '#0F172A', border: '1px solid rgba(239, 68, 68, 0.5)' }}>
            <h2 style={{ marginBottom: '0.5rem', color: '#F87171' }}>Evict / Deactivate Tenant</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>This calculates their final bill, vacates Room {rooms.find(r=>r.id===deactivatingTenant.roomId)?.roomNumber}, and removes them from active rosters.</p>
            <form onSubmit={e => {
                e.preventDefault();
                deactivateTenant(deactivatingTenant.id, deactivateForm.leaveDate, deactivateForm.finalMeter, deactivateForm.additionalCharges);
                setDeactivatingTenant(null);
                alert('Tenant deactivated and final bill drafted!');
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="input-label">Date of Leaving</label>
                  <input type="date" className="input-field" value={deactivateForm.leaveDate} onChange={e => setDeactivateForm({...deactivateForm, leaveDate: e.target.value})} required/>
                </div>
                <div>
                  <label className="input-label">Final Meter Reading</label>
                  <input type="number" className="input-field" value={deactivateForm.finalMeter} onChange={e => setDeactivateForm({...deactivateForm, finalMeter: e.target.value})} required/>
                </div>
                <div>
                  <label className="input-label">Additional Departure Charges (₹)</label>
                  <input type="number" className="input-field" value={deactivateForm.additionalCharges} onChange={e => setDeactivateForm({...deactivateForm, additionalCharges: e.target.value})} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" style={{flex: 1}} onClick={() => setDeactivatingTenant(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{flex: 2, background: '#EF4444'}}>Confirm Deactivation</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyTenant && (
        <div className="modal-overlay">
          <div className="glass-panel fade-in modal-card wide" style={{ padding: '2.5rem', background: '#0F172A' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
               <h2 style={{ fontSize: '1.5rem' }}>Payment History: {historyTenant.name}</h2>
               <button className="btn btn-secondary" style={{padding: '0.5rem'}} onClick={() => setHistoryTenant(null)}>Close</button>
            </div>

            {invoices.filter(i => i.tenantId === historyTenant.id).length === 0 ? (
               <p style={{color: 'var(--text-muted)'}}>No invoices found for this tenant.</p>
            ) : (
               <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                 <thead>
                   <tr style={{ borderBottom: '1px solid var(--border)' }}>
                     <th style={{ padding: '0.75rem' }}>Month</th>
                     <th style={{ padding: '0.75rem' }}>Total ₹</th>
                     <th style={{ padding: '0.75rem' }}>Paid ₹</th>
                     <th style={{ padding: '0.75rem' }}>Status</th>
                   </tr>
                 </thead>
                 <tbody>
                   {invoices.filter(i => i.tenantId === historyTenant.id).map(inv => (
                     <tr key={inv.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                       <td style={{ padding: '0.75rem' }}>{inv.isFinalBill ? 'FINAL SETTLEMENT' : `${inv.month} ${inv.year}`}</td>
                       <td style={{ padding: '0.75rem' }}>{Number(inv.totalAmount).toFixed(2)}</td>
                       <td style={{ padding: '0.75rem', color: '#34D399' }}>{Number(inv.amountPaid).toFixed(2)}</td>
                       <td style={{ padding: '0.75rem' }}>{inv.status.replace(/_/g, ' ').toUpperCase()}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            )}

            {(!historyTenant.isActive) && (
               <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px' }}>
                  <p style={{color: '#F87171'}}><strong>Tenant Deactivated:</strong> Left on {historyTenant.leaveDate}</p>
                  <p style={{color: 'white', marginTop: '0.5rem'}}>Net Remaining Debt: {formatMoney(historyTenant.balancePending)}</p>
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
      <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '2rem' }}>Billings & Invoices</h2>

      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1.5rem' }}>Generate Monthly Bill</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Other charges are optional.</p>

        <form onSubmit={e => {
            e.preventDefault();
            const res = generateInvoice(invForm.roomId, invForm.currentMeter, invForm.waterBill, invForm.otherCharges, invForm.month, invForm.year);
            if (res?.error) { alert(res.error); return; }
            alert('Invoice generated and sent to tenant!');
            setInvForm({...invForm, currentMeter:'', waterBill:'', otherCharges:''});
          }} className="form-grid">

          <select className="input-field" value={invForm.roomId} onChange={e => setInvForm({...invForm, roomId: e.target.value})} required style={{background: 'var(--bg-card)'}}>
            <option value="">Select Occupied Room...</option>
            {rooms.filter(r => r.status === 'occupied').map(r => {
              const b = buildings.find(b=>b.id===r.buildingId);
              return <option key={r.id} value={r.id}>Room {r.roomNumber} ({b?.name}) - Current Meter: {r.currentMeterReading}</option>
            })}
          </select>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select className="input-field" value={invForm.month} onChange={e => setInvForm({...invForm, month: e.target.value})} required style={{background: 'var(--bg-card)'}}>
              {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <input className="input-field" type="number" placeholder="Year" value={invForm.year} onChange={e => setInvForm({...invForm, year: e.target.value})} required style={{width: '100px'}}/>
          </div>

          <input className="input-field" type="number" placeholder="NEW Meter Reading" value={invForm.currentMeter} onChange={e => setInvForm({...invForm, currentMeter: e.target.value})} required />
          <input className="input-field" type="number" placeholder="Water Bill (₹) (Optional)" value={invForm.waterBill} onChange={e => setInvForm({...invForm, waterBill: e.target.value})} />
          <input className="input-field" type="number" placeholder="Other Charges (₹) (Optional)" value={invForm.otherCharges} onChange={e => setInvForm({...invForm, otherCharges: e.target.value})} />

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
             <button className="btn btn-primary" type="submit" disabled={!invForm.roomId}><FileText size={18}/> Generate Invoice</button>
          </div>
        </form>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <h3>Invoices Issued</h3>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input className="input-field" placeholder="Search tenant / room / month" value={invoiceSearch} onChange={e => setInvoiceSearch(e.target.value)} style={{ paddingLeft: '2.25rem', minWidth: '220px' }} />
          </div>
          <select className="input-field" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ background: 'var(--bg-card)', width: 'auto' }}>
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="payment_requested">Payment requested</option>
            <option value="partially_paid">Partially paid</option>
            <option value="paid">Paid</option>
            <option value="rolled_over">Rolled over</option>
            <option value="void">Void</option>
          </select>
          <button className="btn btn-secondary" onClick={exportInvoicesCSV}><Download size={16}/> CSV</button>
        </div>
      </div>
      <div className="glass-panel table-wrap">
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(15, 23, 42, 0.4)' }}>
              <th style={{ padding: '1rem' }}>Room / Tenant</th>
              <th style={{ padding: '1rem' }}>Period</th>
              <th style={{ padding: '1rem' }}>Calculations</th>
              <th style={{ padding: '1rem' }}>Total ₹</th>
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
                <tr key={inv.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '1rem' }}>Room {r?.roomNumber} ({t?.name})</td>
                  <td style={{ padding: '1rem' }}>
                    {inv.month} {inv.year}
                    {overdue && <span className="badge badge-danger" style={{ marginLeft: '0.4rem' }}>{daysBetween(inv.dueDate)}d overdue</span>}
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.85rem' }}>
                    Rent: {inv.baseRent} | Elec: {inv.electricityBill} | Other: {Number(inv.waterBill) + Number(inv.otherCharges)} | Prev: {inv.previousPending}
                  </td>
                  <td style={{ padding: '1rem', fontWeight: 'bold' }}>{formatMoney(inv.totalAmount)}</td>
                  <td style={{ padding: '1rem' }}>
                    <span className={`badge ${inv.status === 'paid' ? 'badge-success' : inv.status === 'partially_paid' ? 'badge-warning' : (inv.status === 'rolled_over' || inv.status === 'void') ? '' : 'badge-danger'}`}>
                      {inv.status.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary" title="Print / Save PDF" style={{ padding: '0.4rem' }} onClick={() => printInvoice(inv)}><Printer size={15}/></button>
                      {t && <button className="btn" title="Send on WhatsApp" style={{ padding: '0.4rem', background: 'rgba(37, 211, 102, 0.2)', color: '#25D366' }} onClick={() => openWhatsApp(inv, t)}><MessageCircle size={15}/></button>}
                      {canEdit && <button className="btn btn-secondary" title="Edit invoice" style={{ padding: '0.4rem' }} onClick={() => setEditingInvoice({ id: inv.id, currentMeter: inv.currentMeter, waterBill: inv.waterBill, otherCharges: inv.otherCharges, _label: `${inv.month} ${inv.year}` })}><PenSquare size={15}/></button>}
                      {canEdit && <button className="btn" title="Void invoice" style={{ padding: '0.4rem', background: 'rgba(245, 158, 11, 0.15)', color: '#FBBF24' }} onClick={() => { if (window.confirm('Void this invoice? It will be excluded from all balances but kept for record.')) voidInvoice(inv.id); }}><Ban size={15}/></button>}
                      <button className="btn" title="Delete invoice" style={{ padding: '0.4rem', background: 'rgba(239, 68, 68, 0.15)', color: '#F87171' }} onClick={() => { if (window.confirm('Permanently delete this invoice? This cannot be undone.')) deleteInvoice(inv.id); }}><Trash2 size={15}/></button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {filteredInvoices.length === 0 && (
              <tr><td colSpan={6} style={{ padding: '1.5rem', color: 'var(--text-muted)', textAlign: 'center' }}>No invoices match your search.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Invoice Modal */}
      {editingInvoice && (
        <div className="modal-overlay">
          <div className="glass-panel fade-in modal-card" style={{ padding: '2.5rem', background: '#0F172A' }}>
            <h2 style={{ marginBottom: '0.5rem' }}>Edit Invoice — {editingInvoice._label}</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Electricity and totals are recalculated automatically. Payments already recorded are preserved.</p>
            <form onSubmit={e => {
                e.preventDefault();
                const res = updateInvoice(editingInvoice.id, {
                  currentMeter: editingInvoice.currentMeter,
                  waterBill: editingInvoice.waterBill,
                  otherCharges: editingInvoice.otherCharges,
                });
                if (res?.error) { alert(res.error); return; }
                setEditingInvoice(null);
                alert('Invoice updated.');
              }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="input-label">New Meter Reading</label>
                  <input type="number" className="input-field" value={editingInvoice.currentMeter} onChange={e => setEditingInvoice({...editingInvoice, currentMeter: e.target.value})} required/>
                </div>
                <div>
                  <label className="input-label">Water Bill (₹)</label>
                  <input type="number" className="input-field" value={editingInvoice.waterBill} onChange={e => setEditingInvoice({...editingInvoice, waterBill: e.target.value})} />
                </div>
                <div>
                  <label className="input-label">Other Charges (₹)</label>
                  <input type="number" className="input-field" value={editingInvoice.otherCharges} onChange={e => setEditingInvoice({...editingInvoice, otherCharges: e.target.value})} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" style={{flex: 1}} onClick={() => setEditingInvoice(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{flex: 2}}>Save Changes</button>
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
        <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '2rem' }}>Payment Requests</h2>
        {pendingRequests.length === 0 ? (
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <CheckCircle size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <h3>No pending payment requests!</h3>
            <p>Tenants haven't flagged any new payments yet.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            {pendingRequests.map(inv => {
              const r = rooms.find(rm => rm.id === inv.roomId);
              const t = tenants.find(tn => tn.id === inv.tenantId);
              return (
                <div key={inv.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{t?.name} - Room {r?.roomNumber}</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Invoice: {inv.month} {inv.year} | Invoice Total: {formatMoney(inv.totalAmount)}</p>
                    <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      <span className="badge badge-warning">Method: {inv.paymentMethod}</span>
                      <span className="badge badge-success">Tenant Claims: Paid {formatMoney(inv.requestedAmount)}</span>
                    </div>
                    {inv.paymentScreenshot?.dataUrl && (
                      <a href={inv.paymentScreenshot.dataUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: '0.75rem' }}>
                        <img src={inv.paymentScreenshot.dataUrl} alt="Payment receipt" style={{ maxHeight: '90px', borderRadius: '8px', border: '1px solid var(--border)' }} />
                      </a>
                    )}
                  </div>
                  <div>
                    <button className="btn btn-primary" onClick={() => acceptPayment(inv.id)}>
                      <CheckCircle size={18} /> Accept Payment
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
        <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '2rem' }}>Maintenance Requests</h2>
        {sorted.length === 0 ? (
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Wrench size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <h3>No maintenance requests</h3>
            <p>Tenants haven't reported any issues yet.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {sorted.map(m => {
              const t = tenants.find(x => x.id === m.tenantId);
              const r = rooms.find(x => x.id === m.roomId);
              return (
                <div key={m.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <div style={{ maxWidth: '60ch' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <strong>{t?.name || 'Unknown'}</strong>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Room {r?.roomNumber} · {formatDate(m.createdAt)}</span>
                    </div>
                    <p style={{ color: 'var(--text-muted)' }}>{m.description}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className={`badge ${m.status === 'resolved' ? 'badge-success' : m.status === 'in_progress' ? 'badge-warning' : 'badge-danger'}`}>{m.status.replace(/_/g, ' ').toUpperCase()}</span>
                    <select className="input-field" style={{ width: 'auto', background: 'var(--bg-card)' }} value={m.status} onChange={e => updateMaintenanceRequest(m.id, e.target.value)}>
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
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
        display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem',
        background: activeTab === tabId ? 'rgba(79, 70, 229, 0.15)' : 'transparent',
        borderRadius: '12px', color: activeTab === tabId ? 'var(--primary)' : 'var(--text-muted)',
        border: 'none', cursor: 'pointer', textAlign: 'left', fontWeight: activeTab === tabId ? '600' : '500', transition: 'all 0.2s', width: '100%'
      }}>
      <Icon size={20} /> <span style={{ flex: 1 }}>{label}</span>
      {badge > 0 && <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>{badge}</span>}
    </button>
  );

  const paymentRequestCount = invoices.filter(i => i.status === 'payment_requested').length;
  const openMaintenanceCount = maintenance.filter(m => m.status !== 'resolved').length;

  return (
    <div className="dash-layout">
      {/* Sidebar */}
      <div className="glass-panel dash-sidebar" style={{ margin: '1rem', display: 'flex', flexDirection: 'column', padding: '1.5rem', borderRadius: '24px' }}>
        <div className="sidebar-brand" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '3rem' }}>
          <div style={{ background: 'var(--primary)', padding: '0.5rem', borderRadius: '10px' }}>
            <Home size={24} color="white" />
          </div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: '700' }} className="text-gradient">Landlord CMS</h1>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <NavItem tabId="overview" icon={Home} label="Overview" />
          <NavItem tabId="buildings" icon={Home} label="Buildings & Rooms" />
          <NavItem tabId="tenants" icon={Users} label="Tenants" />
          <NavItem tabId="billings" icon={DollarSign} label="Billings" />
          <NavItem tabId="requests" icon={ClipboardList} label="Payment Requests" badge={paymentRequestCount} />
          <NavItem tabId="maintenance" icon={Wrench} label="Maintenance" badge={openMaintenanceCount} />
        </nav>

        <div className="signout" style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
          <button onClick={handleLogout} className="btn" style={{ width: '100%', background: 'transparent', color: 'var(--text-muted)', justifyContent: 'flex-start', padding: '1rem' }}>
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
