import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ShieldCheck, Search, QrCode, Lock, CheckCircle2, 
  ArrowRight, Award, Building, Users, Clock, AlertTriangle 
} from 'lucide-react';
import QRScannerModal, { extractReference } from '../../components/QRScannerModal';

export default function HomePage() {
  const navigate = useNavigate();
  const [certQuery, setCertQuery] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (certQuery.trim()) {
      navigate(`/verify?ref=${encodeURIComponent(certQuery.trim())}`);
    }
  };

  const handleScanSuccess = (code) => {
    const ref = extractReference(code);
    navigate(`/verify?ref=${encodeURIComponent(ref)}`);
  };

  return (
    <div className="space-y-16 pb-20">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-900 via-slate-900 to-slate-950 text-white pt-20 pb-28 px-4 sm:px-6 lg:px-8">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/20 blur-[140px] pointer-events-none rounded-full" />
        <div className="absolute bottom-0 right-10 w-96 h-96 bg-indigo-600/10 blur-[100px] pointer-events-none rounded-full" />

        <div className="relative max-w-5xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-400/30 text-blue-300 text-xs font-semibold backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Oracle Database Single Source of Truth
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight">
            Verify Academic & Professional <br />
            <span className="bg-gradient-to-r from-blue-400 via-indigo-300 to-teal-300 bg-clip-text text-transparent">
              Digital Credentials Instantly
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-slate-300 text-base sm:text-lg font-normal leading-relaxed">
            Tamper-proof digital certificate verification infrastructure powered by SHA-256 cryptographic hashing, RSA digital signatures, and Oracle Database relational integrity.
          </p>

          {/* Instant Verification Search Bar */}
          <div className="max-w-2xl mx-auto bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/20 shadow-2xl">
            <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1 flex items-center">
                <Search className="w-5 h-5 text-slate-400 absolute left-4 pointer-events-none" />
                <input
                  type="text"
                  value={certQuery}
                  onChange={(e) => setCertQuery(e.target.value)}
                  placeholder="Enter Certificate Number (e.g. DCVS-2026-001)"
                  className="w-full bg-white text-slate-900 placeholder-slate-400 text-sm font-medium pl-11 pr-4 py-3.5 rounded-xl border-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="flex items-center justify-center gap-2 px-4 py-3.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-colors border border-slate-700"
                  title="Scan QR Code"
                >
                  <QrCode className="w-4 h-4 text-blue-400" />
                  <span className="hidden sm:inline">Scan QR</span>
                </button>

                <button
                  type="submit"
                  className="flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-600/30 hover:scale-[1.02]"
                >
                  <span>Verify Now</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>

            {/* Quick Demo Certificate Presets */}
            <div className="mt-2 pt-2 border-t border-white/10 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-300">
              <span className="text-slate-400">Quick Test:</span>
              <button
                type="button"
                onClick={() => {
                  setCertQuery('DCVS-2026-001');
                  navigate('/verify?ref=DCVS-2026-001');
                }}
                className="hover:text-blue-300 underline font-mono text-[11px]"
              >
                DCVS-2026-001 (Valid)
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => {
                  setCertQuery('DCVS-2026-002');
                  navigate('/verify?ref=DCVS-2026-002');
                }}
                className="hover:text-amber-300 underline font-mono text-[11px]"
              >
                DCVS-2026-002 (Expired)
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => {
                  setCertQuery('DCVS-2026-003');
                  navigate('/verify?ref=DCVS-2026-003');
                }}
                className="hover:text-red-300 underline font-mono text-[11px]"
              >
                DCVS-2026-003 (Revoked)
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 relative z-10">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2 p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-2 text-blue-600 font-semibold text-sm">
              <ShieldCheck className="w-5 h-5" />
              Cryptographic Integrity
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Every certificate incorporates a SHA-256 fingerprint generated from verified issuance parameters and signed by the issuing institution.
            </p>
          </div>

          <div className="space-y-2 p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm">
              <CheckCircle2 className="w-5 h-5" />
              Real-Time Validation
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Instant verification against live Oracle Database tables. Detects expired, revoked, draft, or tampered credentials on demand.
            </p>
          </div>

          <div className="space-y-2 p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-2 text-indigo-600 font-semibold text-sm">
              <QrCode className="w-5 h-5" />
              Instant QR Verification
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Scan high-resolution QR codes directly from certificates to execute automatic cryptographic verification within seconds.
            </p>
          </div>
        </div>
      </section>

      {/* QR Scanner Modal */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />
    </div>
  );
}
