import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { 
  Award, ShieldCheck, Clock, XCircle, Search, Filter, 
  ExternalLink, Eye, QrCode, User, FileText, Download, AlertCircle
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function ApplicantDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [certificates, setCertificates] = useState([]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedQR, setSelectedQR] = useState(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const applicantId = user.linked_id;

    Promise.all([
      api.get('/certificates'),
      applicantId ? api.get(`/applicants/${applicantId}`) : Promise.resolve(null)
    ]).then(([certs, prof]) => {
      setCertificates(Array.isArray(certs) ? certs : []);
      setProfile(prof);
      setLoading(false);
    }).catch(err => {
      console.error('Failed to load applicant dashboard data:', err);
      setError(err.message || 'Failed to load applicant credentials from Oracle Database.');
      setLoading(false);
    });
  }, [user, navigate]);

  // Derived metrics from live Oracle data
  const total = certificates.length;
  const active = certificates.filter(c => c.status === 'VALID').length;
  const expired = certificates.filter(c => c.status === 'EXPIRED').length;
  const revoked = certificates.filter(c => c.status === 'REVOKED').length;

  // Filtered certificates
  const filteredCerts = certificates.filter(c => {
    const matchesStatus = filterStatus === 'ALL' || c.status === filterStatus;
    const q = searchQuery.toLowerCase();
    const matchesSearch = 
      (c.title || '').toLowerCase().includes(q) ||
      (c.certificate_no || '').toLowerCase().includes(q) ||
      (c.issuer_name || '').toLowerCase().includes(q) ||
      (c.type_name || '').toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-500 mt-4">Loading applicant credentials from Oracle Database...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-fade-in">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xl shrink-0">
            {profile?.first_name?.[0] || user?.username?.[0]?.toUpperCase() || 'A'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Welcome, {profile?.first_name} {profile?.middle_name ? profile?.middle_name + ' ' : ''}{profile?.last_name || user?.username}
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                Verified Applicant
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Applicant ID: <span className="font-mono">#{profile?.applicant_id || user?.linked_id}</span> • National ID: <span className="font-mono">{profile?.aadhar_card ? `XXXX-XXXX-${profile.aadhar_card.slice(-4)}` : 'On File'}</span>
            </p>
          </div>
        </div>

        <Link
          to="/portal/profile"
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-colors"
        >
          <User className="w-3.5 h-3.5 text-blue-600" />
          <span>Manage Profile & Multivalued Contacts</span>
        </Link>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div 
          onClick={() => setFilterStatus('ALL')}
          className={`p-5 rounded-2xl border cursor-pointer transition-all ${
            filterStatus === 'ALL' ? 'bg-blue-50/50 border-blue-400 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
            <span>Total Issued</span>
            <Award className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{total}</div>
        </div>

        <div 
          onClick={() => setFilterStatus('VALID')}
          className={`p-5 rounded-2xl border cursor-pointer transition-all ${
            filterStatus === 'VALID' ? 'bg-emerald-50 border-emerald-400 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
            <span>Active / Valid</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600">{active}</div>
        </div>

        <div 
          onClick={() => setFilterStatus('EXPIRED')}
          className={`p-5 rounded-2xl border cursor-pointer transition-all ${
            filterStatus === 'EXPIRED' ? 'bg-amber-50 border-amber-400 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
            <span>Expired</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-extrabold text-amber-600">{expired}</div>
        </div>

        <div 
          onClick={() => setFilterStatus('REVOKED')}
          className={`p-5 rounded-2xl border cursor-pointer transition-all ${
            filterStatus === 'REVOKED' ? 'bg-red-50 border-red-400 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
            <span>Revoked</span>
            <XCircle className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-extrabold text-red-600">{revoked}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search credentials by title, number, or issuer..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          />
        </div>

        {/* Status filter tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          {['ALL', 'VALID', 'EXPIRED', 'REVOKED'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterStatus === st ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Certificates List */}
      <div className="space-y-4">
        {filteredCerts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
            <Award className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="font-semibold text-slate-700">No certificates found</h3>
            <p className="text-xs text-slate-500">
              No digital credentials match the selected status filter or search query.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredCerts.map((cert) => (
              <div
                key={cert.certificate_id}
                className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow relative overflow-hidden group"
              >
                {/* Status Bar */}
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider block">
                      {cert.type_name || 'Degree / Credential'}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {cert.title}
                    </h3>
                  </div>

                  {/* Status Badge */}
                  {cert.status === 'VALID' && (
                    <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold flex items-center gap-1 shrink-0">
                      <ShieldCheck className="w-3 h-3" /> Valid
                    </span>
                  )}
                  {cert.status === 'EXPIRED' && (
                    <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-bold flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3" /> Expired
                    </span>
                  )}
                  {cert.status === 'REVOKED' && (
                    <span className="px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded-full text-xs font-bold flex items-center gap-1 shrink-0">
                      <XCircle className="w-3 h-3" /> Revoked
                    </span>
                  )}
                </div>

                {/* Metadata */}
                <div className="space-y-1.5 text-xs text-slate-600">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Certificate No:</span>
                    <span className="font-mono font-medium text-slate-800">{cert.certificate_no}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Issuer:</span>
                    <span className="font-medium text-slate-800">{cert.issuer_name || cert.organisation}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Issue Date:</span>
                    <span className="text-slate-800 font-mono">{cert.issue_date || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Expiry Date:</span>
                    <span className="text-slate-800 font-mono">
                      {cert.expiry_date || 'Lifetime Validity (No Expiry)'}
                    </span>
                  </div>
                </div>

                {/* Revocation Warning if revoked */}
                {cert.status === 'REVOKED' && (
                  <div className="p-2.5 bg-red-50 rounded-xl border border-red-200 text-xs text-red-800">
                    <strong>Revoked:</strong> {cert.revocation_reason || 'Withdrawn by authority'}
                  </div>
                )}

                {/* Actions */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setSelectedQR(cert)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                  >
                    <QrCode className="w-3.5 h-3.5 text-blue-600" />
                    <span>View QR</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {cert.document_url && (
                      <a
                        href={cert.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
                        title="Download / View Conferred Document"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}

                    <Link
                      to={`/portal/certificates/${cert.certificate_id}`}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Details</span>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* QR Code Quick Modal */}
      {selectedQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl border border-slate-100">
            <h3 className="font-bold text-slate-900 text-lg">
              {selectedQR.title}
            </h3>
            <p className="text-xs text-slate-500 font-mono">
              {selectedQR.certificate_no}
            </p>

            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 flex items-center justify-center inline-block mx-auto shadow-inner">
              <QRCodeSVG
                value={`${window.location.origin}/verify?ref=${encodeURIComponent(selectedQR.certificate_no)}`}
                size={200}
                level="H"
                includeMargin={true}
              />
            </div>

            <p className="text-xs text-slate-500">
              Scan with any mobile camera or public verifier to view official verification records.
            </p>

            <div className="flex gap-2">
              <Link
                to={`/verify?ref=${encodeURIComponent(selectedQR.certificate_no)}`}
                target="_blank"
                className="flex-1 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-xl text-xs transition-colors"
              >
                Public Verify Link
              </Link>
              <button
                onClick={() => setSelectedQR(null)}
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
