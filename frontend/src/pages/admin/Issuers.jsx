import { useState } from 'react';
import CrudPage from '../../components/CrudPage.jsx';
import Modal from '../../components/Modal.jsx';
import Badge from '../../components/Badge.jsx';
import useFetch from '../../components/useFetch.js';
import { d } from '../../utils';

function IssuedBy({ issuer, onClose }) {
  const res = useFetch([`/issuers/${issuer.issuer_id}/certificates`]);
  const certs = res?.[0];
  return (
    <Modal title={`Certificates issued by ${issuer.issuer_name}`} onClose={onClose} wide>
      <h4 className="section">Public key</h4>
      <code className="wrap">{issuer.public_key}</code>
      <h4 className="section">Issued certificates ({certs?.length ?? 0})</h4>
      {!res ? <p className="muted">Loading…</p> : certs?.length ? (
        <table className="mini"><thead><tr><th>No.</th><th>Title</th><th>Issued</th><th>Status</th></tr></thead>
          <tbody>{certs.map((c) => <tr key={c.certificate_id}><td>{c.certificate_no}</td><td>{c.title}</td><td>{d(c.issue_date)}</td><td><Badge value={c.status} /></td></tr>)}</tbody></table>
      ) : <p className="muted">Nothing issued yet.</p>}
    </Modal>
  );
}

export default function Issuers() {
  const [open, setOpen] = useState(null);
  return (
    <>
      <CrudPage
        title="Issuers" singular="Issuer" endpoint="/issuers" idKey="issuer_id"
        rowActions={(r) => <button className="btn ghost small" onClick={() => setOpen(r)}>Certificates</button>}
        fields={[
          { key: 'issuer_name', label: 'Issuer name', required: true, section: 'Issuer' },
          { key: 'organisation', label: 'Organisation', required: true },
          { key: 'email', label: 'Email', type: 'email', required: true },
          { key: 'phone', label: 'Phone', required: true },
          { key: 'street', label: 'Street', section: 'Address', full: true },
          { key: 'city', label: 'City' },
          { key: 'state', label: 'State' },
          { key: 'pincode', label: 'Pincode', pattern: '^\\d{6}$', patternMsg: 'Pincode must be 6 digits' },
        ]}
        columns={[
          { key: 'issuer_id', label: 'ID' },
          { key: 'issuer_name', label: 'Issuer' },
          { key: 'organisation', label: 'Organisation' },
          { key: 'email', label: 'Email' },
          { key: 'phone', label: 'Phone' },
          { key: 'public_key', label: 'Public key', render: (r) => <code title={r.public_key}>{(r.public_key || '').slice(0, 20)}…</code> },
        ]}
      />
      {open && <IssuedBy issuer={open} onClose={() => setOpen(null)} />}
    </>
  );
}
