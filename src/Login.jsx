import React, { useState } from 'react';
import { Key, User, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    if (username === 'landlord' && password === '123456') {
      localStorage.setItem('cms_auth', 'true');
      navigate('/dashboard');
    } else {
      setError('Invalid admin credentials. Please try again.');
    }
  };

  return (
    <div className="login-container">
      <div className="glass-card">
        <div className="icon-wrapper">
          <Key />
        </div>
        <h1 className="title">Access Portal</h1>
        <p className="subtitle">Sign in to the Rent Management CMS</p>
        
        {error && <p className="error-message">{error}</p>}
        
        <form style={{ width: '100%' }} onSubmit={handleLogin}>
          <div className="form-group">
            <label>Admin Username</label>
            <div className="input-wrapper">
              <User />
              <input 
                type="text" 
                className="form-control" 
                placeholder="landlord" 
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
              />
            </div>
          </div>
          
          <div className="form-group">
            <label>Admin Password</label>
            <div className="input-wrapper">
              <Lock />
              <input 
                type="password" 
                className="form-control" 
                placeholder="......" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
          </div>
          
          <button type="submit" className="btn-primary">
            Sign in to Dashboard
          </button>
        </form>
      </div>
    </div>
  );
}
