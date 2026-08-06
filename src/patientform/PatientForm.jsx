import { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, Loader2 } from 'lucide-react';
import { CLINIC, HISTORY_QUESTIONS, SECTIONS } from './formSchema';
import { saveSubmission } from './store';
import './patientform.css';

// Clinic letterhead reused on the form and the success screen.
function Letterhead() {
  return (
    <div className="glass-panel pf-letterhead">
      <div className="pf-campaign">{CLINIC.campaign}</div>
      <div className="pf-clinic-name">{CLINIC.name}</div>
      <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{CLINIC.unit}</div>
      <div className="pf-division">{CLINIC.division}</div>
      <div className="pf-doctor">
        {CLINIC.doctor}
        <small>{CLINIC.qualification}</small>
        <small>{CLINIC.regd}</small>
      </div>
    </div>
  );
}

export default function PatientForm() {
  const [patient, setPatient] = useState({
    encounterId: '',
    patientId: '',
    name: '',
    age: '',
    sex: '',
    visitDate: '',
    visitTime: '',
    complaint: '',
  });
  const [history, setHistory] = useState({}); // { travel: 'yes'|'no', substance: ... }
  const [symptoms, setSymptoms] = useState({}); // { itemId: true }
  const [others, setOthers] = useState({}); // { sectionId: text }

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const selectedCount = useMemo(
    () => Object.values(symptoms).filter(Boolean).length,
    [symptoms],
  );

  const setField = (key, value) => setPatient((p) => ({ ...p, [key]: value }));
  const toggleSymptom = (id) =>
    setSymptoms((s) => ({ ...s, [id]: !s[id] }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!patient.name.trim()) {
      setError('Please enter your name before submitting.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setSubmitting(true);
    try {
      // Keep only checked symptoms and non-empty "others" notes.
      const checked = Object.fromEntries(
        Object.entries(symptoms).filter(([, v]) => v),
      );
      const notes = Object.fromEntries(
        Object.entries(others).filter(([, v]) => v && v.trim()),
      );
      await saveSubmission({
        ...patient,
        history,
        symptoms: checked,
        others: notes,
      });
      setDone(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.message || 'Could not submit the form. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="pf-page fade-in">
        <Letterhead />
        <div className="glass-panel pf-success">
          <div className="pf-tick">
            <CheckCircle2 size={48} />
          </div>
          <h2 style={{ marginBottom: '0.5rem' }}>Thank you, {patient.name}!</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem' }}>
            Your symptom form has been submitted to the clinic. The doctor will
            review your details. You can now close this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form className="pf-page fade-in" onSubmit={handleSubmit}>
      <Letterhead />

      {error && (
        <div
          className="glass-panel"
          style={{
            padding: '0.9rem 1.15rem',
            marginBottom: '1rem',
            borderColor: 'var(--danger)',
            color: 'var(--danger)',
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      {/* Patient details ------------------------------------------------ */}
      <div className="glass-panel pf-section">
        <div className="pf-section-title">
          <ClipboardList size={18} style={{ verticalAlign: '-3px', marginRight: 6 }} />
          Your Details
        </div>
        <div className="form-grid">
          <div>
            <label className="input-label">Name *</label>
            <input
              className="input-field"
              value={patient.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="Full name"
            />
          </div>
          <div>
            <label className="input-label">Age</label>
            <input
              className="input-field"
              value={patient.age}
              onChange={(e) => setField('age', e.target.value)}
              placeholder="e.g. 34"
              inputMode="numeric"
            />
          </div>
          <div>
            <label className="input-label">Sex</label>
            <select
              className="input-field"
              value={patient.sex}
              onChange={(e) => setField('sex', e.target.value)}
            >
              <option value="">Select</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="input-label">Visit Date</label>
            <input
              type="date"
              className="input-field"
              value={patient.visitDate}
              onChange={(e) => setField('visitDate', e.target.value)}
            />
          </div>
          <div>
            <label className="input-label">Time</label>
            <input
              type="time"
              className="input-field"
              value={patient.visitTime}
              onChange={(e) => setField('visitTime', e.target.value)}
            />
          </div>
          <div>
            <label className="input-label">Encounter ID</label>
            <input
              className="input-field"
              value={patient.encounterId}
              onChange={(e) => setField('encounterId', e.target.value)}
              placeholder="If provided by clinic"
            />
          </div>
          <div>
            <label className="input-label">Patient ID</label>
            <input
              className="input-field"
              value={patient.patientId}
              onChange={(e) => setField('patientId', e.target.value)}
              placeholder="If provided by clinic"
            />
          </div>
        </div>
        <div style={{ marginTop: '1rem' }}>
          <label className="input-label">Patient Presented with Complaint of (C/o)</label>
          <textarea
            className="input-field"
            style={{ minHeight: 80, resize: 'vertical' }}
            value={patient.complaint}
            onChange={(e) => setField('complaint', e.target.value)}
            placeholder="Briefly describe why you are visiting"
          />
        </div>
      </div>

      {/* History Yes/No ------------------------------------------------- */}
      <div className="glass-panel pf-section">
        <div className="pf-section-title">History</div>
        {HISTORY_QUESTIONS.map((q) => (
          <div className="pf-history-row" key={q.id}>
            <div className="pf-history-label">{q.label}</div>
            <div className="pf-yesno">
              <button
                type="button"
                className={`yes ${history[q.id] === 'yes' ? 'active' : ''}`}
                onClick={() => setHistory((h) => ({ ...h, [q.id]: 'yes' }))}
              >
                Yes
              </button>
              <button
                type="button"
                className={`no ${history[q.id] === 'no' ? 'active' : ''}`}
                onClick={() => setHistory((h) => ({ ...h, [q.id]: 'no' }))}
              >
                No
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Symptom sections ---------------------------------------------- */}
      <p style={{ margin: '0 0.25rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
        Tick every symptom you are experiencing.
      </p>
      {SECTIONS.map((section) => (
        <div className="glass-panel pf-section" key={section.id}>
          <div className="pf-section-title">{section.title}</div>
          <div className="pf-checkgrid">
            {section.items.map((item) => {
              const on = !!symptoms[item.id];
              return (
                <label key={item.id} className={`pf-check ${on ? 'checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggleSymptom(item.id)}
                  />
                  <span>{item.label}</span>
                </label>
              );
            })}
          </div>
          {section.others && (
            <div className="pf-others">
              <label className="input-label">Others (please specify)</label>
              <input
                className="input-field"
                value={others[section.id] || ''}
                onChange={(e) =>
                  setOthers((o) => ({ ...o, [section.id]: e.target.value }))
                }
                placeholder="Any other symptom in this group"
              />
            </div>
          )}
        </div>
      ))}

      {/* Submit -------------------------------------------------------- */}
      <div className="pf-submitbar">
        <span className="pf-selected-count">{selectedCount} symptom{selectedCount === 1 ? '' : 's'} selected</span>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 size={18} className="pf-spin" /> Submitting…
            </>
          ) : (
            'Submit to Clinic'
          )}
        </button>
      </div>
    </form>
  );
}
