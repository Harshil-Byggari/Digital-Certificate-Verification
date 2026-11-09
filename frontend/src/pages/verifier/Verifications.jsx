import { useEffect, useState } from 'react';
import CrudPage from '../../components/CrudPage.jsx';
import Modal from '../../components/Modal.jsx';
import Badge from '../../components/Badge.jsx';
import RecordView from '../../components/RecordView.jsx';
import { api } from '../../services/api';

// Shows the verification plus the certificate it checked and the verifier who ran it.
function Linked({ row, onClose }) {
  const id = row.verification_id;
  const [ver, setVer] = useState(row);
  const [cert, setCert] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api.get(`/verifications/${id}`)
      .then((v) => {
        if (!alive) return;
        setVer(v);
        if (v?.certificate_id) {
          api.get(`/certificates/${v.certificate_id}`)
            .then((c) => { if (alive) setCert(c); })
            .catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  const v = ver || row;
  return (
    <Modal title={`Verification #${id}`} onClose={onClose} wide>
      {loading ? <p className="muted">Loading…</p> : (
        <>
          <RecordView row={v} />
          <h4 className="section">Certificate checked</h4>
          {cert ? <RecordView row={cert} /> : <p className="muted">{v.certificate_no || v.reference_text || 'Not available'}</p>}
          <h4 className="section">Verifier</h4>
          <p className="muted">{v.verifier_name || (v.verifier_id ? `Verifier #${v.verifier_id}` : 'Public verification (no logged-in verifier)')}</p>
        </>
      )}
    </Modal>
  );
}

export default function Verifications() {
  const [open, setOpen] = useState(null);
  return (
    <>
      <CrudPage
        title="Verifications" singular="Verification" endpoint="/verifications" idKey="verification_id" readOnly
        dateFilter={{ key: 'verification_time' }}
        filters={[
          { key: 'result', label: 'results', options: ['VALID', 'EXPIRED', 'REVOKED', 'TAMPERED', 'INVALID'] },
          { key: 'method', label: 'methods', options: ['MANUAL', 'QR', 'API'] },
        ]}
        rowActions={(r) => <button className="btn ghost small" onClick={() => setOpen(r)}>Linked records</button>}
        columns={[
          { key: 'verification_id', label: 'ID' },
          { key: 'verification_time', label: 'Time', render: (r) => String(r.verification_time || '—').replace('T', ' ').slice(0, 19) },
          { key: 'certificate_no', label: 'Certificate', render: (r) => r.certificate_no || r.reference_text || (r.certificate_id ? `#${r.certificate_id}` : '—') },
          { key: 'verifier', label: 'Verifier', render: (r) => r.verifier_name || (r.verifier_id ? `Verifier #${r.verifier_id}` : 'Public') },
          { key: 'result', label: 'Result', render: (r) => <Badge value={r.result} /> },
          { key: 'method', label: 'Method' },
          { key: 'ip_address', label: 'IP' },
          { key: 'remarks', label: 'Remarks' },
        ]}
      />
      {open && <Linked row={open} onClose={() => setOpen(null)} />}
    </>
  );
}
