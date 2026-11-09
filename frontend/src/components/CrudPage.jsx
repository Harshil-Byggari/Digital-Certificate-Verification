import { Fragment, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import Modal from './Modal';
import ContactEditor from './ContactEditor';
import RecordView from './RecordView';

const toDateInput = (v) => (v ? String(v).slice(0, 10) : '');

/**
 * Config-driven list + add/edit/delete page. Used for every entity so the behaviour is identical.
 * props:
 *  title, endpoint ('/applicants'), idKey ('applicant_id')
 *  columns:  [{ key, label, render?(row) }]
 *  fields:   [{ key, label, type, required, section, options | optionsEndpoint+optionValue+optionLabel,
 *               pattern, patternMsg, createOnly, full }]
 *  contacts: true -> shows multi email/phone editors (GET/PUT /:id/contacts)
 *  readOnly: hides add/edit/delete, shows a "View" details modal instead
 *  filters:  [{ key, label, options: [] }]
 *  rowActions(row) -> extra buttons, refreshKey -> change to force reload
 *  afterCreate(created, form) -> extra call after POST (e.g. issue certificate)
 *  extraTop -> node rendered above the table
 */
export default function CrudPage({
  title, endpoint, idKey, columns, fields = [], contacts = false, readOnly = false, filters = [],
  rowActions, refreshKey, afterCreate, extraTop, singular, dateFilter,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterVals, setFilterVals] = useState({});
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | row
  const [viewing, setViewing] = useState(null);
  const [form, setForm] = useState({});
  const [emails, setEmails] = useState([]);
  const [phones, setPhones] = useState([]);
  const [lookups, setLookups] = useState({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const name = singular || title.replace(/s$/, '');

  const load = () => {
    setLoading(true);
    api.get(endpoint).then((d) => { setRows(Array.isArray(d) ? d : []); setError(''); })
      .catch((e) => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(load, [endpoint, refreshKey]);

  // dropdown data for relationship fields (applicant, issuer, type, HR ...)
  useEffect(() => {
    if (!readOnly) {
      fields.filter((f) => f.optionsEndpoint).forEach((f) => {
        api.get(f.optionsEndpoint).then((d) => setLookups((l) => ({ ...l, [f.key]: d }))).catch(() => {});
      });
    }
  }, [readOnly]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !JSON.stringify(r).toLowerCase().includes(q)) return false;
      if (dateFilter) {
        const day = String(r[dateFilter.key] || '').slice(0, 10);
        if (from && day < from) return false;
        if (to && day > to) return false;
      }
      return filters.every((f) => !filterVals[f.key] || String(r[f.key]).toLowerCase() === filterVals[f.key].toLowerCase());
    });
  }, [rows, search, filterVals, from, to]);

  async function openEdit(row) {
    setFormError('');
    if (row === 'new') {
      setForm({}); setEmails([]); setPhones([]); setEditing('new'); return;
    }
    const f = {};
    fields.forEach((fd) => { f[fd.key] = fd.type === 'date' ? toDateInput(row[fd.key]) : row[fd.key] ?? ''; });
    setForm(f);
    setEmails(Array.isArray(row.emails) ? [...row.emails] : []);
    setPhones(Array.isArray(row.phones) ? [...row.phones] : []);
    setEditing(row);
    if (contacts && (!Array.isArray(row.emails) || !Array.isArray(row.phones))) {
      try {
        const fresh = await api.get(`${endpoint}/${row[idKey]}`);
        if (fresh) {
          if (Array.isArray(fresh.emails)) setEmails([...fresh.emails]);
          if (Array.isArray(fresh.phones)) setPhones([...fresh.phones]);
        }
      } catch { /* leave existing */ }
    }
  }

  function validate() {
    for (const f of fields) {
      if (f.createOnly && editing !== 'new') continue;
      const v = form[f.key];
      if (f.required && (v === undefined || v === '')) return `${f.label} is required`;
      if (v && f.pattern && !new RegExp(f.pattern).test(String(v))) return f.patternMsg || `${f.label} is invalid`;
    }
    if (contacts) {
      const bad = emails.find((e) => e && !/^\S+@\S+\.\S+$/.test(e));
      if (bad) return `Invalid email: ${bad}`;
    }
    return '';
  }

  async function save(e) {
    e.preventDefault();
    const msg = validate();
    if (msg) return setFormError(msg);
    setSaving(true); setFormError('');
    try {
      const payload = {};
      fields.forEach((f) => {
        if (f.createOnly && editing !== 'new') return;
        let v = form[f.key];
        if (v === '' || v === undefined) v = null;
        if (v !== null && f.type === 'number') v = Number(v);
        payload[f.key] = v;
      });
      if (contacts) {
        payload.emails = emails.map((x) => x.trim()).filter(Boolean);
        payload.phones = phones.map((x) => x.trim()).filter(Boolean);
      }
      let id;
      if (editing === 'new') {
        const created = await api.post(endpoint, payload);
        id = created?.[idKey] ?? created?.id;
        if (afterCreate) await afterCreate(created, payload);
      } else {
        id = editing[idKey];
        await api.put(`${endpoint}/${id}`, payload);
      }
      setEditing(null); load();
    } catch (err) { setFormError(err.message); } finally { setSaving(false); }
  }

  async function remove(row) {
    if (!window.confirm(`Delete this ${name.toLowerCase()}? This cannot be undone.`)) return;
    try { await api.del(`${endpoint}/${row[idKey]}`); load(); } catch (e) { setError(e.message); }
  }

  const optionsFor = (f) => {
    if (f.options) return f.options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
    return (lookups[f.key] || []).map((r) => ({ value: r[f.optionValue], label: f.optionLabel(r) }));
  };

  let lastSection = null;
  return (
    <div>
      <div className="page-head">
        <h2>{title}</h2>
        {!readOnly && <button className="btn primary" onClick={() => openEdit('new')}>+ Add {name}</button>}
      </div>
      {extraTop}
      <div className="toolbar">
        <input className="search" placeholder={`Search ${title.toLowerCase()}…`} value={search} onChange={(e) => setSearch(e.target.value)} />
        {filters.map((f) => (
          <select key={f.key} value={filterVals[f.key] || ''} onChange={(e) => setFilterVals({ ...filterVals, [f.key]: e.target.value })}>
            <option value="">All {f.label}</option>
            {f.options.map((o) => <option key={o}>{o}</option>)}
          </select>
        ))}
        {dateFilter && (
          <>
            <label className="muted">From <input type="date" className="inline" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="muted">To <input type="date" className="inline" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          </>
        )}
        <span className="muted">{shown.length} of {rows.length}</span>
      </div>
      {error && <div className="alert">{error}</div>}
      <div className="table-wrap">
        <table>
          <thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}<th>Actions</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={columns.length + 1} className="muted">Loading…</td></tr>}
            {!loading && !shown.length && <tr><td colSpan={columns.length + 1} className="muted">No records found.</td></tr>}
            {shown.map((r) => (
              <tr key={r[idKey]}>
                {columns.map((c) => <td key={c.key}>{c.render ? c.render(r) : r[c.key] ?? '—'}</td>)}
                <td className="actions">
                  {rowActions && rowActions(r)}
                  {readOnly ? <button className="btn ghost small" onClick={() => setViewing(r)}>View</button> : (
                    <>
                      <button className="btn ghost small" onClick={() => openEdit(r)}>Edit</button>
                      <button className="btn danger small" onClick={() => remove(r)}>Delete</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {viewing && <Modal title={`${name} details`} onClose={() => setViewing(null)}><RecordView row={viewing} /></Modal>}

      {editing && (
        <Modal title={editing === 'new' ? `Add ${name}` : `Edit ${name}`} onClose={() => setEditing(null)} wide>
          <form onSubmit={save} className="form-grid">
            {fields.filter((f) => !(f.createOnly && editing !== 'new')).map((f) => {
              const heading = f.section && f.section !== lastSection ? <h4 className="section full" key={`s-${f.section}`}>{f.section}</h4> : null;
              if (f.section) lastSection = f.section;
              const common = { value: form[f.key] ?? '', onChange: (e) => setForm({ ...form, [f.key]: e.target.value }), required: f.required };
              return (
                <Fragment key={f.key}>
                  {heading}
                  <div className={`field ${f.full || f.type === 'textarea' ? 'full' : ''}`}>
                    <label>{f.label}{f.required && ' *'}</label>
                    {f.type === 'textarea' ? <textarea rows={4} {...common} />
                      : (f.options || f.optionsEndpoint) ? (
                        <select {...common}><option value="">Select…</option>{optionsFor(f).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
                      ) : <input type={f.type || 'text'} step={f.type === 'number' ? 'any' : undefined} {...common} />}
                  </div>
                </Fragment>
              );
            })}
            {contacts && (
              <>
                <h4 className="section full">Contact details</h4>
                <ContactEditor label="Emails" type="email" values={emails} onChange={setEmails} placeholder="name@example.com" />
                <ContactEditor label="Phones" values={phones} onChange={setPhones} placeholder="+91…" />
              </>
            )}
            {formError && <div className="alert full">{formError}</div>}
            <div className="form-actions full">
              <button type="button" className="btn ghost" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
