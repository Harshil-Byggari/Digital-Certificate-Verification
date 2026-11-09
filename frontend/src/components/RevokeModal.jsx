import { useState } from 'react';
import Modal from './Modal.jsx';
import { api } from '../services/api';

// POST /certificates/:id/revoke  { reason }
export default function RevokeModal({ cert, certificates, onClose, onDone }) {
  const [id, setId] = useState(cert?.certificate_id || '');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!id) {
      setErr('Please select a certificate to revoke');
      return;
    }
    if (reason.trim().length < 5) {
      setErr('Reason must be at least 5 characters');
      return;
    }
    setBusy(true); setErr('');
    try {
      await api.post(`/certificates/${id}/revoke`, { reason: reason.trim() });
      onDone();
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={cert ? `Revoke ${cert.certificate_no}` : 'Revoke a certificate'} onClose={onClose}>
      <form onSubmit={submit} className="form-grid">
        {!cert && (
          <div className="field full"><label>Certificate *</label>
            <select required value={id} onChange={(e) => setId(e.target.value)}>
              <option value="">Select…</option>
              {(certificates || []).filter((c) => String(c.status).toUpperCase() !== 'REVOKED')
                .map((c) => <option key={c.certificate_id} value={c.certificate_id}>{c.certificate_no} — {c.title}</option>)}
            </select>
          </div>
        )}
        <div className="field full"><label>Reason *</label><textarea rows={3} required minLength={5} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Minimum 5 characters" /></div>
        {err && <div className="alert full">{err}</div>}
        <div className="form-actions full">
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn danger" disabled={busy}>{busy ? 'Revoking…' : 'Revoke certificate'}</button>
        </div>
      </form>
    </Modal>
  );
}
