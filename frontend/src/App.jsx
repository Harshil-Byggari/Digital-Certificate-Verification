import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './layouts/Layout.jsx';
import MainLayout from './layouts/MainLayout.jsx';
import HomePage from './pages/public/HomePage.jsx';
import VerifyPage from './pages/public/VerifyPage.jsx';
import Login from './pages/admin/Login.jsx';
import Dashboard from './pages/admin/Dashboard.jsx';
import Applicants from './pages/admin/Applicants.jsx';
import CertificateTypes from './pages/admin/CertificateTypes.jsx';
import Certificates from './pages/admin/Certificates.jsx';
import Issuers from './pages/admin/Issuers.jsx';
import Revocations from './pages/admin/Revocations.jsx';
import Verifiers from './pages/verifier/Verifiers.jsx';
import Verifications from './pages/verifier/Verifications.jsx';
import HRPage from './pages/hr/HRPage.jsx';
import ApplicantDashboard from './pages/applicant/ApplicantDashboard.jsx';
import CertificateDetailPage from './pages/applicant/CertificateDetailPage.jsx';
import ApplicantProfilePage from './pages/applicant/ApplicantProfilePage.jsx';

const HOME_ROUTES = {
  admin: '/admin',
  hr: '/admin/hr',
  verifier: '/admin/verifications',
  applicant: '/portal',
};

function Guard({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="login-page">
        <p className="muted">Loading session…</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    const fallback = HOME_ROUTES[user.role] || '/login';
    return <Navigate to={fallback} replace />;
  }
  return children;
}

function FallbackRoute() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="login-page">
        <p className="muted">Loading session…</p>
      </div>
    );
  }
  if (!user) return <Navigate to="/" replace />;
  return <Navigate to={HOME_ROUTES[user.role] || '/'} replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Public & Applicant Pages (MainLayout) */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/verify" element={<VerifyPage />} />

        {/* Applicant Portal (Stage M5) */}
        <Route
          path="/portal"
          element={
            <Guard roles={['applicant']}>
              <ApplicantDashboard />
            </Guard>
          }
        />
        <Route
          path="/portal/certificates/:id"
          element={
            <Guard roles={['applicant']}>
              <CertificateDetailPage />
            </Guard>
          }
        />
        <Route
          path="/portal/profile"
          element={
            <Guard roles={['applicant']}>
              <ApplicantProfilePage />
            </Guard>
          }
        />

        {/* Navigation Aliases for /applicant */}
        <Route path="/applicant" element={<Navigate to="/portal" replace />} />
        <Route path="/applicant/dashboard" element={<Navigate to="/portal" replace />} />
        <Route path="/applicant/certificates/:id" element={<Navigate to="/portal/certificates/:id" replace />} />
        <Route path="/applicant/profile" element={<Navigate to="/portal/profile" replace />} />
      </Route>

      <Route path="/login" element={<Login />} />

      {/* Admin / Staff Pages (Stage M3) */}
      <Route path="/admin" element={<Guard roles={['admin', 'hr', 'verifier']}><Layout /></Guard>}>
        <Route index element={<Guard roles={['admin']}><Dashboard /></Guard>} />
        <Route path="applicants" element={<Guard roles={['admin']}><Applicants /></Guard>} />
        <Route path="types" element={<Guard roles={['admin']}><CertificateTypes /></Guard>} />
        <Route path="certificates" element={<Guard roles={['admin']}><Certificates /></Guard>} />
        <Route path="issuers" element={<Guard roles={['admin']}><Issuers /></Guard>} />
        <Route path="revocations" element={<Guard roles={['admin']}><Revocations /></Guard>} />
        <Route path="verifiers" element={<Guard roles={['admin', 'hr']}><Verifiers /></Guard>} />
        <Route path="hr" element={<Guard roles={['admin', 'hr']}><HRPage /></Guard>} />
        <Route path="verifications" element={<Guard roles={['admin', 'hr', 'verifier']}><Verifications /></Guard>} />
      </Route>

      <Route path="*" element={<FallbackRoute />} />
    </Routes>
  );
}
