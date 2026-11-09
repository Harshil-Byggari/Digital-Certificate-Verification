import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, AlertTriangle, XCircle, Clock, ArrowLeft, 
  Download, QrCode, Lock, Hash, Key, Building, User, Calendar, 
  FileText, CheckCircle2, History, AlertOctagon, Share2, ExternalLink 
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../../services/api';

export default function CertificateDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [cert, setCert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCertificate();
  }, [id]);

  const loadCertificate = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get(`/certificates/${id}`);
      setCert(data);
    } catch (e) {
      console.error('Failed to load certificate detail:', e);
      setError(e.message || 'The requested certificate could not be retrieved from Oracle Database.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-500 mt-4">Loading certificate record from Oracle Database...</p>
      </div>
    );
  }

  if (!cert || error) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900">Certificate Not Accessible</h2>
        <p className="text-xs text-slate-600">
          {error || 'The requested certificate ID does not exist or does not belong to your applicant account.'}
        </p>
        <Link
          to="/portal"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl hover:bg-blue-700 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to My Credentials
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-fade-in">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <Link
            to="/portal"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to My Credentials
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
              {cert.type_name || 'Academic / Professional Credential'}
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-mono text-slate-500">{cert.certificate_no}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-0.5">
            {cert.title}
          </h1>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2 shrink-0">
          {cert.status === 'VALID' && (
            <span className="px-3.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm">
              <ShieldCheck className="w-4 h-4" /> Active & Authentic
            </span>
          )}
          {cert.status === 'EXPIRED' && (
            <span className="px-3.5 py-1.5 bg-amber-50 text-amber-700 border border-amber-300 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm">
              <Clock className="w-4 h-4" /> Expired
            </span>
          )}
          {cert.status === 'REVOKED' && (
            <span className="px-3.5 py-1.5 bg-red-50 text-red-700 border border-red-300 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm">
              <XCircle className="w-4 h-4" /> Revoked
            </span>
          )}
        </div>
      </div>

      {/* Revocation Warning Box */}
      {cert.status === 'REVOKED' && (
        <div className="bg-red-50 border-2 border-red-400 rounded-2xl p-6 flex items-start gap-4 shadow-sm">
          <AlertOctagon className="w-8 h-8 text-red-600 shrink-0" />
          <div className="space-y-1">
            <h3 className="font-bold text-red-900 text-sm">Official Revocation Notice</h3>
            <p className="text-xs text-red-800">
              <strong>Reason:</strong> {cert.revocation_reason || 'Withdrawn by issuing authority'}
            </p>
            {cert.revoked_date && (
              <p className="text-[11px] text-red-700 font-mono">
                Revoked On: {cert.revoked_date}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 Cols: Details & Cryptographic Data */}
        <div className="md:col-span-2 space-y-6">
          {/* Key Attributes Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-sm">
            <h3 className="font-bold text-slate-900 text-base border-b border-slate-100 pb-3">
              Official Credential Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-xl space-y-0.5">
                <span className="text-slate-400">Database Record ID:</span>
                <div className="font-mono font-medium text-slate-800">#{cert.certificate_id}</div>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-xl space-y-0.5">
                <span className="text-slate-400">Public Serial Number:</span>
                <div className="font-mono font-bold text-slate-800">{cert.certificate_no}</div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl space-y-0.5">
                <span className="text-slate-400">Conferred To (Applicant):</span>
                <div className="font-semibold text-slate-800">
                  {cert.applicant_name}
                </div>
                <div className="text-[11px] text-slate-500 font-mono">
                  Applicant ID: #{cert.applicant_id}
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl space-y-0.5">
                <span className="text-slate-400">Issuing Authority:</span>
                <div className="font-semibold text-slate-800">{cert.issuer_name}</div>
                <div className="text-[11px] text-slate-500">{cert.organisation}</div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl space-y-0.5">
                <span className="text-slate-400">Issue / Conferral Date:</span>
                <div className="font-semibold text-slate-800 font-mono">
                  {cert.issue_date || '—'}
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl space-y-0.5">
                <span className="text-slate-400">Expiration Date:</span>
                <div className="font-semibold text-slate-800 font-mono">
                  {cert.expiry_date || 'Lifetime Validity (No Expiry)'}
                </div>
              </div>
            </div>

            {/* Document Access */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-800 block">Digital Document File</span>
                <span className="text-[11px] text-slate-500">Stored at official institutional repository</span>
              </div>
              {cert.document_url ? (
                <a
                  href={cert.document_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download / View PDF</span>
                </a>
              ) : (
                <span className="text-xs text-slate-400 italic">No external document URL attached</span>
              )}
            </div>
          </div>

          {/* Cryptographic Proof Card */}
          <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 space-y-5 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-blue-400" />
                <h3 className="font-bold text-sm tracking-wide">Cryptographic Security Data</h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-blue-900/60 text-blue-300 rounded">
                SHA-256 + Issuer HMAC
              </span>
            </div>

            <div className="space-y-4 text-xs font-mono">
              <div className="space-y-1">
                <span className="text-slate-400 font-sans font-medium flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-emerald-400" />
                  Certificate Hash (SHA-256 Digest):
                </span>
                <div className="p-3 bg-slate-950 rounded-xl text-emerald-300 break-all select-all border border-slate-800 text-[11px]">
                  {cert.certificate_hash || 'Computed upon official issue'}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-slate-400 font-sans font-medium flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-blue-400" />
                  Digital Signature (Issuer Secret HMAC):
                </span>
                <div className="p-3 bg-slate-950 rounded-xl text-blue-300 break-all select-all border border-slate-800 text-[11px]">
                  {cert.digital_signature || 'Signed by authorized institutional key'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Dynamic QR Code & Instant Audit */}
        <div className="space-y-6">
          {/* QR Code Container */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center space-y-4 shadow-sm">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Certificate QR Code
            </h4>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-center inline-block mx-auto shadow-inner">
              <QRCodeSVG
                value={`${window.location.origin}/verify?ref=${encodeURIComponent(cert.certificate_no)}`}
                size={180}
                level="H"
                includeMargin={true}
              />
            </div>
            <div className="text-xs text-slate-500">
              Encoded Serial: <span className="font-mono font-medium text-slate-800">{cert.certificate_no}</span>
            </div>
            <Link
              to={`/verify?ref=${encodeURIComponent(cert.certificate_no)}`}
              target="_blank"
              className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-xl transition-colors"
            >
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Verify in Public Registry</span>
            </Link>
          </div>

          {/* Institutional Trust Notice */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3 shadow-sm text-xs text-slate-600">
            <div className="flex items-center gap-2 font-bold text-slate-900 border-b border-slate-100 pb-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Official Conferred Credential</span>
            </div>
            <p className="leading-relaxed">
              This credential is permanently bound to your applicant identity in the Oracle Database single source of truth.
            </p>
            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500">
              Issuing authority: <span className="font-semibold text-slate-700">{cert.issuer_name}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
