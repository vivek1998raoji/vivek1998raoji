import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Home, Settings, LogOut, Edit2, Trash2, Plus } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [properties, setProperties] = useState([
    { id: 1, name: 'Sunset Apartments' },
    { id: 2, name: 'Oceanview Villas' }
  ]);
  const [newPropName, setNewPropName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    if (localStorage.getItem('cms_auth') !== 'true') {
      navigate('/login');
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('cms_auth');
    navigate('/login');
  };

  const addProperty = (e) => {
    e.preventDefault();
    if (!newPropName.trim()) return;
    setProperties([...properties, { id: Date.now(), name: newPropName }]);
    setNewPropName('');
  };

  const deleteProperty = (id) => {
    setProperties(properties.filter(p => p.id !== id));
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setEditName(p.name);
  };

  const saveEdit = (id) => {
    setProperties(properties.map(p => p.id === id ? { ...p, name: editName } : p));
    setEditingId(null);
  };

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <LayoutDashboard size={24} color="var(--primary-color)" />
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600' }}>Rent CMS</h2>
        </div>
        
        <div className="sidebar-nav">
          <div className={`nav-item ${activeTab === 'Dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('Dashboard')}>
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </div>
          <div className={`nav-item ${activeTab === 'Properties' ? 'active' : ''}`} onClick={() => setActiveTab('Properties')}>
            <Home size={18} />
            <span>Properties</span>
          </div>
          <div className={`nav-item ${activeTab === 'Tenants' ? 'active' : ''}`} onClick={() => setActiveTab('Tenants')}>
            <Users size={18} />
            <span>Tenants</span>
          </div>
          <div className={`nav-item ${activeTab === 'Settings' ? 'active' : ''}`} onClick={() => setActiveTab('Settings')}>
            <Settings size={18} />
            <span>Settings</span>
          </div>
        </div>

        <div style={{ marginTop: 'auto' }}>
          <div className="nav-item" onClick={handleLogout}>
            <LogOut size={18} />
            <span>Logout</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        {activeTab === 'Dashboard' && (
          <>
            <header className="topbar">
              <div>
                <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>Dashboard Overview</h1>
                <p style={{ color: 'var(--text-muted)' }}>Welcome back to your properties summary.</p>
              </div>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
              <div className="dashboard-card">
                <h3 style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Total Properties</h3>
                <p style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '0.5rem' }}>{properties.length}</p>
              </div>
              <div className="dashboard-card">
                <h3 style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Active Tenants</h3>
                <p style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '0.5rem' }}>18</p>
              </div>
              <div className="dashboard-card">
                <h3 style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Monthly Revenue</h3>
                <p style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '0.5rem' }}>₹35,50,000</p>
              </div>
            </div>
          </>
        )}

        {activeTab === 'Properties' && (
          <>
            <header className="topbar">
              <div>
                <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>Manage Properties</h1>
                <p style={{ color: 'var(--text-muted)' }}>Add, edit, or remove your properties.</p>
              </div>
            </header>

            <div className="dashboard-card" style={{ marginBottom: '1.5rem' }}>
              <form onSubmit={addProperty} style={{ display: 'flex', gap: '1rem' }}>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="New Property Name..." 
                  value={newPropName}
                  onChange={(e) => setNewPropName(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button type="submit" className="btn-primary" style={{ width: 'auto', marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Plus size={18} /> Add Property
                </button>
              </form>
            </div>

            <div className="dashboard-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {properties.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No properties added yet.</p>
              ) : (
                properties.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'var(--input-bg)', borderRadius: '8px', border: '1px solid var(--input-border)' }}>
                    {editingId === p.id ? (
                      <input 
                        type="text" 
                        className="form-control" 
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                        style={{ width: '60%' }}
                      />
                    ) : (
                      <span style={{ fontWeight: '500' }}>{p.name}</span>
                    )}
                    
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {editingId === p.id ? (
                        <button onClick={() => saveEdit(p.id)} className="btn-primary" style={{ margin: 0, padding: '0.5rem 1rem' }}>Save</button>
                      ) : (
                        <button onClick={() => startEdit(p)} style={{ background: 'transparent', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', padding: '0.5rem' }}>
                          <Edit2 size={18} />
                        </button>
                      )}
                      <button onClick={() => deleteProperty(p.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.5rem' }}>
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {activeTab === 'Tenants' && (
          <header className="topbar">
            <div>
              <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>Tenants</h1>
              <p style={{ color: 'var(--text-muted)' }}>Tenant management coming soon.</p>
            </div>
          </header>
        )}

        {activeTab === 'Settings' && (
          <header className="topbar">
            <div>
              <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>Settings</h1>
              <p style={{ color: 'var(--text-muted)' }}>System settings coming soon.</p>
            </div>
          </header>
        )}
      </main>
    </div>
  );
}
