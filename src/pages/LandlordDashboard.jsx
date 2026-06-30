import React, { useState, useContext } from 'react';
import { Home, Users, DollarSign, Bell, LogOut, CheckCircle, Plus, FileText, ClipboardList, PenSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';

function LandlordDashboard() {
  const navigate = useNavigate();
  const context = useContext(AppContext);

  const [activeTab, setActiveTab] = useState('overview');

  // Form States
  const [bForm, setBForm] = useState({ name: '', electricityRate: '' });
  const [rForm, setRForm] = useState({ buildingId: '', roomNumber: '', rentAmount: '', hasKitchen: false, currentMeterReading: '' });
  const [tForm, setTForm] = useState({ roomId: '', name: '', fatherName: '', phone: '', whatsapp: '', notes: '', joinDate: new Date().toISOString().split('T')[0] });
  const [invForm, setInvForm] = useState({ roomId: '', currentMeter: '', waterBill: '', otherCharges: '', month: '', year: new Date().getFullYear() });

  // Modal State
  const [editingBuilding, setEditingBuilding] = useState(null);
  const [editingRoom, setEditingRoom] = useState(null);
  const [editingTenant, setEditingTenant] = useState(null);
  const [deactivatingTenant, setDeactivatingTenant] = useState(null);
  const [historyTenant, setHistoryTenant] = useState(null);
  const [deactivateForm, setDeactivateForm] = useState({ leaveDate: new Date().toISOString().split('T')[0], finalMeter: '', additionalCharges: '' });

  if (!context) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'white' }}><h2>Loading Data... Please refresh.</h2></div>;
  }

  const { currentUser, logout, addBuilding, updateBuilding, addRoom, updateRoom, addTenant, updateTenant, deactivateTenant, generateInvoice, acceptPayment } = context;
  const buildings = (Array.isArray(context.buildings) ? context.buildings : []).filter(Boolean);
  const rooms = (Array.isArray(context.rooms) ? context.rooms : []).filter(Boolean);
  const tenants = (Array.isArray(context.tenants) ? context.tenants : []).filter(Boolean);
  const invoices = (Array.isArray(context.invoices) ? context.invoices : []).filter(Boolean);

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

  // --- Summary Calculations ---
  const totalBuildings = buildings.length;
  const totalRooms = rooms.length;
  const vacantRooms = rooms.filter(r => r.status === 'vacant').length;
  
  const partialInvoices = invoices.filter(i => i.status === 'partially_paid').length;
  const fullyPaidInvoices = invoices.filter(i => i.status === 'paid').length;
  
  const totalReceived = invoices.reduce((acc, curr) => acc + (Number(curr.amountPaid) || 0), 0);
  const pendingInvoices = invoices.filter(i => i.status === 'pending' || i.status === 'partially_paid');
  const totalPending = pendingInvoices.reduce((acc, curr) => acc + (Number(curr.previousPendingCarry) || 0), 0);

  // Reminders Logic
  const allMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const currentMonthName = allMonths[new Date().getMonth()];
  const currentYear = new Date().getFullYear();
  
  const tenantsDueForBilling = tenants.filter(t => {
    if (!t.isActive || !t.joinDate) return false;
    // Check if 30 days have passed since joinDate OR if the day of month is >= their join day
    const joined = new Date(t.joinDate);
    const today = new Date();
    
    // If they joined this exact month and year, not due yet
    if (joined.getMonth() === today.getMonth() && joined.getFullYear() === today.getFullYear()) return false;
    
    // Check if they already have an invoice for the current month
    const hasCurrentInvoice = invoices.some(i => i.tenantId === t.id && i.month === currentMonthName && Number(i.year) === currentYear);
    if (hasCurrentInvoice) return false;

    // If day of month is passed or it's been more than 28 days
    const diffTime = Math.abs(today - joined);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 28 || today.getDate() >= joined.getDate();
  });

  const renderOverview = () => (
    <div className="fade-in">
      <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '2rem' }}>Detailed Overview</h2>

      {tenantsDueForBilling.length > 0 && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '1.5rem', borderRadius: '16px', marginBottom: '2rem' }}>
          <h3 style={{ color: '#F87171', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bell size={20} /> Billing Cycle Completed: {tenantsDueForBilling.length} Tenants Due
          </h3>
          <p style={{ color: 'var(--text-muted)' }}>The following tenants have completed a full month since their occupation date, and do not have an invoice generated for {currentMonthName} {currentYear} yet:</p>
          <ul style={{ marginTop: '0.5rem', listStyle: 'none', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {tenantsDueForBilling.map(t => (
              <li key={t.id} style={{ background: '#0F172A', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.9rem' }}>
                <strong style={{color: 'white'}}>{t.name}</strong> (Room {rooms.find(r=>r.id===t.roomId)?.roomNumber}) <span style={{color: '#60A5FA'}}>Joined: {t.joinDate}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
           <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Total Amount Received</h3>
           <h2 style={{ fontSize: '2rem', color: '#34D399' }}>₹{totalReceived.toFixed(2)}</h2>
        </div>
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
           <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Total Amount Pending</h3>
           <h2 style={{ fontSize: '2rem', color: '#F87171' }}>₹{totalPending.toFixed(2)}</h2>
        </div>
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
           <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Full Amount Paid (Tenants)</h3>
           <h2 style={{ fontSize: '2rem', color: '#34D399' }}>{fullyPaidInvoices}</h2>
        </div>
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
           <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Partial Paid (Tenants)</h3>
           <h2 style={{ fontSize: '2rem', color: '#FBBF24' }}>{partialInvoices}</h2>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
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
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel fade-in" style={{ padding: '2.5rem', width: '500px', background: '#0F172A' }}>
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel fade-in" style={{ padding: '2.5rem', width: '500px', background: '#0F172A' }}>
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

  const renderTenants = () => (
    <div className="fade-in">
      <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '2rem' }}>Tenants Management</h2>
      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1.5rem' }}>Add New Tenant</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>Tenant password will be the last 4 digits of their phone number.</p>
        <form onSubmit={e => { e.preventDefault(); addTenant(tForm); setTForm({roomId:'', name:'', fatherName:'', phone:'', whatsapp:'', notes:'', joinDate: new Date().toISOString().split('T')[0]}); alert('Tenant Added successfully!'); }} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label className="input-label">Upload Govt ID 1</label>
            <input type="file" className="input-field" style={{ padding: '0.5rem' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label className="input-label">Upload Govt ID 2</label>
            <input type="file" className="input-field" style={{ padding: '0.5rem' }} />
          </div>

          <textarea className="input-field" placeholder="Additional Notes..." value={tForm.notes} onChange={e => setTForm({...tForm, notes: e.target.value})} style={{ gridColumn: 'span 2', minHeight: '80px' }}></textarea>
          
          <div style={{ gridColumn: 'span 2', textAlign: 'right' }}>
            <button className="btn btn-primary" type="submit"><Plus size={18}/> Assign Tenant</button>
          </div>
        </form>
      </div>

      <h3 style={{ marginBottom: '1rem' }}>Active Tenants</h3>
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(15, 23, 42, 0.4)' }}>
              <th style={{ padding: '1rem' }}>Name</th>
              <th style={{ padding: '1rem' }}>Room</th>
              <th style={{ padding: '1rem' }}>Phone/Login ID</th>
              <th style={{ padding: '1rem' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tenants.filter(t => t.isActive).map(t => {
              const r = rooms.find(rm => rm.id === t.roomId);
              return (
                <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '1rem' }}>{t.name}</td>
                  <td style={{ padding: '1rem' }}>Room {r?.roomNumber}</td>
                  <td style={{ padding: '1rem' }}>{t.phone}</td>
                  <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-secondary" style={{padding: '0.5rem'}} onClick={() => setHistoryTenant(t)}><FileText size={16}/> History</button>
                    <button className="btn btn-secondary" style={{padding: '0.5rem'}} onClick={() => setEditingTenant(t)}><PenSquare size={16}/> Edit</button>
                    <button className="btn" style={{padding: '0.5rem', background: 'rgba(239, 68, 68, 0.2)', color: '#F87171'}} onClick={() => {
                       setDeactivateForm({...deactivateForm, finalMeter: r?.currentMeterReading || ''});
                       setDeactivatingTenant(t);
                    }}><Bell size={16}/> Deactivate</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Edit Tenant Modal */}
      {editingTenant && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel fade-in" style={{ padding: '2.5rem', width: '500px', background: '#0F172A' }}>
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel fade-in" style={{ padding: '2.5rem', width: '500px', background: '#0F172A', border: '1px solid rgba(239, 68, 68, 0.5)' }}>
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel fade-in" style={{ padding: '2.5rem', width: '700px', maxHeight: '80vh', overflowY: 'auto', background: '#0F172A' }}>
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
                       <td style={{ padding: '0.75rem' }}>{inv.totalAmount.toFixed(2)}</td>
                       <td style={{ padding: '0.75rem', color: '#34D399' }}>{inv.amountPaid.toFixed(2)}</td>
                       <td style={{ padding: '0.75rem' }}>{inv.status.replace('_', ' ').toUpperCase()}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            )}
            
            {(!historyTenant.isActive) && (
               <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px' }}>
                  <p style={{color: '#F87171'}}><strong>Tenant Deactivated:</strong> Left on {historyTenant.leaveDate}</p>
                  <p style={{color: 'white', marginTop: '0.5rem'}}>Net Remaining Debt: ₹{historyTenant.balancePending.toFixed(2)}</p>
               </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderBillings = () => (
    <div className="fade-in">
      <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '2rem' }}>Billings & Invoices</h2>
      
      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1.5rem' }}>Generate Monthly Bill</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Other charges are optional.</p>
        
        <form onSubmit={e => { e.preventDefault(); generateInvoice(invForm.roomId, invForm.currentMeter, invForm.waterBill, invForm.otherCharges, invForm.month, invForm.year); alert('Invoice Sent to Tenant!'); setInvForm({...invForm, currentMeter:'', waterBill:'', otherCharges:''}); }} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          
          <select className="input-field" value={invForm.roomId} onChange={e => setInvForm({...invForm, roomId: e.target.value})} required style={{background: 'var(--bg-card)'}}>
            <option value="">Select Occupied Room...</option>
            {rooms.filter(r => r.status === 'occupied').map(r => {
              const b = buildings.find(b=>b.id===r.buildingId);
              return <option key={r.id} value={r.id}>Room {r.roomNumber} ({b?.name}) - Current Meter: {r.currentMeterReading}</option>
            })}
          </select>
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input className="input-field" placeholder="Month (e.g. March)" value={invForm.month} onChange={e => setInvForm({...invForm, month: e.target.value})} required />
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

      <h3 style={{ marginBottom: '1rem' }}>Recent Invoices Issued</h3>
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(15, 23, 42, 0.4)' }}>
              <th style={{ padding: '1rem' }}>Room / Tenant</th>
              <th style={{ padding: '1rem' }}>Period</th>
              <th style={{ padding: '1rem' }}>Calculations</th>
              <th style={{ padding: '1rem' }}>Total ₹</th>
              <th style={{ padding: '1rem' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {[...invoices].reverse().slice(0, 10).map(inv => {
              const r = rooms.find(rm => rm.id === inv.roomId);
              const t = tenants.find(tn => tn.id === inv.tenantId);
              return (
                <tr key={inv.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <td style={{ padding: '1rem' }}>Room {r?.roomNumber} ({t?.name})</td>
                  <td style={{ padding: '1rem' }}>{inv.month} {inv.year}</td>
                  <td style={{ padding: '1rem', fontSize: '0.85rem' }}>
                    Rent: {inv.baseRent} | Elec: {inv.electricityBill} | Other: {inv.waterBill + inv.otherCharges} | Prev: {inv.previousPending}
                  </td>
                  <td style={{ padding: '1rem', fontWeight: 'bold' }}>₹{inv.totalAmount}</td>
                  <td style={{ padding: '1rem' }}>
                    <span className={`badge ${inv.status === 'paid' ? 'badge-success' : inv.status === 'partially_paid' ? 'badge-warning' : 'badge-danger'}`}>
                      {inv.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
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
                <div key={inv.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{t?.name} - Room {r?.roomNumber}</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Invoice: {inv.month} {inv.year} | Invoice Total: ₹{inv.totalAmount}</p>
                    <div style={{ marginTop: '0.5rem', display: 'flex', gap: '1rem' }}>
                      <span className="badge badge-warning">Method: {inv.paymentMethod}</span>
                      <span className="badge badge-success">Tenant Claims: Paid ₹{inv.requestedAmount}</span>
                    </div>
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

  const NavItem = ({ tabId, icon: Icon, label }) => (
    <button 
      onClick={() => setActiveTab(tabId)}
      style={{ 
        display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', 
        background: activeTab === tabId ? 'rgba(79, 70, 229, 0.15)' : 'transparent', 
        borderRadius: '12px', color: activeTab === tabId ? 'var(--primary)' : 'var(--text-muted)', 
        border: 'none', cursor: 'pointer', textAlign: 'left', fontWeight: activeTab === tabId ? '600' : '500', transition: 'all 0.2s', width: '100%'
      }}>
      <Icon size={20} /> {label}
    </button>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
      {/* Sidebar */}
      <div className="glass-panel" style={{ width: '280px', margin: '1rem', display: 'flex', flexDirection: 'column', padding: '1.5rem', borderRadius: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '3rem' }}>
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
          <NavItem tabId="requests" icon={ClipboardList} label="Payment Requests" />
        </nav>

        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
          <button onClick={handleLogout} className="btn" style={{ width: '100%', background: 'transparent', color: 'var(--text-muted)', justifyContent: 'flex-start', padding: '1rem' }}>
            <LogOut size={20} /> Sign Out
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, padding: '2rem 3rem', height: '100vh', overflowY: 'auto' }}>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'buildings' && renderBuildingsAndRooms()}
        {activeTab === 'tenants' && renderTenants()}
        {activeTab === 'billings' && renderBillings()}
        {activeTab === 'requests' && renderRequests()}
      </div>
    </div>
  );
}

export default LandlordDashboard;
