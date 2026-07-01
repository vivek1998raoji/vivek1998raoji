import React, { useState, useContext, useEffect } from 'react';
import { Home, CreditCard, FileText, LogOut, CheckCircle, AlertCircle, KeyRound, Wrench, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { formatMoney, formatDate } from '../lib/format';
import { openInvoicePrint } from '../lib/invoiceDoc';
import { fileToDownscaledDataUrl } from '../lib/image';

function TenantDashboard() {
  const navigate = useNavigate();
  const context = useContext(AppContext);

  const [activeTab, setActiveTab] = useState('home');
  const [payModal, setPayModal] = useState({ open: false, invoiceId: null });
  const [payForm, setPayForm] = useState({ isPartial: false, amount: '', method: 'UPI', screenshot: null });
  const [pwModal, setPwModal] = useState({ open: false, newPassword: '' });
  const [profileEdit, setProfileEdit] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: '', fatherName: '' });
  const [maintModal, setMaintModal] = useState({ open: false, description: '' });

  if (!context) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: 'white' }}><h2>Loading Data... Please refresh.</h2></div>;
  }

  const { currentUser, logout, submitPaymentRequest, updateTenantPassword, updateTenant, addMaintenanceRequest } = context;

  const tenants = (Array.isArray(context.tenants) ? context.tenants : []).filter(Boolean);
  const rooms = (Array.isArray(context.rooms) ? context.rooms : []).filter(Boolean);
  const buildings = (Array.isArray(context.buildings) ? context.buildings : []).filter(Boolean);
  const invoices = (Array.isArray(context.invoices) ? context.invoices : []).filter(Boolean);
  const maintenanceRequests = (Array.isArray(context.maintenanceRequests) ? context.maintenanceRequests : []).filter(Boolean);

  let fallbackUser = null;
  try {
    const localUser = localStorage.getItem('currentUser');
    if (localUser && localUser !== 'null' && localUser !== 'undefined') {
       fallbackUser = JSON.parse(localUser);
    }
  } catch(e) {}

  const activeUser = currentUser || fallbackUser;

  // Get dynamic tenant from context
  const tenant = tenants.find(t => t.id === activeUser?.id);
  const room = rooms.find(r => r.id === tenant?.roomId);
  const building = buildings.find(b => b.id === room?.buildingId);
  const tenantInvoices = invoices.filter(i => i.tenantId === tenant?.id);
  const myRequests = maintenanceRequests.filter(m => m.tenantId === tenant?.id);

  const currentUnpaid = tenantInvoices.find(i => i.status === 'pending' || i.status === 'partially_paid');

  useEffect(() => {
    if (payModal.open && currentUnpaid) {
      setPayForm({ isPartial: false, amount: currentUnpaid.previousPendingCarry, method: 'UPI', screenshot: null });
    }
  }, [payModal.open]);

  useEffect(() => {
    if (tenant) {
      setProfileForm({ name: tenant.name, fatherName: tenant.fatherName });
    }
  }, [tenant?.name, tenant?.fatherName]);

  if (!activeUser || activeUser?.role !== 'tenant' || !tenant) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'white' }}>
        <h2>Session Expired / Access Denied</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Please log in from the main portal to refresh your secure session.</p>
        <button className="btn btn-primary" onClick={() => navigate('/login')}>Go to Login</button>
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handlePaymentSubmit = (e) => {
    e.preventDefault();
    const amt = Number(payForm.amount);
    if (!(amt > 0)) { alert('Please enter a valid amount.'); return; }
    if (amt > Number(currentUnpaid.previousPendingCarry) + 0.001) { alert('Amount cannot exceed the balance due.'); return; }
    submitPaymentRequest(payModal.invoiceId, amt, payForm.method, payForm.screenshot);
    setPayModal({ open: false, invoiceId: null });
    alert('Payment Done Request sent to Landlord!');
  };

  const handleScreenshot = async (file) => {
    const img = await fileToDownscaledDataUrl(file);
    setPayForm(prev => ({ ...prev, screenshot: img }));
  };

  const handlePasswordChange = (e) => {
    e.preventDefault();
    if (pwModal.newPassword.length < 4) {
      alert("Password must be at least 4 characters.");
      return;
    }
    updateTenantPassword(tenant.id, pwModal.newPassword);
    setPwModal({ open: false, newPassword: '' });
    alert('Password updated successfully!');
  };

  const handleMaintSubmit = (e) => {
    e.preventDefault();
    if (!maintModal.description.trim()) { alert('Please describe the issue.'); return; }
    addMaintenanceRequest(tenant.id, maintModal.description);
    setMaintModal({ open: false, description: '' });
    alert('Maintenance request submitted!');
  };

  const NavItem = ({ tabId, icon: Icon, label }) => (
    <button
      onClick={() => setActiveTab(tabId)}
      style={{
        display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem',
        background: activeTab === tabId ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
        borderRadius: '12px', color: activeTab === tabId ? 'var(--secondary)' : 'var(--text-muted)',
        border: 'none', cursor: 'pointer', textAlign: 'left', fontWeight: activeTab === tabId ? '600' : '500', transition: 'all 0.2s', width: '100%'
      }}>
      <Icon size={20} /> {label}
    </button>
  );

  return (
    <div className="dash-layout">
      {/* Sidebar */}
      <div className="glass-panel dash-sidebar" style={{ margin: '1rem', display: 'flex', flexDirection: 'column', padding: '1.5rem', borderRadius: '24px' }}>
        <div className="sidebar-brand" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '3rem' }}>
          <div style={{ background: 'var(--secondary)', padding: '0.5rem', borderRadius: '10px' }}>
            <Home size={24} color="white" />
          </div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: '700' }}>Tenant Portal</h1>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <NavItem tabId="home" icon={Home} label="Home & Profile" />
          <NavItem tabId="payments" icon={CreditCard} label="Billing & Payments" />
          <NavItem tabId="maintenance" icon={Wrench} label="Maintenance" />
          <NavItem tabId="lease" icon={FileText} label="Lease Details" />
        </nav>

        <div className="signout" style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
          <button onClick={handleLogout} className="btn" style={{ width: '100%', background: 'transparent', color: 'var(--text-muted)', justifyContent: 'flex-start', padding: '1rem' }}>
            <LogOut size={20} /> Sign Out
          </button>
        </div>
      </div>

      {/* Main Content Areas */}
      <div className="dash-main" style={{ position: 'relative' }}>
        <header style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '0.25rem' }}>Hello, {tenant.name}!</h2>
            <p style={{ color: 'var(--text-muted)' }}>Room {room?.roomNumber} at {building?.name}.</p>
          </div>
          <button className="btn btn-secondary" onClick={() => setPwModal({ open: true, newPassword: '' })}>
            <KeyRound size={18} /> Change Password
          </button>
        </header>

        {activeTab === 'home' && (
          <div className="fade-in">
             <div className="glass-panel" style={{ padding: '2rem', maxWidth: '600px' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                 <h3 style={{ fontSize: '1.5rem', fontWeight: '600' }}>My Profile</h3>
                 {profileEdit ? (
                    <div>
                      <button className="btn btn-secondary" style={{marginRight: '0.5rem', padding: '0.5rem 1rem'}} onClick={() => { setProfileEdit(false); setProfileForm({name: tenant.name, fatherName: tenant.fatherName}); }}>Cancel</button>
                      <button className="btn btn-primary" style={{padding: '0.5rem 1rem'}} onClick={() => { updateTenant(tenant.id, profileForm); setProfileEdit(false); alert('Profile updated!'); }}>Save</button>
                    </div>
                 ) : (
                    <button className="btn btn-secondary" style={{padding: '0.5rem 1rem'}} onClick={() => setProfileEdit(true)}>Edit Details</button>
                 )}
               </div>

               <div className="form-grid">
                 <div>
                   <label className="input-label">Full Name</label>
                   {profileEdit ? <input className="input-field" value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})} required/> : <div className="input-field" style={{background: 'rgba(255,255,255,0.05)'}}>{tenant.name}</div>}
                 </div>
                 <div>
                   <label className="input-label">Father's Name</label>
                   {profileEdit ? <input className="input-field" value={profileForm.fatherName} onChange={e => setProfileForm({...profileForm, fatherName: e.target.value})} required/> : <div className="input-field" style={{background: 'rgba(255,255,255,0.05)'}}>{tenant.fatherName}</div>}
                 </div>
                 <div>
                   <label className="input-label">Active Phone (Login)</label>
                   <div className="input-field" style={{background: 'rgba(255,255,255,0.05)'}}>{tenant.phone}</div>
                 </div>
                 <div>
                   <label className="input-label">WhatsApp</label>
                   <div className="input-field" style={{background: 'rgba(255,255,255,0.05)'}}>{tenant.whatsapp}</div>
                 </div>
                 <div style={{ gridColumn: 'span 2' }}>
                   <label className="input-label">Uploaded Documents <span style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>(Contact Landlord to edit)</span></label>
                   <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                     {tenant?.docs?.length > 0 ? tenant.docs.map((d, i) => {
                       const label = typeof d === 'string' ? d : d.name;
                       const url = typeof d === 'string' ? null : d.dataUrl;
                       return url
                         ? <a key={i} href={url} target="_blank" rel="noreferrer" className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><FileText size={14}/> {label}</a>
                         : <span key={i} className="badge badge-success"><FileText size={14}/> {label}</span>;
                     }) : <span style={{color:'var(--text-muted)'}}>No files uploaded yet.</span>}
                   </div>
                 </div>
               </div>
             </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="fade-in two-col">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {/* Payment Due Card */}
              {currentUnpaid ? (
                <div className="glass-panel" style={{ padding: '2rem', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, right: 0, width: '150px', height: '150px', background: 'radial-gradient(circle, rgba(16, 185, 129, 0.2) 0%, transparent 70%)', transform: 'translate(30%, -30%)' }}></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                    <AlertCircle size={24} color="#FBBF24" />
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '600' }}>{currentUnpaid.status === 'partially_paid' ? 'Remaining Balance Due' : 'Next Payment Due'}</h3>
                  </div>
                  <h2 style={{ fontSize: '3rem', fontWeight: '700', marginBottom: '0.5rem' }}>{formatMoney(currentUnpaid.previousPendingCarry)}</h2>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Invoice Month: <strong>{currentUnpaid.month} {currentUnpaid.year}</strong></p>
                  {currentUnpaid.dueDate && <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Due date: <strong>{formatDate(currentUnpaid.dueDate)}</strong></p>}

                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <button className="btn btn-primary" style={{ background: 'var(--secondary)' }} onClick={() => setPayModal({ open: true, invoiceId: currentUnpaid.id })}>
                      Pay Now
                    </button>
                    <button className="btn btn-secondary" onClick={() => openInvoicePrint(currentUnpaid, tenant, room, building)}><Printer size={18}/> Download Bill</button>
                  </div>

                  <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                     <h4 style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>Bill Breakdown</h4>
                     <p>Base Rent: {formatMoney(currentUnpaid.baseRent)}</p>
                     <p>Electricity (M: {currentUnpaid.currentMeter}): {formatMoney(currentUnpaid.electricityBill)}</p>
                     <p>Water/Other: {formatMoney(Number(currentUnpaid.waterBill) + Number(currentUnpaid.otherCharges))}</p>
                     <p style={{color: '#F87171'}}>Previous Pending/Carried: {formatMoney(currentUnpaid.previousPending)}</p>
                     <p style={{color: '#34D399', fontWeight:'bold', marginTop:'0.5rem'}}>Net Total Generated: {formatMoney(currentUnpaid.totalAmount)}</p>
                  </div>
                </div>
              ) : (
                <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
                  <CheckCircle size={48} color="#34D399" style={{ margin: '0 auto 1rem' }} />
                  <h3>You are all caught up!</h3>
                  <p style={{ color: 'var(--text-muted)' }}>No pending invoices for Room {room?.roomNumber}.</p>
                </div>
              )}

              {/* Recent Payments History */}
              <h3 style={{ fontSize: '1.5rem', fontWeight: '600', marginTop: '1rem' }}>Payment History</h3>
              <div className="glass-panel table-wrap">
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <tbody>
                    {tenantInvoices.map((tx) => (
                      <tr key={tx.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <td style={{ padding: '1.25rem 1.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '0.5rem', borderRadius: '50%' }}>
                              {tx.status === 'paid' ? <CheckCircle size={16} color="#34D399" /> : <AlertCircle size={16} color="#FBBF24" />}
                            </div>
                            <div>
                              <p style={{ fontWeight: '500' }}>Invoice {tx.month} {tx.year}</p>
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Status: {tx.status.replace(/_/g,' ').toUpperCase()}</span>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '1.25rem 1.5rem', fontWeight: '600', textAlign: 'right' }}>Generated: {formatMoney(tx.totalAmount)}</td>
                        <td style={{ padding: '1.25rem 1.5rem', fontWeight: '600', textAlign: 'right', color: '#34D399' }}>Paid: {formatMoney(tx.amountPaid)}</td>
                        <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                          <button className="btn btn-secondary" style={{ padding: '0.4rem' }} title="Download bill" onClick={() => openInvoicePrint(tx, tenant, room, building)}><Printer size={15}/></button>
                        </td>
                      </tr>
                    ))}
                    {tenantInvoices.length === 0 && (
                      <tr><td style={{ padding: '1.5rem', color: 'var(--text-muted)' }}>No invoices yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div className="glass-panel" style={{ padding: '2rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem' }}>Maintenance</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>Need something fixed?</p>
                <button className="btn btn-primary" style={{ width: '100%', background: 'rgba(79, 70, 229, 0.2)', color: '#818CF8', border: '1px solid rgba(79, 70, 229, 0.5)' }} onClick={() => setMaintModal({ open: true, description: '' })}>Submit Request</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'maintenance' && (
          <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '600' }}>My Maintenance Requests</h3>
              <button className="btn btn-primary" onClick={() => setMaintModal({ open: true, description: '' })}><Wrench size={18}/> New Request</button>
            </div>
            {myRequests.length === 0 ? (
              <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Wrench size={40} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                <p>No requests yet. Report an issue and your landlord will see it.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {myRequests.map(m => (
                  <div key={m.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                      <p>{m.description}</p>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{formatDate(m.createdAt)}</span>
                    </div>
                    <span className={`badge ${m.status === 'resolved' ? 'badge-success' : m.status === 'in_progress' ? 'badge-warning' : 'badge-danger'}`}>{m.status.replace(/_/g,' ').toUpperCase()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'lease' && (
          <div className="fade-in">
            <div className="glass-panel" style={{ padding: '2rem', maxWidth: '600px' }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1.5rem' }}>Lease Details</h3>
              <div className="form-grid">
                <div>
                  <label className="input-label">Building</label>
                  <div className="input-field" style={{background: 'rgba(255,255,255,0.05)'}}>{building?.name || '—'}</div>
                </div>
                <div>
                  <label className="input-label">Room</label>
                  <div className="input-field" style={{background: 'rgba(255,255,255,0.05)'}}>{room?.roomNumber || '—'}</div>
                </div>
                <div>
                  <label className="input-label">Monthly Rent</label>
                  <div className="input-field" style={{background: 'rgba(255,255,255,0.05)'}}>{formatMoney(room?.rentAmount)}</div>
                </div>
                <div>
                  <label className="input-label">Electricity Rate</label>
                  <div className="input-field" style={{background: 'rgba(255,255,255,0.05)'}}>{formatMoney(building?.electricityRate)}/unit</div>
                </div>
                <div>
                  <label className="input-label">Kitchen</label>
                  <div className="input-field" style={{background: 'rgba(255,255,255,0.05)'}}>{room?.hasKitchen ? 'Yes' : 'No'}</div>
                </div>
                <div>
                  <label className="input-label">Date Occupied</label>
                  <div className="input-field" style={{background: 'rgba(255,255,255,0.05)'}}>{tenant.joinDate ? formatDate(tenant.joinDate) : '—'}</div>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label className="input-label">Notes from Landlord</label>
                  <div className="input-field" style={{background: 'rgba(255,255,255,0.05)', minHeight: '60px'}}>{tenant.notes || '—'}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Change Password Modal */}
        {pwModal.open && (
           <div className="modal-overlay">
             <div className="glass-panel fade-in" style={{ padding: '2.5rem', maxWidth: '400px', width: '90%', background: '#0F172A' }}>
               <h2 style={{ marginBottom: '1.5rem' }}>Change Password</h2>
               <form onSubmit={handlePasswordChange}>
                  <div style={{ marginBottom: '2rem' }}>
                    <label className="input-label">New Password</label>
                    <input
                      type="password"
                      className="input-field"
                      value={pwModal.newPassword}
                      onChange={e => setPwModal({...pwModal, newPassword: e.target.value})}
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button type="button" className="btn btn-secondary" style={{flex: 1}} onClick={() => setPwModal({open: false, newPassword: ''})}>Cancel</button>
                    <button type="submit" className="btn btn-primary" style={{flex: 2, background: 'var(--secondary)'}}>Confirm</button>
                  </div>
               </form>
             </div>
           </div>
        )}

        {/* Maintenance Request Modal */}
        {maintModal.open && (
           <div className="modal-overlay">
             <div className="glass-panel fade-in" style={{ padding: '2.5rem', maxWidth: '440px', width: '90%', background: '#0F172A' }}>
               <h2 style={{ marginBottom: '1rem' }}>Submit Maintenance Request</h2>
               <form onSubmit={handleMaintSubmit}>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label className="input-label">Describe the issue</label>
                    <textarea className="input-field" style={{ minHeight: '110px' }} placeholder="e.g. The bathroom tap is leaking." value={maintModal.description} onChange={e => setMaintModal({...maintModal, description: e.target.value})} required />
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button type="button" className="btn btn-secondary" style={{flex: 1}} onClick={() => setMaintModal({open: false, description: ''})}>Cancel</button>
                    <button type="submit" className="btn btn-primary" style={{flex: 2}}>Submit</button>
                  </div>
               </form>
             </div>
           </div>
        )}

        {/* Payment Modal Overlay */}
        {payModal.open && currentUnpaid && (
           <div className="modal-overlay">
             <div className="glass-panel fade-in" style={{ padding: '2.5rem', maxWidth: '400px', width: '90%', background: '#0F172A' }}>
               <h2 style={{ marginBottom: '1.5rem' }}>Confirm Payment</h2>

               <form onSubmit={handlePaymentSubmit}>

                  {/* Subtle toggle for partial pay */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', cursor: 'pointer', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }} onClick={() => setPayForm({...payForm, isPartial: !payForm.isPartial, amount: !payForm.isPartial ? payForm.amount : currentUnpaid.previousPendingCarry })}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Paying full ({formatMoney(currentUnpaid.previousPendingCarry)})</span>
                    <span style={{ fontSize: '0.8rem', color: payForm.isPartial ? 'var(--primary)' : 'var(--text-muted)', textDecoration: 'underline' }}>
                      {payForm.isPartial ? 'Switch to Full' : 'Partial Pay?'}
                    </span>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <label className="input-label">Amount (₹)</label>
                    <input
                      type="number"
                      className="input-field"
                      value={payForm.amount}
                      onChange={e => setPayForm({...payForm, amount: e.target.value})}
                      disabled={!payForm.isPartial}
                      max={currentUnpaid.previousPendingCarry}
                      min={0}
                      required
                    />
                  </div>

                  <div style={{ marginBottom: '2rem' }}>
                    <label className="input-label">Select Payment Method</label>
                    <select className="input-field" value={payForm.method} onChange={e => setPayForm({...payForm, method: e.target.value})} style={{background: 'var(--bg-card)'}}>
                      <option value="UPI">UPI</option>
                      <option value="Phonepe">PhonePe</option>
                      <option value="Paytm">Paytm</option>
                      <option value="Cash">Cash</option>
                    </select>
                  </div>

                  {payForm.method !== 'Cash' && (
                    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '2rem' }}>
                      <label className="input-label">Upload Payment Screenshot / Receipt</label>
                      <input type="file" className="input-field" accept="image/*" style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.05)' }} onChange={e => handleScreenshot(e.target.files?.[0])} required />
                      {payForm.screenshot?.dataUrl && <img src={payForm.screenshot.dataUrl} alt="receipt preview" style={{ maxHeight: '80px', borderRadius: '8px', marginTop: '0.5rem' }} />}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button type="button" className="btn btn-secondary" style={{flex: 1}} onClick={() => setPayModal({open: false, invoiceId: null})}>Cancel</button>
                    <button type="submit" className="btn btn-primary" style={{flex: 2, background: 'var(--secondary)'}}>Submit</button>
                  </div>
               </form>
             </div>
           </div>
        )}
      </div>
    </div>
  );
}

export default TenantDashboard;
