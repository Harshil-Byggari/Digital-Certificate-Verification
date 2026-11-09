import { useEffect, useState } from 'react';
import CrudPage from '../../components/CrudPage.jsx';
import RevokeModal from '../../components/RevokeModal.jsx';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext.jsx';
import { d } from '../../utils';

// Revocation is 1:1 with a certificate. Records are created by revoking a certificate (here or on the Certificates page).
export default function Revocations() {
  const { user } = useAuth();
  const [certs, setCerts] = useState([]);
  const [open, setOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => { if (user.role === 'admin') api.get('/certificates').then(setCerts).catch(() => {}); }, [refresh]);

  return (
    <>
      <CrudPage
        title="Revocations" singular="Revocation" endpoint="/revocations" idKey="revocation_id" readOnly refreshKey={refresh}
        dateFilter={{ key: 'revoked_date' }}
        extraTop={user.role === 'admin' && <div className="toolbar"><button className="btn danger" onClick={() => setOpen(true)}>Revoke a certificate</button></div>}
        columns={[
          { key: 'revocation_id', label: 'ID' },
          { key: 'certificate_no', label: 'Cert No.', render: (r) => r.certificate_no || (r.certificate_id ? `#${r.certificate_id}` : '—') },
          { key: 'title', label: 'Title' },
          { key: 'applicant_name', label: 'Applicant' },
          { key: 'reason', label: 'Reason' },
          { key: 'revoked_date', label: 'Revoked on', render: (r) => d(r.revoked_date) },
        ]}
      />
      {open && <RevokeModal certificates={certs} onClose={() => setOpen(false)} onDone={() => { setOpen(false); setRefresh((n) => n + 1); }} />}
    </>
  );
}
