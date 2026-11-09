// Contract checker: verifies the backend returns the fields this frontend expects.
// Usage:  node scripts/check-api.mjs [baseUrl] [userId] [password]
//   default base: http://localhost:5000/api   (works against the dev mock too)
const base = process.argv[2] || 'http://localhost:5000/api';
const [userId, password] = [process.argv[3] || 'admin', process.argv[4] || 'admin'];
let token = '';
let pass = 0, fail = 0;
const ok = (m) => { pass++; console.log('  PASS', m); };
const bad = (m) => { fail++; console.log('  FAIL', m); };

async function call(method, path, body) {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, body: body && JSON.stringify(body) });
  const j = await r.json().catch(() => null);
  return { status: r.status, data: j && j.data !== undefined ? j.data : j };
}
function keys(label, row, expected) {
  if (!row) return console.log(`  WARN ${label}: no rows to inspect (add seed data, then re-run)`);
  const missing = expected.filter((k) => !(k in row));
  missing.length ? bad(`${label}: missing keys -> ${missing.join(', ')}`) : ok(`${label}: all expected keys present`);
}

const lists = {
  '/applicants': ['applicant_id', 'first_name', 'last_name', 'dob', 'aadhar_card', 'street', 'city', 'state', 'pincode'],
  '/types': ['type_id', 'type_name', 'description'],
  '/issuers': ['issuer_id', 'issuer_name', 'organisation', 'email', 'phone', 'public_key'],
  '/certificates': ['certificate_id', 'certificate_no', 'title', 'applicant_id', 'issuer_id', 'type_id', 'issue_date', 'expiry_date', 'status'],
  '/verifiers': ['verifier_id', 'first_name', 'last_name', 'aadhar_card', 'doj', 'role', 'verifier_type', 'organisation', 'hr_id'],
  '/hr': ['hr_id', 'basic', 'da', 'hra', 'salary', 'leave_days'],
  '/revocations': ['revocation_id', 'certificate_id', 'reason', 'revoked_date'],
  '/verifications': ['verification_id', 'verification_time', 'certificate_id', 'result', 'method', 'ip_address', 'user_agent', 'remarks'],
};

console.log(`Checking ${base}`);
const login = await call('POST', '/auth/login', { user_id: userId, password });
if (login.data?.token) { token = login.data.token; ok(`login (${login.data.user?.role})`); } else bad(`login failed (status ${login.status})`);

for (const [path, exp] of Object.entries(lists)) {
  const r = await call('GET', path);
  if (r.status !== 200 || !Array.isArray(r.data)) { bad(`GET ${path} -> status ${r.status}, expected an array`); continue; }
  keys(`GET ${path}`, r.data[0], exp);
}
const a = (await call('GET', '/applicants')).data?.[0];
if (a) {
  const c = await call('GET', `/applicants/${a.applicant_id}/contacts`);
  c.data && Array.isArray(c.data.emails) && Array.isArray(c.data.phones) ? ok('contacts -> { emails[], phones[] }') : bad('contacts shape should be { emails: [], phones: [] }');
}
const cert = (await call('GET', '/certificates')).data?.[0];
if (cert) {
  const s = await call('GET', `/certificates/${cert.certificate_id}/signature`);
  keys('signature', s.data, ['certificate_hash', 'digital_signature']);
}
const st = await call('GET', '/dashboard/stats');
keys('dashboard/stats', st.data, ['applicants', 'certificates', 'issuers', 'verifiers', 'revoked', 'verifications']);
const dc = await call('GET', '/dashboard/certificates');
keys('dashboard/certificates[0]', dc.data?.[0], ['label', 'value']);
const dv = await call('GET', '/dashboard/verifications');
keys('dashboard/verifications[0]', dv.data?.[0], ['label', 'value']);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
