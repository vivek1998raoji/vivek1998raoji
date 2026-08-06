import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stethoscope, Lock } from 'lucide-react';
import { login } from './auth';
import { CLINIC } from './formSchema';
import './patientform.css';

export default function DoctorLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (login(username, password)) {
      navigate('/clinic', { replace: true });
    } else {
      setError('Invalid username or password.');
    }
  }

  return (
    <div className="pf-page" style={{ maxWidth: 460, paddingTop: '3rem' }}>
      <div className="glass-panel pf-section fade-in">
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div
            style={{
              width: 64, height: 64, borderRadius: 16, margin: '0 auto 0.75rem',
              background: '#EFF6FF', color: 'var(--primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Stethoscope size={32} />
          </div>
          <h2 style={{ fontSize: '1.5rem' }}>Doctor Login</h2>
          <p style={{ color: 'var(--text-muted)' }}>{CLINIC.name}</p>
        </div>

        {error && (
          <div
            style={{
              background: '#FEE2E2', color: '#991B1B', padding: '0.7rem 1rem',
              borderRadius: 10, marginBottom: '1rem', fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label className="input-label">Username</label>
          <input
            className="input-field"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            style={{ marginBottom: '1rem' }}
          />
          <label className="input-label">Password</label>
          <input
            type="password"
            className="input-field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ marginBottom: '1.5rem' }}
          />
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
            <Lock size={18} /> Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
