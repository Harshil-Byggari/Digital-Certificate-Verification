import React from 'react';
import { ShieldCheck, Database, FileText, Lock, Globe } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-400 text-sm mt-auto border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-white">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <span className="font-bold text-lg tracking-tight">CertiTrust</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              National Digital Credential Infrastructure backed by Oracle Database, SHA-256 cryptographic hashing, and RSA digital signatures.
            </p>
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1 rounded w-fit">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Oracle 21c Single Source of Truth
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-3">Verification</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/verify" className="hover:text-blue-400 transition-colors">Instant Public Verification</Link>
              </li>
              <li>
                <Link to="/verify" className="hover:text-blue-400 transition-colors">Scan QR Code</Link>
              </li>
              <li>
                <Link to="/admin" className="hover:text-blue-400 transition-colors">Administration Console</Link>
              </li>
            </ul>
          </div>

          {/* User Portals */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-3">Portals</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link to="/login" className="hover:text-blue-400 transition-colors">Applicant Login</Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-blue-400 transition-colors">Verifier Audit Portal</Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-blue-400 transition-colors">HR Administration</Link>
              </li>
            </ul>
          </div>

          {/* Security & Standards */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-3">Compliance & Tech</h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-blue-400" />
                <span>SHA-256 Hash Integrity</span>
              </div>
              <div className="flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-blue-400" />
                <span>Oracle REST Data Services (ORDS)</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-blue-400" />
                <span>ISO 27001 / IT Act Compliant</span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 gap-4">
          <p>© 2026 CertiTrust Digital Certificate Verification System. Built for Sprint by Manideep (Track 4), Harshil, Pardhanadh & Sriya.</p>
          <div className="flex items-center gap-6">
            <span>Sprint Time: 11-Hour Plan</span>
            <span>All ER Entities Implemented</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

