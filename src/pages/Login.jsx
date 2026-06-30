import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Phone, UserRound } from 'lucide-react';
import { AppContext } from '../context/AppContext';

function Login() {
  const { login } = useContext(AppContext);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('landlord');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');
    
    const cleanPhone = phone.trim();
    const cleanPass = password.trim();

    // Validate length basics
    if (role === 'tenant' && cleanPhone.length < 10) {
      setError('Phone number must be at least 10 digits.');
      return;
    }

    const user = login(cleanPhone, cleanPass);
    
    if (role === 'landlord') {
       if (user && user.role === 'landlord') {
          window.location.href = '/landlord';
       } else {
          setError('Invalid Landlord Credentials. Hint: landlord / 123456. Make sure you are on the Landlord tab.');
       }
    } else {
       if (user && user.role === 'tenant') {
          window.location.href = '/tenant';
       } else {
          setError('Invalid Tenant Credentials. Check phone and auto-generated password.');
       }
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="glass-panel fade-in" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', boxShadow: '0 8px 16px rgba(79, 70, 229, 0.3)' }}>
            <KeyRound size={32} color="white" />
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '0.5rem' }}>Access Portal</h2>
          <p style={{ color: 'var(--text-muted)' }}>Sign in to the Rent Management CMS.</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          <div style={{ display: 'flex', gap: '1rem', backgroundColor: 'rgba(15, 23, 42, 0.5)', padding: '0.25rem', borderRadius: '10px' }}>
            <button 
              type="button" 
              onClick={() => { setRole('landlord'); setError(''); }}
              style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: 'none', background: role === 'landlord' ? 'var(--primary)' : 'transparent', color: role === 'landlord' ? 'white' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s', fontWeight: '500' }}>
              Landlord
            </button>
            <button 
              type="button" 
              onClick={() => { setRole('tenant'); setError(''); }}
              style={{ flex: 1, padding: '0.5rem', borderRadius: '8px', border: 'none', background: role === 'tenant' ? 'var(--primary)' : 'transparent', color: role === 'tenant' ? 'white' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s', fontWeight: '500' }}>
              Tenant
            </button>
          </div>

          {error && <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.2)', color: '#F87171', borderRadius: '8px', fontSize: '0.875rem', textAlign: 'center' }}>{error}</div>}

          <div>
            <label className="input-label">{role === 'landlord' ? 'Admin Username' : 'Phone Number'}</label>
            <div style={{ position: 'relative' }}>
              {role === 'landlord' ? 
                <UserRound size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} /> :
                <Phone size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              }
              <input 
                type="text" 
                className="input-field" 
                placeholder={role === 'landlord' ? 'landlord' : 'e.g. 9876543210'} 
                style={{ paddingLeft: '2.75rem' }}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="input-label">{role === 'landlord' ? 'Admin Password' : 'Password (Your Phone Number)'}</label>
            <div style={{ position: 'relative' }}>
              <KeyRound size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="password" 
                className="input-field" 
                placeholder={role === 'landlord' ? '••••••••' : 'e.g. 9876543210'} 
                style={{ paddingLeft: '2.75rem' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem', padding: '0.875rem' }}>
            Sign In to {role === 'landlord' ? 'Dashboard' : 'Portal'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
