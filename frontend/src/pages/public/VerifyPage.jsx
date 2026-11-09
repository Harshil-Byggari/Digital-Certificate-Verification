import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  ShieldCheck, AlertTriangle, XCircle, Clock, QrCode, 
  Search, CheckCircle, Hash, Key, Building, 
  User, Calendar, FileText, ArrowLeft, RefreshCw, AlertOctagon, HelpCircle
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../../services/api';
import QRScannerModal, { extractReference } from '../../components/QRScannerModal';

export default function VerifyPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('ref') || searchParams.get('certificate_no') || searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const lastVerifiedRef = React.useRef(null);

  useEffect(() => {
    const urlRef = searchParams.get('ref') || searchParams.get('certificate_no') || searchParams.get('q');
    if (urlRef && urlRef !== lastVerifiedRef.current) {
      setQuery(urlRef);
      handleVerify(urlRef, 'QR');
    }
  }, [searchParams]);

  const handleVerify = async (certRef, method = 'MANUAL') => {
    const ref = extractReference(certRef);
    if (!ref) return;
    lastVerifiedRef.current = ref;
    setLoading(true);
    setError('');
    try {
      const res = await api.verify(ref, method);
      setVerificationResult(res);
      if (searchParams.get('ref') !== ref) {
        setSearchParams({ ref });
      }
    } catch (err) {
      setError(err.message || 'Verification request failed. Please check network or reference.');
      setVerificationResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    handleVerify(query.trim(), 'MANUAL');
  };

  const handleScanSuccess = (scannedCode) => {
    const ref = extractReference(scannedCode);
    setQuery(ref);
    handleVerify(ref, 'QR');
  };

  const renderResultBanner = (result) => {
    const res = String(result?.result || '').toUpperCase();
    switch (res) {
      case 'VALID':
        return (
          <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
                <CheckCircle className="w-8 h-8" />
              </div>
              <div>
                <div className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-200 text-emerald-900 font-extrabold text-xs tracking-wider uppercase mb-1">
                  VERIFIED AUTHENTIC
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-emerald-950">
                  Certificate Is Valid & Active
                </h2>
                <p className="text-sm text-emerald-800 mt-1">
                  {result.message || 'Cryptographic signature and SHA-256 digest verified successfully against Oracle records.'}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-xs text-emerald-700 block font-mono">Status: VALID</span>
              <span className="text-xs text-emerald-800 font-semibold">100% Cryptographically Verified</span>
            </div>
          </div>
        );

      case 'EXPIRED':
        return (
          <div className="bg-amber-50 border-2 border-amber-500 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
                <Clock className="w-8 h-8" />
              </div>
              <div>
                <div className="inline-block px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900 font-extrabold text-xs tracking-wider uppercase mb-1">
                  CREDENTIAL EXPIRED
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-amber-950">
                  Certificate Has Expired
                </h2>
                <p className="text-sm text-amber-800 mt-1">
                  {result.message || 'This certificate was genuinely issued but has passed its validity expiration date.'}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-xs text-amber-700 block font-mono">Status: EXPIRED</span>
              <span className="text-xs text-amber-800 font-semibold">Signature Untampered</span>
            </div>
          </div>
        );

      case 'REVOKED':
        return (
          <div className="bg-red-50 border-2 border-red-500 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-red-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-red-500/20">
                <XCircle className="w-8 h-8" />
              </div>
              <div>
                <div className="inline-block px-2.5 py-0.5 rounded-full bg-red-200 text-red-900 font-extrabold text-xs tracking-wider uppercase mb-1">
                  REVOCATION NOTICE
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-red-950">
                  Certificate Formally Revoked
                </h2>
                <p className="text-sm text-red-800 mt-1">
                  {result.message || 'This credential was withdrawn by the issuing authority and is no longer legally recognized.'}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-xs text-red-700 block font-mono">Status: REVOKED</span>
              <span className="text-xs text-red-800 font-semibold">Withdrawn by Authority</span>
            </div>
          </div>
        );

      case 'TAMPERED':
        return (
          <div className="bg-purple-50 border-2 border-purple-600 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-purple-700 text-white flex items-center justify-center shrink-0 shadow-lg shadow-purple-700/20">
                <AlertOctagon className="w-8 h-8" />
              </div>
              <div>
                <div className="inline-block px-2.5 py-0.5 rounded-full bg-purple-200 text-purple-950 font-extrabold text-xs tracking-wider uppercase mb-1">
                  SECURITY ALERT: TAMPERED
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-purple-950">
                  Cryptographic Integrity Check Failed
                </h2>
                <p className="text-sm text-purple-900 mt-1">
                  {result.message || 'Stored certificate details do not match the cryptographic hash or digital signature.'}
                </p>
                <p className="text-xs text-purple-800 font-medium mt-2">
                  Caution: The certificate content may have been altered or forged. Do not trust this document.
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-xs text-purple-700 block font-mono">Status: TAMPERED</span>
              <span className="text-xs text-purple-900 font-semibold">Integrity Violation</span>
            </div>
          </div>
        );

      case 'INVALID':
      default:
        return (
          <div className="bg-rose-50 border-2 border-rose-400 rounded-2xl p-6 sm:p-8 flex items-start gap-4 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-rose-500 text-white flex items-center justify-center shrink-0">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <div className="inline-block px-2.5 py-0.5 rounded-full bg-rose-200 text-rose-900 font-extrabold text-xs tracking-wider uppercase">
                UNRECOGNIZED CREDENTIAL
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-rose-950">
                No Matching Certificate Found
              </h2>
              <p className="text-sm text-rose-800">
                {result.message || 'No certificate exists with this reference or it has not yet been issued.'}
              </p>
              <p className="text-xs text-rose-600 mt-2">
                Warning: Do not accept this credential as proof of qualification without contacting the issuing institution.
              </p>
            </div>
          </div>
        );
    }
  };

  const cert = verificationResult?.certificate;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Top Banner / Breadcrumb */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4" />
            Official Public Registry Lookup
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Verify Digital Certificate
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Enter a Certificate Number or scan a QR code to audit authenticity against live Oracle records.
          </p>
        </div>

        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-2 bg-white border border-slate-200 rounded-lg shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Home
        </Link>
      </div>

      {/* Verification Query Input Box */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <form onSubmit={handleFormSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. DCVS-2026-001, DCVS-2026-002, DCVS-2026-003"
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-mono"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-sm font-medium transition-colors"
            >
              <QrCode className="w-4 h-4 text-blue-600" />
              <span>Scan QR</span>
            </button>

            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl text-sm font-semibold transition-all shadow-sm shadow-blue-500/20"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              <span>Verify</span>
            </button>
          </div>
        </form>

        {/* Quick Sample Presets for Testing */}
        <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-slate-500 border-t border-slate-100">
          <span className="font-semibold text-slate-600">Sample Tests:</span>
          <button
            type="button"
            onClick={() => {
              setQuery('DCVS-2026-001');
              handleVerify('DCVS-2026-001', 'MANUAL');
            }}
            className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-md font-mono transition-colors"
          >
            DCVS-2026-001 (Valid)
          </button>
          <button
            type="button"
            onClick={() => {
              setQuery('DCVS-2026-002');
              handleVerify('DCVS-2026-002', 'MANUAL');
            }}
            className="px-2.5 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-md font-mono transition-colors"
          >
            DCVS-2026-002 (Expired)
          </button>
          <button
            type="button"
            onClick={() => {
              setQuery('DCVS-2026-003');
              handleVerify('DCVS-2026-003', 'MANUAL');
            }}
            className="px-2.5 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded-md font-mono transition-colors"
          >
            DCVS-2026-003 (Revoked)
          </button>
          <button
            type="button"
            onClick={() => {
              setQuery('DCVS-2026-004');
              handleVerify('DCVS-2026-004', 'MANUAL');
            }}
            className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-md font-mono transition-colors"
          >
            DCVS-2026-004 (Draft)
          </button>
          <button
            type="button"
            onClick={() => {
              setQuery('DCVS-INVALID-999');
              handleVerify('DCVS-INVALID-999', 'MANUAL');
            }}
            className="px-2.5 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-md font-mono transition-colors"
          >
            DCVS-INVALID-999 (Invalid)
          </button>
        </div>
      </div>

      {/* Network or General Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800 flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Verification Result Section */}
      {verificationResult && (
        <div className="space-y-6">
          {/* Result Status Banner */}
          {renderResultBanner(verificationResult)}

          {/* Cryptographic Failure Audit Card (Shown when TAMPERED where cert is null for security) */}
          {verificationResult.result === 'TAMPERED' && !cert && (
            <div className="bg-white rounded-2xl border border-purple-200 p-6 sm:p-8 space-y-4 shadow-sm animate-fade-in">
              <div className="flex items-center justify-between border-b border-purple-100 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Key className="w-5 h-5 text-purple-700" />
                    Cryptographic Failure Audit
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Direct verification against Oracle 26ai cryptographic integrity triggers failed.
                  </p>
                </div>
                <span className="px-2.5 py-1 bg-purple-100 text-purple-800 rounded-lg text-xs font-mono font-bold">
                  TAMPER DETECTED
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className={`p-4 rounded-xl border flex items-center justify-between ${
                  verificationResult.hash_valid
                    ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                    : 'bg-red-50 border-red-200 text-red-900'
                }`}>
                  <div className="flex items-center gap-2">
                    <Hash className="w-4 h-4 text-purple-700 shrink-0" />
                    <div>
                      <span className="font-semibold block">SHA-256 Data Hash</span>
                      <span className="text-[11px] text-slate-500">
                        {verificationResult.hash_valid ? 'Hash recomputation matched' : 'Stored content differs from signed digest'}
                      </span>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                    verificationResult.hash_valid ? 'bg-emerald-200 text-emerald-900' : 'bg-red-200 text-red-900'
                  }`}>
                    {verificationResult.hash_valid ? 'Match' : 'Mismatch'}
                  </span>
                </div>

                <div className={`p-4 rounded-xl border flex items-center justify-between ${
                  verificationResult.signature_valid
                    ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                    : 'bg-red-50 border-red-200 text-red-900'
                }`}>
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-purple-700 shrink-0" />
                    <div>
                      <span className="font-semibold block">Digital Signature (HMAC)</span>
                      <span className="text-[11px] text-slate-500">
                        {verificationResult.signature_valid ? 'Issuer signature valid' : 'Secret key validation failed'}
                      </span>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                    verificationResult.signature_valid ? 'bg-emerald-200 text-emerald-900' : 'bg-red-200 text-red-900'
                  }`}>
                    {verificationResult.signature_valid ? 'Verified' : 'Invalid'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Certificate Entity Details (Rendered if certificate exists) */}
          {cert && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left 2 Cols: Comprehensive Credential Details */}
              <div className="md:col-span-2 space-y-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-sm">
                  <div className="border-b border-slate-100 pb-4">
                    <div className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                      {cert.type_name}
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">
                      {cert.title}
                    </h3>
                    <div className="text-xs font-mono text-slate-500 mt-1">
                      Certificate No: <span className="font-semibold text-slate-700">{cert.certificate_no}</span>
                    </div>
                  </div>

                  {/* Attributes Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    {/* Recipient Applicant */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                        <User className="w-3.5 h-3.5 text-blue-600" />
                        Conferred To (Applicant)
                      </div>
                      <div className="font-bold text-slate-900 text-base">
                        {cert.applicant_name}
                      </div>
                    </div>

                    {/* Issuer Organization */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                        <Building className="w-3.5 h-3.5 text-indigo-600" />
                        Issuing Authority
                      </div>
                      <div className="font-bold text-slate-900 text-base">
                        {cert.issuer_name}
                      </div>
                    </div>

                    {/* Issue Date */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                        <Calendar className="w-3.5 h-3.5 text-slate-600" />
                        Issue Date
                      </div>
                      <div className="font-bold text-slate-900 font-mono">
                        {cert.issue_date || '—'}
                      </div>
                    </div>

                    {/* Expiry Date */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                        <Calendar className="w-3.5 h-3.5 text-slate-600" />
                        Expiration Date
                      </div>
                      <div className="font-bold text-slate-900 font-mono">
                        {cert.expiry_date || 'Lifetime Validity (No Expiry)'}
                      </div>
                    </div>
                  </div>

                  {/* Cryptographic Integrity Breakdown */}
                  <div className="pt-4 border-t border-slate-100 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-blue-600" />
                      Cryptographic Provenance
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className={`p-3 rounded-xl border flex items-center justify-between ${
                        verificationResult.hash_valid
                          ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                          : 'bg-red-50 border-red-200 text-red-900'
                      }`}>
                        <div className="flex items-center gap-2">
                          <Hash className="w-4 h-4 text-blue-600" />
                          <span className="font-semibold">SHA-256 Hash Digest</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          verificationResult.hash_valid ? 'bg-emerald-200 text-emerald-900' : 'bg-red-200 text-red-900'
                        }`}>
                          {verificationResult.hash_valid ? 'Match' : 'Mismatch'}
                        </span>
                      </div>

                      <div className={`p-3 rounded-xl border flex items-center justify-between ${
                        verificationResult.signature_valid
                          ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                          : 'bg-red-50 border-red-200 text-red-900'
                      }`}>
                        <div className="flex items-center gap-2">
                          <Key className="w-4 h-4 text-indigo-600" />
                          <span className="font-semibold">Digital Signature</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          verificationResult.signature_valid ? 'bg-emerald-200 text-emerald-900' : 'bg-red-200 text-red-900'
                        }`}>
                          {verificationResult.signature_valid ? 'Verified' : 'Invalid'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Col: High-Res Dynamic QR Code */}
              <div className="space-y-6">
                <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center space-y-4 shadow-sm">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Verification QR Code
                  </h4>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-center mx-auto shadow-inner w-fit">
                    <QRCodeSVG
                      value={`${window.location.origin}/verify?ref=${encodeURIComponent(cert.certificate_no)}`}
                      size={160}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                  <div className="text-xs text-slate-500">
                    Scan with camera to immediately re-verify this certificate.
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 break-all bg-slate-50 p-2 rounded-lg border border-slate-100">
                    {window.location.origin}/verify?ref={cert.certificate_no}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* QR Scanner Modal */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />
    </div>
  );
}
