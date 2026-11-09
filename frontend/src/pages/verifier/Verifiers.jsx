import { useState } from 'react';
import CrudPage from '../../components/CrudPage.jsx';
import Modal from '../../components/Modal.jsx';
import Badge from '../../components/Badge.jsx';
import useFetch from '../../components/useFetch.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { d, fullName } from '../../utils';

function Profile({ row, onClose }) {
  const id = row.verifier_id;
  const res = useFetch([`/verifiers/${id}`, `/verifiers/${id}/verifications`]);
  const [v, vers] = res || [];
  const p = v || row;
  return (
    <Modal title={`Verifier profile — ${fullName(p)}`} onClose={onClose} wide>
      {!res ? <p className="muted">Loading…</p> : (
        <>
          <dl className="kv">
            <div><dt>Verifier ID</dt><dd>{p.verifier_id}</dd></div>
            <div><dt>Name</dt><dd>{fullName(p)}</dd></div>
            <div><dt>Role</dt><dd>{p.role}</dd></div>
            <div><dt>Type</dt><dd>{p.verifier_type}</dd></div>
            <div><dt>Organization</dt><dd>{p.organization}</dd></div>
            <div><dt>Date of joining</dt><dd>{d(p.doj)}</dd></div>
            <div><dt>Aadhar</dt><dd>{p.aadhar_card}</dd></div>
            <div><dt>Address</dt><dd>{[p.street, p.city, p.state, p.pincode].filter(Boolean).join(', ') || '—'}</dd></div>
            <div><dt>Managed by</dt><dd>{p.hr_id ? `HR #${p.hr_id}` : '—'}</dd></div>
          </dl>
          <h4 className="section">Contact</h4>
          <p className="muted">Emails</p>
          <div className="chips">{(p?.emails || []).map((e) => <span className="chip" key={e}>{e}</span>)}{!p?.emails?.length && '—'}</div>
          <p className="muted">Phones</p>
          <div className="chips">{(p?.phones || []).map((e) => <span className="chip" key={e}>{e}</span>)}{!p?.phones?.length && '—'}</div>
          <h4 className="section">Verifications performed ({vers?.length || 0})</h4>
          {vers?.length ? (
            <table className="mini"><thead><tr><th>Time</th><th>Certificate</th><th>Result</th><th>Method</th></tr></thead>
              <tbody>{vers.map((x) => <tr key={x.verification_id}><td>{String(x.verification_time || '').replace('T', ' ').slice(0, 19)}</td><td>{x.certificate_no || x.reference_text || (x.certificate_id ? `#${x.certificate_id}` : '—')}</td><td><Badge value={x.result} /></td><td>{x.method}</td></tr>)}</tbody></table>
          ) : <p className="muted">None yet.</p>}
        </>
      )}
    </Modal>
  );
}

export default function Verifiers() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [profile, setProfile] = useState(null);

  const fields = [
    { key: 'first_name', label: 'First name', required: true, section: 'Name' },
    { key: 'middle_name', label: 'Middle name' },
    { key: 'last_name', label: 'Last name', required: true },
    { key: 'aadhar_card', label: 'Aadhar card', required: true, section: 'Profile', pattern: '^\\d{12}$', patternMsg: 'Aadhar must be exactly 12 digits' },
    { key: 'doj', label: 'Date of joining', type: 'date', required: true },
    { key: 'role', label: 'Role', required: true },
    { key: 'verifier_type', label: 'Verifier type', required: true, options: ['INTERNAL', 'EXTERNAL', 'Employer', 'Institution', 'Government', 'Agency'] },
    { key: 'organization', label: 'Organization', required: true },
    { key: 'street', label: 'Street', section: 'Address', full: true },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' },
    { key: 'pincode', label: 'Pincode', pattern: '^\\d{6}$', patternMsg: 'Pincode must be 6 digits' },
    ...(isAdmin ? [{ key: 'hr_id', label: 'Managed by HR', required: true, section: 'Relationship', optionsEndpoint: '/hr', optionValue: 'hr_id', optionLabel: (r) => (r.hr_name ? `${r.hr_name} (#${r.hr_id})` : `HR #${r.hr_id}`) }] : []),
    { key: 'username', label: 'Login username', createOnly: true, section: 'Login' },
    { key: 'password', label: 'Initial password (login)', type: 'password', createOnly: true, section: 'Login' },
  ];

  return (
    <>
      <CrudPage
        title="Verifiers" singular="Verifier" endpoint="/verifiers" idKey="verifier_id" contacts
        readOnly={!isAdmin}
        fields={fields}
        rowActions={(r) => <button className="btn ghost small" onClick={() => setProfile(r)}>Profile</button>}
        columns={[
          { key: 'verifier_id', label: 'ID' },
          { key: 'name', label: 'Name', render: fullName },
          { key: 'role', label: 'Role' },
          { key: 'verifier_type', label: 'Type' },
          { key: 'organization', label: 'Organization' },
          { key: 'doj', label: 'Joined', render: (r) => d(r.doj) },
          { key: 'hr_id', label: 'HR', render: (r) => (r.hr_id ? `#${r.hr_id}` : '—') },
        ]}
      />
      {profile && <Profile row={profile} onClose={() => setProfile(null)} />}
    </>
  );
}
