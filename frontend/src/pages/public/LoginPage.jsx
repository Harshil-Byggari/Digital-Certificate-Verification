import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, Lock, User, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('rahul.sharma@example.com');
  const [password, setPassword] = useState('Password123!');
  const [role, setRole] = useState('APPLICANT');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(username, password, role);
      if (role === 'APPLICANT') {
        navigate('/applicant/dashboard');
      } else {
        navigate('/analytics');
      }
    } catch (err) {
      setError('Invalid username or password credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPreset = (presetUsername, presetRole) => {
    setUsername(presetUsername);
    setPassword('Password123!');
    setRole(presetRole);
  };

  return (
    <div className="min-h-[calc(100vh-16rem)] flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 sm:p-10 rounded-3xl shadow-xl border border-slate-100">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-white mx-auto shadow-md shadow-blue-500/20">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Portal Authentication
          </h2>
          <p className="text-xs text-slate-500">
            Sign in to access your credential records or administrative audit tools.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Role selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Select Role
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setRole('APPLICANT')}
                className={`py-2 text-xs font-semibold rounded-xl border transition-all ${
                  role === 'APPLICANT'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Applicant
              </button>
              <button
                type="button"
                onClick={() => setRole('VERIFIER')}
                className={`py-2 text-xs font-semibold rounded-xl border transition-all ${
                  role === 'VERIFIER'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Verifier
              </button>
              <button
                type="button"
                onClick={() => setRole('HR')}
                className={`py-2 text-xs font-semibold rounded-xl border transition-all ${
                  role === 'HR'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                HR Admin
              </button>
            </div>
          </div>

          {/* Username / Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Username / Registered Email
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="name@example.com"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm shadow-md shadow-blue-500/20 transition-all hover:scale-[1.01]"
          >
            <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Quick Demo Credentials Presets */}
        <div className="pt-4 border-t border-slate-100 space-y-2">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
            Demo 1-Click Fast Credentials:
          </span>
          <div className="space-y-1.5 text-xs">
            <button
              type="button"
              onClick={() => handleSelectPreset('rahul.sharma@example.com', 'APPLICANT')}
              className="w-full p-2 text-left bg-slate-50 hover:bg-blue-50/50 border border-slate-200 rounded-xl flex items-center justify-between transition-colors"
            >
              <div>
                <span className="font-semibold text-slate-800">Rahul Sharma (Applicant)</span>
                <span className="block text-[11px] text-slate-500 font-mono">rahul.sharma@example.com</span>
              </div>
              <span className="text-[10px] font-bold text-blue-600 px-1.5 py-0.5 bg-blue-100 rounded">
                Applicant
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectPreset('ananya.deshmukh@nab.gov.in', 'VERIFIER')}
              className="w-full p-2 text-left bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 rounded-xl flex items-center justify-between transition-colors"
            >
              <div>
                <span className="font-semibold text-slate-800">Ananya Deshmukh (Verifier)</span>
                <span className="block text-[11px] text-slate-500 font-mono">ananya.deshmukh@nab.gov.in</span>
              </div>
              <span className="text-[10px] font-bold text-indigo-600 px-1.5 py-0.5 bg-indigo-100 rounded">
                Verifier
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectPreset('hr.admin@certitrust.gov.in', 'HR')}
              className="w-full p-2 text-left bg-slate-50 hover:bg-teal-50/50 border border-slate-200 rounded-xl flex items-center justify-between transition-colors"
            >
              <div>
                <span className="font-semibold text-slate-800">HR Administrator</span>
                <span className="block text-[11px] text-slate-500 font-mono">hr.admin@certitrust.gov.in</span>
              </div>
              <span className="text-[10px] font-bold text-teal-600 px-1.5 py-0.5 bg-teal-100 rounded">
                HR
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

