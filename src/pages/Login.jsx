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

    if (role === 'tenant' && cleanPhone.length < 10) {
      setError('Phone number must be at least 10 digits.');
      return;
    }

    const user = login(cleanPhone, cleanPass);

    if (role === 'landlord') {
       if (user && user.role === 'landlord') {
          window.location.href = '/landlord';
       } else {
          setError('Wrong username or password. Please check and try again.');
       }
    } else {
       if (user && user.role === 'tenant') {
          window.location.href = '/tenant';
       } else {
          setError('Wrong phone number or password. Please check and try again.');
       }
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="glass-panel fade-in" style={{ width: '100%', maxWidth: '440px', padding: '2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '18px', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', boxShadow: '0 8px 16px rgba(37, 70, 229, 0.25)' }}>
            <KeyRound size={34} color="white" />
          </div>
          <h2 style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '0.5rem' }}>Welcome</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem' }}>Sign in to manage your rent.</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'var(--surface-alt)', padding: '0.35rem', borderRadius: '12px' }}>
            <button
              type="button"
              onClick={() => { setRole('landlord'); setError(''); }}
              style={{ flex: 1, padding: '0.75rem', borderRadius: '9px', border: 'none', background: role === 'landlord' ? 'var(--primary)' : 'transparent', color: role === 'landlord' ? 'white' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s', fontWeight: '700', fontSize: '1.05rem' }}>
              I'm the Owner
            </button>
            <button
              type="button"
              onClick={() => { setRole('tenant'); setError(''); }}
              style={{ flex: 1, padding: '0.75rem', borderRadius: '9px', border: 'none', background: role === 'tenant' ? 'var(--primary)' : 'transparent', color: role === 'tenant' ? 'white' : 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s', fontWeight: '700', fontSize: '1.05rem' }}>
              I'm a Tenant
            </button>
          </div>

          {error && <div style={{ padding: '0.85rem', background: '#FEE2E2', color: '#991B1B', borderRadius: '10px', fontSize: '1rem', textAlign: 'center', fontWeight: 500 }}>{error}</div>}

          <div>
            <label className="input-label">{role === 'landlord' ? 'Username' : 'Phone Number'}</label>
            <div style={{ position: 'relative' }}>
              {role === 'landlord' ?
                <UserRound size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} /> :
                <Phone size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              }
              <input
                type="text"
                className="input-field"
                placeholder={role === 'landlord' ? 'landlord' : 'e.g. 9876543210'}
                style={{ paddingLeft: '3rem' }}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="input-label">{role === 'landlord' ? 'Password' : 'Password (your phone number)'}</label>
            <div style={{ position: 'relative' }}>
              <KeyRound size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="password"
                className="input-field"
                placeholder={role === 'landlord' ? 'Enter your password' : 'e.g. 9876543210'}
                style={{ paddingLeft: '3rem' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem', padding: '1rem', fontSize: '1.15rem' }}>
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
