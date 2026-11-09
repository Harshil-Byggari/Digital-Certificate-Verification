import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const NAV = [
  { to: '/admin', label: 'Dashboard', roles: ['admin'], end: true },
  { to: '/admin/applicants', label: 'Applicants', roles: ['admin'] },
  { to: '/admin/certificates', label: 'Certificates', roles: ['admin'] },
  { to: '/admin/types', label: 'Certificate Types', roles: ['admin'] },
  { to: '/admin/issuers', label: 'Issuers', roles: ['admin'] },
  { to: '/admin/revocations', label: 'Revocations', roles: ['admin'] },
  { to: '/admin/verifiers', label: 'Verifiers', roles: ['admin', 'hr'] },
  { to: '/admin/hr', label: 'HR', roles: ['admin', 'hr'] },
  { to: '/admin/verifications', label: 'Verifications', roles: ['admin', 'hr', 'verifier'] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">Certificate Verification System</div>
        <nav>
          {NAV.filter((n) => n.roles.includes(user.role)).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : '')}>{n.label}</NavLink>
          ))}
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <span className="muted">Signed in as <b>{user.username || user.account_id || user.user_id}</b> ({user.role})</span>
          <button className="btn ghost" onClick={async () => { await logout(); navigate('/login'); }}>Logout</button>
        </header>
        <main className="content"><Outlet /></main>
      </div>
    </div>
  );
}
