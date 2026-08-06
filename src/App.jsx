import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import LandlordDashboard from './pages/LandlordDashboard';
import TenantDashboard from './pages/TenantDashboard';
import PatientForm from './patientform/PatientForm';
import DoctorLogin from './patientform/DoctorLogin';
import DoctorDashboard from './patientform/DoctorDashboard';
import { AppProvider } from './context/AppContext';
import './index.css';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null, errorInfo: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) { this.setState({ errorInfo }); console.error(error, errorInfo); }
  render() { 
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', color: 'red', background: '#ffebee', minHeight: '100vh', width: '100%' }}>
          <h2>React Fatal Crash!</h2>
          <p>Please copy this exact error and send it to me:</p>
          <pre style={{ whiteSpace: 'pre-wrap', background: 'white', padding: '1rem', border: '1px solid red' }}>
            {this.state.error && this.state.error.toString()}
            <br/><br/>
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
        </div>
      );
    }
    return this.props.children; 
  }
}

function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <Router>
          <div className="app-container">
            <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/dashboard" element={<Navigate to="/landlord" replace />} />
              <Route path="/login" element={<Login />} />
              <Route path="/landlord" element={<LandlordDashboard />} />
              <Route path="/tenant" element={<TenantDashboard />} />

              {/* Patient intake (Cold & Flu symptom form) — separate module.
                  /intake        = public form the doctor shares with patients
                  /clinic/login  = doctor login
                  /clinic        = doctor dashboard (patient-wise submissions) */}
              <Route path="/intake" element={<PatientForm />} />
              <Route path="/clinic/login" element={<DoctorLogin />} />
              <Route path="/clinic" element={<DoctorDashboard />} />
            </Routes>
          </div>
        </Router>
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;
