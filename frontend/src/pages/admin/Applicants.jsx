import { useState } from 'react';
import CrudPage from '../../components/CrudPage.jsx';
import Modal from '../../components/Modal.jsx';
import Badge from '../../components/Badge.jsx';
import useFetch from '../../components/useFetch.js';
import { d, fullName } from '../../utils';

const fields = [
  { key: 'first_name', label: 'First name', required: true, section: 'Name' },
  { key: 'middle_name', label: 'Middle name' },
  { key: 'last_name', label: 'Last name', required: true },
  { key: 'dob', label: 'Date of birth', type: 'date', required: true, section: 'Identity' },
  { key: 'aadhar_card', label: 'Aadhar card', required: true, pattern: '^\\d{12}$', patternMsg: 'Aadhar must be exactly 12 digits' },
  { key: 'street', label: 'Street', section: 'Address', full: true },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'pincode', label: 'Pincode', pattern: '^\\d{6}$', patternMsg: 'Pincode must be 6 digits' },
  { key: 'username', label: 'Login username', createOnly: true, section: 'Login' },
  { key: 'password', label: 'Initial password (login)', type: 'password', createOnly: true, section: 'Login' },
];

function Profile({ row, onClose }) {
  const id = row.applicant_id;
  const res = useFetch([`/applicants/${id}`, `/applicants/${id}/certificates`]);
  const [a, certs] = res || [];
  const p = a || row;
  return (
    <Modal title={`Applicant profile — ${fullName(p)}`} onClose={onClose} wide>
      {!res ? <p className="muted">Loading…</p> : (
        <>
          <dl className="kv">
            <div><dt>Applicant ID</dt><dd>{p.applicant_id}</dd></div>
            <div><dt>Name</dt><dd>{fullName(p)}</dd></div>
            <div><dt>Date of birth</dt><dd>{d(p.dob)}</dd></div>
            <div><dt>Aadhar</dt><dd>{p.aadhar_card}</dd></div>
            <div><dt>Address</dt><dd>{[p.street, p.city, p.state, p.pincode].filter(Boolean).join(', ') || '—'}</dd></div>
          </dl>
          <h4 className="section">Contact</h4>
          <p className="muted">Emails</p>
          <div className="chips">{(p?.emails || []).map((e) => <span className="chip" key={e}>{e}</span>)}{!p?.emails?.length && '—'}</div>
          <p className="muted">Phones</p>
          <div className="chips">{(p?.phones || []).map((e) => <span className="chip" key={e}>{e}</span>)}{!p?.phones?.length && '—'}</div>
          <h4 className="section">Certificates received ({certs?.length || 0})</h4>
          {certs?.length ? (
            <table className="mini"><thead><tr><th>No.</th><th>Title</th><th>Issued</th><th>Expires</th><th>Status</th></tr></thead>
              <tbody>{certs.map((c) => <tr key={c.certificate_id}><td>{c.certificate_no}</td><td>{c.title}</td><td>{d(c.issue_date)}</td><td>{d(c.expiry_date)}</td><td><Badge value={c.status} /></td></tr>)}</tbody></table>
          ) : <p className="muted">No certificates yet.</p>}
        </>
      )}
    </Modal>
  );
}

export default function Applicants() {
  const [profile, setProfile] = useState(null);
  return (
    <>
      <CrudPage
        title="Applicants" singular="Applicant" endpoint="/applicants" idKey="applicant_id" contacts fields={fields}
        rowActions={(r) => <button className="btn ghost small" onClick={() => setProfile(r)}>Profile</button>}
        columns={[
          { key: 'applicant_id', label: 'ID' },
          { key: 'name', label: 'Name', render: fullName },
          { key: 'dob', label: 'DOB', render: (r) => d(r.dob) },
          { key: 'aadhar_card', label: 'Aadhar' },
          { key: 'address', label: 'Address', render: (r) => [r.street, r.city, r.state, r.pincode].filter(Boolean).join(', ') || '—' },
        ]}
      />
      {profile && <Profile row={profile} onClose={() => setProfile(null)} />}
    </>
  );
}
