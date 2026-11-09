import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { 
  User, Mail, Phone, MapPin, Calendar, CreditCard, 
  Plus, Trash2, Check, ArrowLeft, Save, ShieldCheck, AlertCircle, Lock
} from 'lucide-react';

export default function ApplicantProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState(null);

  // Form states matching ER attributes
  const [applicantId, setApplicantId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [aadharCard, setAadharCard] = useState('');
  
  // Composite Address
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');

  // Multivalued attributes
  const [emails, setEmails] = useState([]);
  const [phones, setPhones] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const currentApplicantId = user.linked_id;
    setApplicantId(currentApplicantId);

    if (!currentApplicantId) {
      setError('No linked applicant ID found in session.');
      setLoading(false);
      return;
    }

    api.get(`/applicants/${currentApplicantId}`)
      .then((data) => {
        if (data) {
          setFirstName(data.first_name || '');
          setMiddleName(data.middle_name || '');
          setLastName(data.last_name || '');
          setDob(data.dob || '');
          setAadharCard(data.aadhar_card || '');
          setStreet(data.street || '');
          setCity(data.city || '');
          setState(data.state || '');
          setPincode(data.pincode || '');

          // Map string array to interactive chip objects
          const rawEmails = Array.isArray(data.emails) ? data.emails : [];
          setEmails(rawEmails.map((em, idx) => ({
            emailId: `email-${idx}-${Date.now()}`,
            email: em,
            isPrimary: idx === 0 ? 'Y' : 'N'
          })));

          const rawPhones = Array.isArray(data.phones) ? data.phones : [];
          setPhones(rawPhones.map((ph, idx) => ({
            phoneId: `phone-${idx}-${Date.now()}`,
            phoneNumber: ph,
            isPrimary: idx === 0 ? 'Y' : 'N'
          })));
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load profile:', err);
        setError(err.message || 'Failed to load applicant profile from Oracle Database.');
        setLoading(false);
      });
  }, [user, navigate]);

  const handleAddEmail = (e) => {
    e.preventDefault();
    const val = newEmail.trim();
    if (!val) return;
    if (emails.some(e => e.email.toLowerCase() === val.toLowerCase())) {
      setError('This email address is already added.');
      return;
    }
    setError(null);
    const isFirst = emails.length === 0;
    setEmails([...emails, { emailId: `email-${Date.now()}`, email: val, isPrimary: isFirst ? 'Y' : 'N' }]);
    setNewEmail('');
  };

  const handleRemoveEmail = (id) => {
    const remaining = emails.filter(e => e.emailId !== id);
    if (remaining.length > 0 && !remaining.some(e => e.isPrimary === 'Y')) {
      remaining[0].isPrimary = 'Y';
    }
    setEmails(remaining);
  };

  const handleSetPrimaryEmail = (id) => {
    setEmails(emails.map(e => ({
      ...e,
      isPrimary: e.emailId === id ? 'Y' : 'N'
    })));
  };

  const handleAddPhone = (e) => {
    e.preventDefault();
    const val = newPhone.trim();
    if (!val) return;
    if (phones.some(p => p.phoneNumber === val)) {
      setError('This phone number is already added.');
      return;
    }
    setError(null);
    const isFirst = phones.length === 0;
    setPhones([...phones, { phoneId: `phone-${Date.now()}`, phoneNumber: val, isPrimary: isFirst ? 'Y' : 'N' }]);
    setNewPhone('');
  };

  const handleRemovePhone = (id) => {
    const remaining = phones.filter(p => p.phoneId !== id);
    if (remaining.length > 0 && !remaining.some(p => p.isPrimary === 'Y')) {
      remaining[0].isPrimary = 'Y';
    }
    setPhones(remaining);
  };

  const handleSetPrimaryPhone = (id) => {
    setPhones(phones.map(p => ({
      ...p,
      isPrimary: p.phoneId === id ? 'Y' : 'N'
    })));
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    setSavedSuccess(false);

    try {
      // Prioritize primary contact at index 0 for canonical serialization
      const sortedEmails = [...emails].sort((a, b) => (b.isPrimary === 'Y' ? 1 : 0) - (a.isPrimary === 'Y' ? 1 : 0));
      const sortedPhones = [...phones].sort((a, b) => (b.isPrimary === 'Y' ? 1 : 0) - (a.isPrimary === 'Y' ? 1 : 0));

      const updatedPayload = {
        first_name: firstName.trim(),
        middle_name: middleName.trim() || null,
        last_name: lastName.trim(),
        street: street.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        emails: sortedEmails.map(e => e.email.trim()).filter(Boolean),
        phones: sortedPhones.map(p => p.phoneNumber.trim()).filter(Boolean)
      };

      await api.put(`/applicants/${applicantId}`, updatedPayload);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err) {
      console.error('Profile update failed:', err);
      setError(err.message || 'Failed to update applicant record in Oracle Database.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-20 text-center">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-slate-500 mt-4">Loading applicant profile from database...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <Link
            to="/portal"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Applicant Profile Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Normalized ER representation of composite names, addresses, and multivalued email/phone contact tables.
          </p>
        </div>

        {savedSuccess && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-semibold animate-fade-in shadow-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Changes saved to Oracle DB!
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleProfileSubmit} className="space-y-8">
        {/* Section 1: Identity & Composite Name */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <User className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">
              1. Composite Name & National Identity
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                First Name *
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Middle Name (Optional)
              </label>
              <input
                type="text"
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Last Name *
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  Date of Birth (DOB)
                </span>
                <span className="text-[10px] text-slate-400 font-normal flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Official Identifier (Read-only)
                </span>
              </label>
              <input
                type="text"
                disabled
                value={dob}
                className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono font-medium text-slate-600 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                  Aadhaar Number (12-Digit Unique)
                </span>
                <span className="text-[10px] text-slate-400 font-normal flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Official Identifier (Read-only)
                </span>
              </label>
              <input
                type="text"
                disabled
                value={aadharCard}
                className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono font-medium text-slate-600 cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Composite Address */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <MapPin className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">
              2. Composite Address Attributes
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Street Address *
              </label>
              <input
                type="text"
                required
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="Flat / House / Street Name"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                City *
              </label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                State *
              </label>
              <input
                type="text"
                required
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="State"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Pincode (6-Digit PIN) *
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                placeholder="Postal PIN"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Multivalued Attributes (Emails & Phone Numbers Child Tables) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Multivalued Emails */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  Multivalued: Emails (Child Table)
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded">
                1:N
              </span>
            </div>

            {/* Email list */}
            <div className="space-y-2">
              {emails.map((e) => (
                <div key={e.emailId} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl text-xs border border-slate-100">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSetPrimaryEmail(e.emailId)}
                      className={`text-[10px] px-2 py-0.5 rounded font-bold transition-colors ${
                        e.isPrimary === 'Y' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      }`}
                      title="Toggle primary email"
                    >
                      {e.isPrimary === 'Y' ? 'Primary' : 'Set Primary'}
                    </button>
                    <span className="font-medium text-slate-800">{e.email}</span>
                  </div>
                  {emails.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveEmail(e.emailId)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                      title="Delete email"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add email */}
            <div className="flex gap-2 pt-2">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Add another email..."
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleAddEmail}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </div>

          {/* Multivalued Phones */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  Multivalued: Phones (Child Table)
                </h3>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded">
                1:N
              </span>
            </div>

            {/* Phone list */}
            <div className="space-y-2">
              {phones.map((p) => (
                <div key={p.phoneId} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl text-xs border border-slate-100">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSetPrimaryPhone(p.phoneId)}
                      className={`text-[10px] px-2 py-0.5 rounded font-bold transition-colors ${
                        p.isPrimary === 'Y' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      }`}
                      title="Toggle primary phone"
                    >
                      {p.isPrimary === 'Y' ? 'Primary' : 'Set Primary'}
                    </button>
                    <span className="font-medium text-slate-800 font-mono">{p.phoneNumber}</span>
                  </div>
                  {phones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemovePhone(p.phoneId)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                      title="Delete phone"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add phone */}
            <div className="flex gap-2 pt-2">
              <input
                type="text"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="Add phone (+91 ...)"
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <button
                type="button"
                onClick={handleAddPhone}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
          <Link
            to="/portal"
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-500/20 transition-all hover:scale-[1.01]"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Updating Oracle...' : 'Save Profile Changes'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
