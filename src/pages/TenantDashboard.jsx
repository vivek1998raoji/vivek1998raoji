import React, { useState, useContext, useEffect } from 'react';
import { Home, CreditCard, FileText, LogOut, CheckCircle, AlertCircle, KeyRound, Wrench, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import { formatMoney, formatDate, statusLabel } from '../lib/format';
import { openInvoicePrint } from '../lib/invoiceDoc';
import { fileToDownscaledDataUrl } from '../lib/image';

const GREEN = '#15803D';
const RED = '#DC2626';
const AMBER = '#B45309';
const ALT = 'var(--surface-alt)';

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
    return <div style={{ padding: '2rem', textAlign: 'center' }}><h2>Loading… Please refresh.</h2></div>;
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
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>Please sign in again</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Your session has ended. Sign in from the main page to continue.</p>
        <button className="btn btn-primary" onClick={() => navigate('/login')}>Go to Sign In</button>
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
    if (amt > Number(currentUnpaid.previousPendingCarry) + 0.001) { alert('Amount cannot be more than what you owe.'); return; }
    submitPaymentRequest(payModal.invoiceId, amt, payForm.method, payForm.screenshot);
    setPayModal({ open: false, invoiceId: null });
    alert('Sent! Your owner will confirm the payment.');
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
    alert('Password changed.');
  };

  const handleMaintSubmit = (e) => {
    e.preventDefault();
    if (!maintModal.description.trim()) { alert('Please describe the problem.'); return; }
    addMaintenanceRequest(tenant.id, maintModal.description);
    setMaintModal({ open: false, description: '' });
    alert('Sent to your owner!');
  };

  const NavItem = ({ tabId, icon: Icon, label }) => (
    <button
      onClick={() => setActiveTab(tabId)}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.95rem 1rem',
        background: activeTab === tabId ? 'rgba(21, 128, 61, 0.12)' : 'transparent',
        borderRadius: '12px', color: activeTab === tabId ? 'var(--secondary)' : 'var(--text-muted)',
        border: 'none', cursor: 'pointer', textAlign: 'left', fontWeight: activeTab === tabId ? '700' : '600', transition: 'all 0.15s', width: '100%', fontSize: '1.05rem'
      }}>
      <Icon size={22} /> {label}
    </button>
  );

  return (
    <div className="dash-layout">
      {/* Sidebar */}
      <div className="glass-panel dash-sidebar" style={{ margin: '1rem', display: 'flex', flexDirection: 'column', padding: '1.5rem', borderRadius: '20px' }}>
        <div className="sidebar-brand" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2.5rem' }}>
          <div style={{ background: 'var(--secondary)', padding: '0.5rem', borderRadius: '12px' }}>
            <Home size={26} color="white" />
          </div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: '800' }}>My Home</h1>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
          <NavItem tabId="home" icon={Home} label="Home" />
          <NavItem tabId="payments" icon={CreditCard} label="My Bills" />
          <NavItem tabId="maintenance" icon={Wrench} label="Repairs" />
          <NavItem tabId="lease" icon={FileText} label="My Room" />
        </nav>

        <div className="signout" style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
          <button onClick={handleLogout} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'flex-start', padding: '0.95rem 1rem' }}>
            <LogOut size={20} /> Sign Out
          </button>
        </div>
      </div>

      {/* Main Content Areas */}
      <div className="dash-main" style={{ position: 'relative' }}>
        <header style={{ marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '0.25rem' }}>Hello, {tenant.name}!</h2>
            <p style={{ color: 'var(--text-muted)' }}>Room {room?.roomNumber} at {building?.name}.</p>
          </div>
          <button className="btn btn-secondary" onClick={() => setPwModal({ open: true, newPassword: '' })}>
            <KeyRound size={18} /> Change Password
          </button>
        </header>

        {activeTab === 'home' && (
          <div className="fade-in">
             <div className="glass-panel" style={{ padding: '2rem', maxWidth: '640px' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '0.5rem', flexWrap: 'wrap' }}>
                 <h3 style={{ fontSize: '1.5rem', fontWeight: '700' }}>My Details</h3>
                 {profileEdit ? (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-secondary" style={{padding: '0.5rem 1rem', minHeight: 'auto'}} onClick={() => { setProfileEdit(false); setProfileForm({name: tenant.name, fatherName: tenant.fatherName}); }}>Cancel</button>
                      <button className="btn btn-primary" style={{padding: '0.5rem 1rem', minHeight: 'auto'}} onClick={() => { updateTenant(tenant.id, profileForm); setProfileEdit(false); alert('Saved!'); }}>Save</button>
                    </div>
                 ) : (
                    <button className="btn btn-secondary" style={{padding: '0.5rem 1rem', minHeight: 'auto'}} onClick={() => setProfileEdit(true)}>Edit</button>
                 )}
               </div>

               <div className="form-grid">
                 <div>
                   <label className="input-label">Full Name</label>
                   {profileEdit ? <input className="input-field" value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})} required/> : <div className="input-field" style={{background: ALT}}>{tenant.name}</div>}
                 </div>
                 <div>
                   <label className="input-label">Father's Name</label>
                   {profileEdit ? <input className="input-field" value={profileForm.fatherName} onChange={e => setProfileForm({...profileForm, fatherName: e.target.value})} required/> : <div className="input-field" style={{background: ALT}}>{tenant.fatherName}</div>}
                 </div>
                 <div>
                   <label className="input-label">Phone (used to sign in)</label>
                   <div className="input-field" style={{background: ALT}}>{tenant.phone}</div>
                 </div>
                 <div>
                   <label className="input-label">WhatsApp</label>
                   <div className="input-field" style={{background: ALT}}>{tenant.whatsapp}</div>
                 </div>
                 <div style={{ gridColumn: '1 / -1' }}>
                   <label className="input-label">My Documents <span style={{fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 400}}>(ask your owner to change these)</span></label>
                   <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                     {tenant?.docs?.length > 0 ? tenant.docs.map((d, i) => {
                       const label = typeof d === 'string' ? d : d.name;
                       const url = typeof d === 'string' ? null : d.dataUrl;
                       return url
                         ? <a key={i} href={url} target="_blank" rel="noreferrer" className="badge badge-success"><FileText size={14}/> {label}</a>
                         : <span key={i} className="badge badge-success"><FileText size={14}/> {label}</span>;
                     }) : <span style={{color:'var(--text-muted)'}}>No files yet.</span>}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    <AlertCircle size={24} color={AMBER} />
                    <h3 style={{ fontSize: '1.35rem', fontWeight: '700' }}>{currentUnpaid.status === 'partially_paid' ? 'Amount Still to Pay' : 'Amount to Pay'}</h3>
                  </div>
                  <h2 style={{ fontSize: '3rem', fontWeight: '800', marginBottom: '0.5rem', color: RED }}>{formatMoney(currentUnpaid.previousPendingCarry)}</h2>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '0.25rem' }}>For: <strong>{currentUnpaid.month} {currentUnpaid.year}</strong></p>
                  {currentUnpaid.dueDate && <p style={{ color: 'var(--text-muted)', marginBottom: '1.75rem' }}>Please pay by: <strong>{formatDate(currentUnpaid.dueDate)}</strong></p>}

                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <button className="btn btn-primary" style={{ background: 'var(--secondary)' }} onClick={() => setPayModal({ open: true, invoiceId: currentUnpaid.id })}>
                      Pay Now
                    </button>
                    <button className="btn btn-secondary" onClick={() => openInvoicePrint(currentUnpaid, tenant, room, building)}><Printer size={18}/> Download Bill</button>
                  </div>

                  <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                     <h4 style={{ marginBottom: '0.85rem', color: 'var(--text-muted)' }}>What's in this bill</h4>
                     <p style={{ marginBottom: '0.3rem' }}>Rent: {formatMoney(currentUnpaid.baseRent)}</p>
                     <p style={{ marginBottom: '0.3rem' }}>Electricity (meter {currentUnpaid.currentMeter}): {formatMoney(currentUnpaid.electricityBill)}</p>
                     <p style={{ marginBottom: '0.3rem' }}>Water / other: {formatMoney(Number(currentUnpaid.waterBill) + Number(currentUnpaid.otherCharges))}</p>
                     <p style={{color: RED, marginBottom: '0.3rem'}}>Old unpaid amount: {formatMoney(currentUnpaid.previousPending)}</p>
                     <p style={{color: GREEN, fontWeight:'700', marginTop:'0.5rem', fontSize: '1.1rem'}}>Total: {formatMoney(currentUnpaid.totalAmount)}</p>
                  </div>
                </div>
              ) : (
                <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
                  <CheckCircle size={52} color={GREEN} style={{ margin: '0 auto 1rem' }} />
                  <h3>You're all paid up!</h3>
                  <p style={{ color: 'var(--text-muted)' }}>Nothing to pay for Room {room?.roomNumber}.</p>
                </div>
              )}

              {/* Payment History */}
              <h3 style={{ fontSize: '1.5rem', fontWeight: '700', marginTop: '1rem' }}>My Past Bills</h3>
              <div className="glass-panel table-wrap">
                <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <tbody>
                    {tenantInvoices.map((tx) => (
                      <tr key={tx.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '1.15rem 1.25rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ background: ALT, padding: '0.5rem', borderRadius: '50%' }}>
                              {tx.status === 'paid' ? <CheckCircle size={18} color={GREEN} /> : <AlertCircle size={18} color={AMBER} />}
                            </div>
                            <div>
                              <p style={{ fontWeight: '600' }}>{tx.month} {tx.year}</p>
                              <span className={`badge ${tx.status === 'paid' ? 'badge-success' : tx.status === 'partially_paid' ? 'badge-warning' : 'badge'}`} style={{ fontSize: '0.8rem' }}>{statusLabel(tx.status)}</span>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '1.15rem 1.25rem', fontWeight: '600', textAlign: 'right' }}>Bill: {formatMoney(tx.totalAmount)}</td>
                        <td style={{ padding: '1.15rem 1.25rem', fontWeight: '600', textAlign: 'right', color: GREEN }}>Paid: {formatMoney(tx.amountPaid)}</td>
                        <td style={{ padding: '1.15rem 1.25rem', textAlign: 'right' }}>
                          <button className="btn btn-secondary" style={{ padding: '0.5rem 0.7rem', minHeight: 'auto' }} title="Download bill" onClick={() => openInvoicePrint(tx, tenant, room, building)}><Printer size={16}/></button>
                        </td>
                      </tr>
                    ))}
                    {tenantInvoices.length === 0 && (
                      <tr><td style={{ padding: '1.5rem', color: 'var(--text-muted)' }}>No bills yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div className="glass-panel" style={{ padding: '2rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1rem' }}>Something broken?</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginBottom: '1.25rem' }}>Tell your owner about a repair.</p>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setMaintModal({ open: true, description: '' })}><Wrench size={18}/> Report a Problem</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'maintenance' && (
          <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '700' }}>My Repairs</h3>
              <button className="btn btn-primary" onClick={() => setMaintModal({ open: true, description: '' })}><Wrench size={18}/> Report a Problem</button>
            </div>
            {myRequests.length === 0 ? (
              <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Wrench size={44} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                <p>No repairs reported. Tell your owner if something needs fixing.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '1rem' }}>
                {myRequests.map(m => (
                  <div key={m.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                      <p>{m.description}</p>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>{formatDate(m.createdAt)}</span>
                    </div>
                    <span className={`badge ${m.status === 'resolved' ? 'badge-success' : m.status === 'in_progress' ? 'badge-warning' : 'badge-danger'}`}>{m.status === 'in_progress' ? 'In Progress' : m.status === 'resolved' ? 'Done' : 'New'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'lease' && (
          <div className="fade-in">
            <div className="glass-panel" style={{ padding: '2rem', maxWidth: '640px' }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1.5rem' }}>My Room</h3>
              <div className="form-grid">
                <div>
                  <label className="input-label">Building</label>
                  <div className="input-field" style={{background: ALT}}>{building?.name || '—'}</div>
                </div>
                <div>
                  <label className="input-label">Room</label>
                  <div className="input-field" style={{background: ALT}}>{room?.roomNumber || '—'}</div>
                </div>
                <div>
                  <label className="input-label">Monthly Rent</label>
                  <div className="input-field" style={{background: ALT}}>{formatMoney(room?.rentAmount)}</div>
                </div>
                <div>
                  <label className="input-label">Electricity Rate</label>
                  <div className="input-field" style={{background: ALT}}>{formatMoney(building?.electricityRate)}/unit</div>
                </div>
                <div>
                  <label className="input-label">Kitchen</label>
                  <div className="input-field" style={{background: ALT}}>{room?.hasKitchen ? 'Yes' : 'No'}</div>
                </div>
                <div>
                  <label className="input-label">Moved In</label>
                  <div className="input-field" style={{background: ALT}}>{tenant.joinDate ? formatDate(tenant.joinDate) : '—'}</div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="input-label">Notes from Owner</label>
                  <div className="input-field" style={{background: ALT, minHeight: '60px'}}>{tenant.notes || '—'}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Change Password Modal */}
        {pwModal.open && (
           <div className="modal-overlay">
             <div className="glass-panel fade-in" style={{ padding: '2.5rem', maxWidth: '420px', width: '90%' }}>
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
                    <button type="submit" className="btn btn-primary" style={{flex: 2, background: 'var(--secondary)'}}>Save</button>
                  </div>
               </form>
             </div>
           </div>
        )}

        {/* Repair Request Modal */}
        {maintModal.open && (
           <div className="modal-overlay">
             <div className="glass-panel fade-in" style={{ padding: '2.5rem', maxWidth: '460px', width: '90%' }}>
               <h2 style={{ marginBottom: '1rem' }}>Report a Problem</h2>
               <form onSubmit={handleMaintSubmit}>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label className="input-label">What is the problem?</label>
                    <textarea className="input-field" style={{ minHeight: '120px' }} placeholder="e.g. The bathroom tap is leaking." value={maintModal.description} onChange={e => setMaintModal({...maintModal, description: e.target.value})} required />
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button type="button" className="btn btn-secondary" style={{flex: 1}} onClick={() => setMaintModal({open: false, description: ''})}>Cancel</button>
                    <button type="submit" className="btn btn-primary" style={{flex: 2}}>Send</button>
                  </div>
               </form>
             </div>
           </div>
        )}

        {/* Payment Modal Overlay */}
        {payModal.open && currentUnpaid && (
           <div className="modal-overlay">
             <div className="glass-panel fade-in" style={{ padding: '2.5rem', maxWidth: '420px', width: '90%' }}>
               <h2 style={{ marginBottom: '1.5rem' }}>Tell Owner I've Paid</h2>

               <form onSubmit={handlePaymentSubmit}>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', cursor: 'pointer', padding: '0.75rem', background: ALT, borderRadius: '10px' }} onClick={() => setPayForm({...payForm, isPartial: !payForm.isPartial, amount: !payForm.isPartial ? payForm.amount : currentUnpaid.previousPendingCarry })}>
                    <span style={{ fontSize: '1rem' }}>Paying full amount ({formatMoney(currentUnpaid.previousPendingCarry)})</span>
                    <span style={{ fontSize: '0.95rem', color: 'var(--primary)', textDecoration: 'underline', fontWeight: 600 }}>
                      {payForm.isPartial ? 'Pay full instead' : 'Pay part?'}
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

                  <div style={{ marginBottom: '1.5rem' }}>
                    <label className="input-label">How did you pay?</label>
                    <select className="input-field" value={payForm.method} onChange={e => setPayForm({...payForm, method: e.target.value})} style={{background: 'var(--bg-card)'}}>
                      <option value="UPI">UPI</option>
                      <option value="Phonepe">PhonePe</option>
                      <option value="Paytm">Paytm</option>
                      <option value="Cash">Cash</option>
                    </select>
                  </div>

                  {payForm.method !== 'Cash' && (
                    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                      <label className="input-label">Add a photo of the payment</label>
                      <input type="file" className="input-field" accept="image/*" style={{ padding: '0.6rem', background: ALT }} onChange={e => handleScreenshot(e.target.files?.[0])} required />
                      {payForm.screenshot?.dataUrl && <img src={payForm.screenshot.dataUrl} alt="receipt preview" style={{ maxHeight: '90px', borderRadius: '8px', marginTop: '0.5rem' }} />}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button type="button" className="btn btn-secondary" style={{flex: 1}} onClick={() => setPayModal({open: false, invoiceId: null})}>Cancel</button>
                    <button type="submit" className="btn btn-primary" style={{flex: 2, background: 'var(--secondary)'}}>Send</button>
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
