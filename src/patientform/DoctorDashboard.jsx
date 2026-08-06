import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Stethoscope, LogOut, Search, Trash2, ArrowLeft, Copy, Check,
  RefreshCw, Printer, AlertTriangle, FileText,
} from 'lucide-react';
import { CLINIC, HISTORY_QUESTIONS, SECTIONS } from './formSchema';
import { listSubmissions, deleteSubmission, isSupabaseConfigured } from './store';
import { isLoggedIn, logout } from './auth';
import './patientform.css';

// Human-readable date/time for a submission.
function fmt(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

// ---- Detail view of a single submission ----------------------------------
function SubmissionDetail({ sub, onBack }) {
  const historyText = (id) => {
    const v = sub.history?.[id];
    if (v === 'yes') return 'Yes';
    if (v === 'no') return 'No';
    return '—';
  };

  return (
    <div className="fade-in">
      <div className="pf-no-print" style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <button className="btn btn-secondary" onClick={onBack}>
          <ArrowLeft size={18} /> Back to list
        </button>
        <button className="btn btn-secondary" onClick={() => window.print()}>
          <Printer size={18} /> Print
        </button>
      </div>

      <div className="glass-panel pf-section">
        <div className="pf-section-title">Patient Details</div>
        <div className="form-grid">
          <Field label="Name" value={sub.name} />
          <Field label="Age" value={sub.age} />
          <Field label="Sex" value={sub.sex} />
          <Field label="Encounter ID" value={sub.encounterId} />
          <Field label="Patient ID" value={sub.patientId} />
          <Field label="Visit Date" value={sub.visitDate} />
          <Field label="Visit Time" value={sub.visitTime} />
          <Field label="Submitted" value={fmt(sub.createdAt)} />
        </div>
        {sub.complaint && (
          <div style={{ marginTop: '1rem' }}>
            <div className="input-label">Presented with (C/o)</div>
            <div className="glass-panel" style={{ padding: '0.75rem 1rem', background: 'var(--surface-alt)' }}>
              {sub.complaint}
            </div>
          </div>
        )}
      </div>

      <div className="glass-panel pf-section">
        <div className="pf-section-title">History</div>
        {HISTORY_QUESTIONS.map((q) => (
          <div className="pf-history-row" key={q.id}>
            <div className="pf-history-label">{q.label}</div>
            <span className={`badge ${sub.history?.[q.id] === 'yes' ? 'badge-danger' : sub.history?.[q.id] === 'no' ? 'badge-success' : ''}`}>
              {historyText(q.id)}
            </span>
          </div>
        ))}
      </div>

      <div className="glass-panel pf-section">
        <div className="pf-section-title">Reported Symptoms</div>
        <div className="pf-detail-symptoms">
          {SECTIONS.map((section) => {
            const checked = section.items.filter((it) => sub.symptoms?.[it.id]);
            const note = sub.others?.[section.id];
            if (checked.length === 0 && !note) return null;
            return (
              <div className="pf-detail-section" key={section.id}>
                <h4>{section.title}</h4>
                <div className="pf-chip-row">
                  {checked.map((it) => (
                    <span className="pf-chip" key={it.id}>{it.label}</span>
                  ))}
                  {note && <span className="pf-chip" style={{ background: '#FEF3C7', color: '#92400E', borderColor: '#FDE68A' }}>Others: {note}</span>}
                </div>
              </div>
            );
          })}
          {SECTIONS.every((s) => s.items.every((it) => !sub.symptoms?.[it.id]) && !sub.others?.[s.id]) && (
            <p style={{ color: 'var(--text-muted)' }}>No symptoms were ticked.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <div className="input-label">{label}</div>
      <div className="input-field" style={{ background: 'var(--surface-alt)', minHeight: 'auto', padding: '0.65rem 0.9rem' }}>
        {value || '—'}
      </div>
    </div>
  );
}

// ---- Main dashboard -------------------------------------------------------
export default function DoctorDashboard() {
  const navigate = useNavigate();
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate('/clinic/login', { replace: true });
    }
  }, [navigate]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setSubs(await listSubmissions());
    } catch (err) {
      setError(err.message || 'Failed to load submissions.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const patientLink = `${window.location.origin}/intake`;

  function copyLink() {
    navigator.clipboard?.writeText(patientLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return subs;
    return subs.filter((s) =>
      [s.name, s.patientId, s.encounterId, s.complaint]
        .filter(Boolean)
        .some((f) => f.toLowerCase().includes(q)),
    );
  }, [subs, query]);

  async function handleDelete(e, id) {
    e.stopPropagation();
    if (!window.confirm('Delete this submission? This cannot be undone.')) return;
    await deleteSubmission(id);
    setSubs((list) => list.filter((s) => s.id !== id));
  }

  function handleLogout() {
    logout();
    navigate('/clinic/login', { replace: true });
  }

  return (
    <div className="pf-page" style={{ maxWidth: 1000 }}>
      {/* Header */}
      <div className="flex-between pf-no-print" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: '#EFF6FF', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Stethoscope size={26} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.5rem', lineHeight: 1.1 }}>Patient Intake Dashboard</h2>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{CLINIC.name}</div>
          </div>
        </div>
        <button className="btn btn-secondary" onClick={handleLogout}>
          <LogOut size={18} /> Sign out
        </button>
      </div>

      {selected ? (
        <SubmissionDetail sub={selected} onBack={() => setSelected(null)} />
      ) : (
        <>
          {/* Shareable link */}
          <div className="pf-link-box pf-no-print">
            <FileText size={20} style={{ color: 'var(--primary)', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>Patient form link</div>
              <code>{patientLink}</code>
            </div>
            <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={copyLink}>
              {copied ? (<><Check size={18} /> Copied</>) : (<><Copy size={18} /> Copy link</>)}
            </button>
          </div>

          {!isSupabaseConfigured && (
            <div
              className="glass-panel pf-no-print"
              style={{ display: 'flex', gap: '0.6rem', padding: '0.85rem 1rem', marginBottom: '1.25rem', background: '#FEF3C7', borderColor: '#FDE68A', color: '#92400E' }}
            >
              <AlertTriangle size={20} style={{ flexShrink: 0 }} />
              <span>
                <strong>Demo mode (this device only).</strong> Supabase isn't
                configured, so submissions are stored in this browser and won't
                sync from a patient's phone. Add Supabase keys to enable the real
                shared link flow — see <code>PATIENT_FORM.md</code>.
              </span>
            </div>
          )}

          {/* Toolbar */}
          <div className="pf-toolbar pf-no-print">
            <div style={{ position: 'relative', flex: '1 1 260px' }}>
              <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="input-field"
                style={{ paddingLeft: 40, maxWidth: '100%' }}
                placeholder="Search by name, patient ID, complaint…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button className="btn btn-secondary" onClick={load}>
              <RefreshCw size={18} /> Refresh
            </button>
          </div>

          {error && (
            <div className="glass-panel" style={{ padding: '0.85rem 1rem', marginBottom: '1rem', color: 'var(--danger)', fontWeight: 600 }}>
              {error}
            </div>
          )}

          {/* List */}
          {loading ? (
            <p className="pf-empty">Loading submissions…</p>
          ) : filtered.length === 0 ? (
            <div className="pf-empty">
              <ClipboardEmpty />
              <p style={{ marginTop: '0.75rem' }}>
                {subs.length === 0
                  ? 'No patient forms submitted yet. Share the link above to get started.'
                  : 'No submissions match your search.'}
              </p>
            </div>
          ) : (
            <div className="pf-sublist">
              <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                {filtered.length} submission{filtered.length === 1 ? '' : 's'}
              </div>
              {filtered.map((s) => {
                const count = Object.values(s.symptoms || {}).filter(Boolean).length;
                return (
                  <div className="glass-panel pf-subcard" key={s.id} onClick={() => setSelected(s)}>
                    <div className="flex-between" style={{ gap: '1rem' }}>
                      <div style={{ minWidth: 0 }}>
                        <h3>{s.name || 'Unnamed patient'}</h3>
                        <div className="pf-sub-meta">
                          {s.age && <span>Age {s.age}</span>}
                          {s.sex && <span>{s.sex}</span>}
                          {s.patientId && <span>ID: {s.patientId}</span>}
                          <span>{fmt(s.createdAt)}</span>
                        </div>
                        {s.complaint && (
                          <div style={{ marginTop: 6, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                            <em>C/o:</em> {s.complaint}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                        <span className="badge badge-warning">{count} symptom{count === 1 ? '' : 's'}</span>
                        <button
                          className="btn btn-secondary"
                          style={{ minHeight: 40, padding: '0.4rem 0.7rem', color: 'var(--danger)' }}
                          onClick={(e) => handleDelete(e, s.id)}
                          title="Delete submission"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ClipboardEmpty() {
  return (
    <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--surface-alt)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
      <FileText size={30} />
    </div>
  );
}
