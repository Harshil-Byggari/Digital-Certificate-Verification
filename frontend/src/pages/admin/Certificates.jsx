import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import CrudPage from '../../components/CrudPage.jsx';
import Modal from '../../components/Modal.jsx';
import Badge from '../../components/Badge.jsx';
import RevokeModal from '../../components/RevokeModal.jsx';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext.jsx';
import { fullName, today } from '../../utils';


// The public page Manideep builds; the QR encodes this link.
const verifyUrl = (c) => `${window.location.origin}/verify?ref=${encodeURIComponent(c?.certificate_no || '')}`;

function Detail({ cert, onClose }) {
  const [full, setFull] = useState(cert);
  const [sig, setSig] = useState(null);
  const [qr, setQr] = useState(null);
  useEffect(() => {
    const id = cert.certificate_id;
    api.get(`/certificates/${id}`).then(setFull).catch(() => {});
    api.get(`/certificates/${id}/signature`).then(setSig).catch(() => {});
    api.get(`/certificates/${id}/qr`).then((q) => setQr(q?.verify_url)).catch(() => {});
  }, [cert.certificate_id]);
  const c = full;
  const qrTarget = qr || verifyUrl(c);
  return (
    <Modal title={`Certificate ${c.certificate_no || ''}`} onClose={onClose} wide>
      <div className="detail-grid">
        <div>
          <dl className="kv">
            <div><dt>Title</dt><dd>{c.title}</dd></div>
            <div><dt>Status</dt><dd><Badge value={c.status} /></dd></div>
            <div><dt>Applicant</dt><dd>{c.applicant_name || c.applicant_id}</dd></div>
            <div><dt>Issuer</dt><dd>{c.issuer_name || c.issuer_id}</dd></div>
            <div><dt>Type</dt><dd>{c.type_name || c.type_id}</dd></div>
            <div><dt>Issue date</dt><dd>{String(c.issue_date || '—').slice(0, 10)}</dd></div>
            <div><dt>Expiry date</dt><dd>{String(c.expiry_date || '—').slice(0, 10)}</dd></div>
            <div><dt>Document</dt><dd>{c.document_url ? <a href={c.document_url} target="_blank" rel="noreferrer">Open document</a> : '—'}</dd></div>
          </dl>
        </div>
        <div className="qr-box">
          <QRCodeSVG value={qrTarget} size={160} />
          <small className="muted">Scan to verify</small>
        </div>
      </div>
      <h4 className="section">Integrity</h4>
      <dl className="kv">
        <div><dt>Certificate hash</dt><dd><code className="wrap">{sig?.certificate_hash || c.certificate_hash || '—'}</code></dd></div>
        <div><dt>Digital signature</dt><dd><code className="wrap">{sig?.digital_signature || c.digital_signature || '—'}</code></dd></div>
        <div><dt>Hash check</dt><dd>{sig?.hash_valid === undefined ? '—' : <Badge value={sig.hash_valid ? 'Valid' : 'Invalid'} />}</dd></div>
        <div><dt>Signature check</dt><dd>{sig?.signature_valid === undefined ? '—' : <Badge value={sig.signature_valid ? 'Valid' : 'Invalid'} />}</dd></div>
      </dl>
      {c.revocation_reason && (
        <>
          <h4 className="section">Revocation</h4>
          <dl className="kv">
            <div><dt>Reason</dt><dd>{c.revocation_reason}</dd></div>
            <div><dt>Revoked on</dt><dd>{String(c.revoked_date || '—').slice(0, 10)}</dd></div>
          </dl>
        </>
      )}
    </Modal>
  );
}

export default function Certificates() {
  const { user } = useAuth();
  const readOnly = user.role !== 'admin';
  const [viewing, setViewing] = useState(null);
  const [revoking, setRevoking] = useState(null);
  const [refresh, setRefresh] = useState(0);

  return (
    <>
      <CrudPage
        title="Certificates" singular="Certificate" endpoint="/certificates" idKey="certificate_id" readOnly={readOnly}
        refreshKey={refresh}
        filters={[{ key: 'status', label: 'statuses', options: ['VALID', 'EXPIRED', 'REVOKED', 'DRAFT'] }]}
        // Create the record, then ask the backend to issue it (hash + signature + QR are generated server-side)
        afterCreate={async (created) => { const id = created?.certificate_id ?? created?.id; if (id) await api.post(`/certificates/${id}/issue`); }}
        fields={[
          { key: 'title', label: 'Title', required: true, section: 'Certificate' },
          { key: 'applicant_id', label: 'Applicant', required: true, section: 'Relationships', optionsEndpoint: '/applicants', optionValue: 'applicant_id', optionLabel: (r) => `${fullName(r)} (#${r.applicant_id})` },
          { key: 'issuer_id', label: 'Issuer', required: true, optionsEndpoint: user.role === 'admin' ? '/issuers' : undefined, optionValue: 'issuer_id', optionLabel: (r) => `${r.issuer_name} — ${r.organisation}` },
          { key: 'type_id', label: 'Certificate type', required: true, optionsEndpoint: '/types', optionValue: 'type_id', optionLabel: (r) => r.type_name },
          { key: 'document_url', label: 'Document URL', type: 'url', full: true, section: 'Document & validity' },
          { key: 'issue_date', label: 'Issue date', type: 'date', required: true },
          { key: 'expiry_date', label: 'Expiry date', type: 'date' },
        ]}
        columns={[
          { key: 'certificate_no', label: 'Cert No.' },
          { key: 'title', label: 'Title' },
          { key: 'applicant', label: 'Applicant', render: (r) => r.applicant_name || r.applicant_id },
          { key: 'issuer', label: 'Issuer', render: (r) => r.issuer_name || r.issuer_id },
          { key: 'type', label: 'Type', render: (r) => r.type_name || r.type_id },
          { key: 'issue_date', label: 'Issued', render: (r) => String(r.issue_date || '—').slice(0, 10) },
          { key: 'expiry_date', label: 'Expires', render: (r) => String(r.expiry_date || '—').slice(0, 10) },
          { key: 'status', label: 'Status', render: (r) => <Badge value={r.status} /> },
        ]}
        rowActions={(r) => (
          <>
            <button className="btn ghost small" onClick={() => setViewing(r)}>Details</button>
            {!readOnly && String(r.status).toLowerCase() !== 'revoked' && <button className="btn danger small" onClick={() => setRevoking(r)}>Revoke</button>}
          </>
        )}
      />
      {viewing && <Detail cert={viewing} onClose={() => setViewing(null)} />}
      {revoking && <RevokeModal cert={revoking} onClose={() => setRevoking(null)} onDone={() => { setRevoking(null); setRefresh((n) => n + 1); }} />}
    </>
  );
}
