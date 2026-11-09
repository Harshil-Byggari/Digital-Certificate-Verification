import { useEffect, useState } from 'react';
import CrudPage from '../../components/CrudPage.jsx';
import Modal from '../../components/Modal.jsx';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext.jsx';
import { d, fullName } from '../../utils';

// Salary is DERIVED: basic + da + hra.
const salaryOf = (r) => r?.salary ?? Number(r?.basic || 0) + Number(r?.da || 0) + Number(r?.hra || 0);
const money = (n) => `₹ ${Number(n || 0).toLocaleString('en-IN')}`;

// HR -> Verifier management (1:N). Assigning sets verifier.hr_id (ADMIN only).
function Managed({ hr, onClose, isAdmin }) {
  const [list, setList] = useState(null);
  const [all, setAll] = useState([]);
  const [pick, setPick] = useState('');
  const [err, setErr] = useState('');
  const load = () => api.get(`/hr/${hr.hr_id}/verifiers`).then(setList).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
    if (isAdmin) {
      api.get('/verifiers').then(setAll).catch(() => {});
    }
  }, [hr.hr_id, isAdmin]);

  async function assign() {
    if (!pick) return;
    setErr('');
    try {
      const v = await api.get(`/verifiers/${pick}`);
      await api.put(`/verifiers/${pick}`, { ...v, hr_id: hr.hr_id });
      setPick(''); load(); if (isAdmin) api.get('/verifiers').then(setAll);
    } catch (e) { setErr(e.message); }
  }
  const available = all.filter((v) => String(v.hr_id) !== String(hr.hr_id));
  const sal = salaryOf(hr);

  return (
    <Modal title={`HR #${hr.hr_id} — managed verifiers`} onClose={onClose} wide>
      <dl className="kv">
        <div><dt>HR Name</dt><dd><b>{hr.hr_name || `HR #${hr.hr_id}`}</b></dd></div>
        <div><dt>Calculated salary</dt><dd><b>{money(sal)}</b></dd></div>
        <div><dt>Leave</dt><dd>{hr.leave_days ?? hr.leave ?? '—'} days</dd></div>
      </dl>
      {err && <div className="alert">{err}</div>}
      <h4 className="section">Verifiers under this HR ({list?.length ?? 0})</h4>
      {!list ? <p className="muted">Loading…</p> : list.length ? (
        <table className="mini"><thead><tr><th>ID</th><th>Name</th><th>Role</th><th>Organization</th></tr></thead>
          <tbody>{list.map((v) => <tr key={v.verifier_id}><td>{v.verifier_id}</td><td>{fullName(v)}</td><td>{v.role}</td><td>{v.organization}</td></tr>)}</tbody></table>
      ) : <p className="muted">No verifiers assigned yet.</p>}
      {isAdmin && (
        <>
          <h4 className="section">Assign a verifier</h4>
          <div className="row-inline">
            <select value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Select verifier…</option>
              {available.map((v) => <option key={v.verifier_id} value={v.verifier_id}>{fullName(v)} ({v.organization}){v.hr_id ? ` — currently HR #${v.hr_id}` : ''}</option>)}
            </select>
            <button className="btn primary" onClick={assign} disabled={!pick}>Assign</button>
          </div>
        </>
      )}
    </Modal>
  );
}

function HRProfileView({ linkedId }) {
  const [hr, setHr] = useState(null);
  const [verifiers, setVerifiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/hr/${linkedId}`),
      api.get(`/hr/${linkedId}/verifiers`),
    ])
      .then(([hrData, verData]) => {
        setHr(hrData);
        setVerifiers(Array.isArray(verData) ? verData : []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [linkedId]);

  if (loading) return <p className="muted">Loading HR profile…</p>;
  if (error) return <div className="alert">{error}</div>;
  if (!hr) return <p className="muted">HR profile not found.</p>;

  return (
    <div>
      <div className="page-head"><h2>HR Profile — {hr.hr_name || `#${hr.hr_id}`}</h2></div>
      <div className="card" style={{ marginBottom: 20 }}>
        <dl className="kv">
          <div><dt>HR ID</dt><dd>{hr.hr_id}</dd></div>
          <div><dt>Name</dt><dd>{hr.hr_name || '—'}</dd></div>
          <div><dt>Basic pay</dt><dd>{money(hr.basic)}</dd></div>
          <div><dt>DA</dt><dd>{money(hr.da)}</dd></div>
          <div><dt>HRA</dt><dd>{money(hr.hra)}</dd></div>
          <div><dt>Calculated Salary</dt><dd><b>{money(salaryOf(hr))}</b></dd></div>
          <div><dt>Leave days</dt><dd>{hr.leave_days ?? '—'} days</dd></div>
          <div><dt>Managed Verifiers</dt><dd>{verifiers.length}</dd></div>
        </dl>
      </div>

      <div className="page-head"><h3>Managed Verifiers ({verifiers.length})</h3></div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Role</th>
              <th>Type</th>
              <th>Organization</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {!verifiers.length && <tr><td colSpan={6} className="muted">No verifiers assigned yet.</td></tr>}
            {verifiers.map((v) => (
              <tr key={v.verifier_id}>
                <td>{v.verifier_id}</td>
                <td>{fullName(v)}</td>
                <td>{v.role}</td>
                <td>{v.verifier_type}</td>
                <td>{v.organization}</td>
                <td>{d(v.doj)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function HRPage() {
  const { user } = useAuth();
  const [managed, setManaged] = useState(null);

  if (user?.role === 'hr') {
    return <HRProfileView linkedId={user.linked_id} />;
  }

  return (
    <>
      <CrudPage
        title="HR" singular="HR record" endpoint="/hr" idKey="hr_id"
        fields={[
          { key: 'hr_name', label: 'HR name', required: true, section: 'Details' },
          { key: 'basic', label: 'Basic pay', type: 'number', required: true, section: 'Salary components' },
          { key: 'da', label: 'DA', type: 'number', required: true },
          { key: 'hra', label: 'HRA', type: 'number', required: true },
          { key: 'leave_days', label: 'Leave (days)', type: 'number', required: true, section: 'Leave' },
          { key: 'username', label: 'Login username', createOnly: true, section: 'Login' },
          { key: 'password', label: 'Initial password (login)', type: 'password', createOnly: true, section: 'Login' },
        ]}
        columns={[
          { key: 'hr_id', label: 'HR ID' },
          { key: 'hr_name', label: 'Name' },
          { key: 'basic', label: 'Basic', render: (r) => money(r.basic) },
          { key: 'da', label: 'DA', render: (r) => money(r.da) },
          { key: 'hra', label: 'HRA', render: (r) => money(r.hra) },
          { key: 'salary', label: 'Salary (calculated)', render: (r) => <b>{money(salaryOf(r))}</b> },
          { key: 'leave_days', label: 'Leave', render: (r) => r.leave_days ?? r.leave ?? '—' },
        ]}
        rowActions={(r) => <button className="btn ghost small" onClick={() => setManaged(r)}>Verifiers</button>}
      />
      {managed && <Managed hr={managed} isAdmin onClose={() => setManaged(null)} />}
    </>
  );
}
