# DCVS: Merge the two frontends and finish the project

## 0. What Manideep and Sriya actually sent (my review)

| Item | What it is | Problem |
|---|---|---|
| `digital-certificate-verification.zip` → `backend/` | Express + `node-oracledb` + JWT | **Cannot be used.** The agreed architecture is APEX/ORDS only. Also, `node-oracledb` needs a direct DB connection, which a hosted apex.oracle.com workspace does not give you. It only covers `/verify`, 3 applicant routes and dashboard stats anyway. |
| same zip → `database/` (6 scripts) | A **second, different schema** (string IDs like `APP-2026-001`, `DBMS_CRYPTO`, bcrypt/RSA claims) | **Conflicts with our schema.** Never run both. One database only. |
| same zip → `frontend/` (Manideep: Home, Verify, Login, Analytics, Applicant pages, Tailwind, `jsqr`) | Good UI. But `src/services/api.js` contains a full hard-coded mock database in `localStorage` and silently falls back to it when the API fails | Breaks the "no hard-coded data" rule and **hides real API errors**. It also uses camelCase and sends `certificateNo`/role. Analytics page shows fake numbers (`+1240`). The applicant detail page has a **Revoke** button, which an applicant must never have. |
| same zip → `docs/` | `API_Documentation`, `Data_Dictionary`, `Project_Report` | Describe the Express/RSA/bcrypt design. **Wrong for our system**, so rewrite before submission. |
| `DBMS_frontend.zip` (Sriya: admin, HR, verifier) | Clean React + plain CSS, config-driven `CrudPage`, snake_case fields, Recharts, QR, role menus, TESTING_CHECKLIST | Targets an *assumed* Express contract. **Very close to our API, so only small edits are needed** (table below). Includes a `dev-mock/` server that must be deleted before submission. |

**Decisions (tell the team today):**
1. The backend is **Oracle APEX/ORDS only** (Harshil's and Pardhanadh's scripts). The Express `backend/` and the zip's `database/` are archived (move into a folder `archive/`, do not run or submit them as the system).
2. **One frontend app** in `frontend/`. Sriya's project is the base (its keys already match our snake_case API). Manideep's pages are moved in and rewired to the real API.
3. **No mock data anywhere** in the final code. If the API fails, the UI shows the error.
4. The contract in `DCVS_Complete_Guide.md` is the single source of truth.

### Backend update I just made (re-run these two files)
Sriya's Certificates screen needs a hash/signature check endpoint and the dashboard needs a verifier count, so I added:
- `GET /certificates/:id/signature` (ADMIN) → `{certificate_hash, digital_signature, hash_valid, signature_valid}`
- `total_verifiers` in `GET /dashboard/stats`

**Harshil:** re-run `05_packages.sql` (safe, `CREATE OR REPLACE`), then re-run `09_ords_modules.sql` (it rebuilds the module; now 50 handlers).

---

## 1. Work plan (who does what, in order)

| Day | Owner | Task | Done when |
|---|---|---|---|
| 1 | Everyone | Agree the 4 decisions above; archive Express backend and zip database | Group chat confirmation |
| 1 | Harshil | Run scripts 01–09 on the **one** shared schema; share the base URL and the 5 test logins | `GET {base}/ping` works for everyone |
| 1 | Pardhanadh | Run the API smoke tests (Guide, Phase 3) + build `api-tests/*.http` (14 tests in Guide Phase 6); fix any ORDS issue | All 14 tests pass |
| 1–2 | Sriya | Create the merged repo structure (Section 2) and adapt her pages (Section 3, Steps 3a–3f) | Admin pages work against real API |
| 1–2 | Manideep | Move public + applicant pages into the merged app and rewire (Section 3, Steps 3g–3k) | Verify, login, portal work against real API |
| 3 | Sriya + Manideep | Integration test (Section 4) | Checklist ticked |
| 3–4 | Manideep | Documentation: rewrite docs (Section 6), screenshots | Report drafted |
| 4 | Harshil | Deployment (Section 5) | Live URL verifies a QR from a phone |
| 5 | Everyone | Viva practice + final cleanup (Section 7) | Submission checklist ticked |

---

## 2. Create the merged project

```bash
cd ~/Projects/digital-certificate-verification
mkdir -p archive
# 1) archive what we are NOT using
unzip -q ~/Downloads/digital-certificate-verification.zip -d /tmp/manideep
mv /tmp/manideep/backend archive/express-backend-NOT-USED
mv /tmp/manideep/database archive/zip-database-NOT-USED
# 2) base frontend = Sriya's
unzip -q ~/Downloads/DBMS_frontend.zip -d /tmp/sriya
rm -rf frontend && mv /tmp/sriya/DBMS_frontend frontend
rm -rf frontend/dev-mock frontend/.DS_Store frontend/src/.DS_Store     # mock server must go
# 3) bring Manideep's pages in (they live in separate folders)
cp -r /tmp/manideep/frontend/src/pages/public     frontend/src/pages/public
cp -r /tmp/manideep/frontend/src/pages/applicant  frontend/src/pages/applicant
cp /tmp/manideep/frontend/src/components/{Navbar,Footer,QRScannerModal}.jsx frontend/src/components/
cp /tmp/manideep/frontend/src/layouts/MainLayout.jsx frontend/src/layouts/
cp /tmp/manideep/frontend/{tailwind.config.js,postcss.config.js} frontend/
cp /tmp/manideep/frontend/src/index.css frontend/src/tailwind.css
# Do NOT copy his analytics page or his services/api.js or his AuthContext.
cd frontend
npm install
npm install -D tailwindcss@3 postcss autoprefixer
npm install lucide-react jsqr
git add -A && git commit -m "Merge: Sriya admin base + Manideep public/applicant pages (not yet wired)"
```

**Tailwind next to plain CSS:** open `tailwind.config.js` and set so it cannot disturb Sriya's styles:
```js
export default {
  corePlugins: { preflight: false },
  content: ['./src/pages/public/**/*.{js,jsx}','./src/pages/applicant/**/*.{js,jsx}',
            './src/components/{Navbar,Footer,QRScannerModal}.jsx','./src/layouts/MainLayout.jsx'],
  theme: { extend: {} }, plugins: [],
}
```
In `src/main.jsx` import both: `import './styles.css'; import './tailwind.css';`

**`vite.config.js`** (port 5173, proxy to ORDS; use your own alias and host):
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': { target: 'https://apex.oracle.com', changeOrigin: true,
    rewrite: (p) => p.replace(/^\/api/, '/pls/apex/YOUR_ALIAS/api') } } },
})
```
Keep `VITE_API_URL` empty in dev. In production set it to the full URL copied from the ORDS module page.

---

## 3. Rewire the code: exact differences and the fix for each

### 3.1 Gap table (what the frontend sends or expects vs. what our API does)

| # | Frontend today | Our API | Fix |
|---|---|---|---|
| a | Login `POST /auth/login {user_id,password}` | `{username,password}` | rename field |
| b | Login response `{token,user:{user_id,role:'admin'}}` | `data:{token,user:{account_id,username,user_type:'ADMIN',linked_id}}` | map in `AuthContext`: `role = user_type.toLowerCase()`, keep `linked_id` |
| c | `Authorization: Bearer …`, token in `localStorage` | header **`X-Auth-Token`**; use `sessionStorage` key `access_token` | edit `services/api.js` |
| d | Contacts via `GET/PUT /applicants/:id/contacts` (and verifiers) | emails/phones are **inside** the applicant/verifier JSON as `emails[]`, `phones[]`; saved by sending them in `POST`/`PUT` | `CrudPage`: remove the `/contacts` calls; prefill from `row.emails/phones`; put them in the payload |
| e | Applicant create has field `password` only | optional `username` + `password` | add a `username` field (createOnly) |
| f | Verifier key `organisation` | **`organization`** (verifier only; issuer stays `organisation`) | rename in `Verifiers.jsx` |
| g | `GET /hr/:id/salary` | not needed: `salary` is already in `GET /hr` and `/hr/:id` | delete the call in `HRPage.jsx` |
| h | HR assigns a verifier by `PUT /verifiers/:id {…,hr_id}` | **only ADMIN** may change `hr_id` (HR calls are accepted but `hr_id` is ignored) | show "Assign" button to admin only; HR sees read-only list |
| i | `GET /certificates/:id/signature` | now exists (ADMIN) | none |
| j | `GET /certificates/:id/revocation` | none; the certificate JSON already has `revocation_reason`, `revoked_date` | read those fields instead |
| k | Revoke body `{reason, revoked_date}` | `{reason}` (date is set by server) | drop the date input (or ignore) |
| l | Dashboard keys `applicants, certificates, issuers, verifiers, revoked, verifications` | `total_applicants, total_certificates, total_issuers, total_verifiers, revoked, total_verifications` | rename in `Dashboard.jsx` |
| m | `/dashboard/certificates` → `[{label,value}]`; `/dashboard/verifications` → `[{label,value}]` | `{by_month,by_type,by_issuer,by_status}` and `{by_day,by_result,by_method}`, each `[{label,count}]` | use `.by_status`, `.by_day`, `dataKey="count"`; add the other charts |
| n | HR and Verifier roles land on a Dashboard | `/dashboard/*` is ADMIN only → 403 | admin-only dashboard; HR → `/admin/hr`, Verifier → `/admin/verifications` |
| o | Verifier sees Revocations (read-only) | `/revocations` is ADMIN only | remove from verifier menu and route |
| p | QR encodes `/verify?certificate_no=…` | backend QR URL uses `?ref=` | draw the QR from `GET /certificates/:id/qr` → `verify_url`; the Verify page reads `ref` (and `certificate_no` for old links) |
| q | Manideep verify: `{certificateNo, method:'QR_SCAN'\|'MANUAL_ENTRY', userAgent, ipAddress}` | `{reference, method:'QR'\|'MANUAL'}`; IP/user-agent are read on the server | rewrite call |
| r | Manideep verify result shape (nested `certificate.issuer.issuerName`, `remarks`) | flat: `result, message, certificate{certificate_no,title,applicant_name,issuer_name,type_name,issue_date,expiry_date}, signature_valid, hash_valid`; **new result `TAMPERED`** | rewrite result card |
| s | Manideep login sends a `role` dropdown | role comes from the account | remove the dropdown |
| t | Applicant pages use `user.entityId`, camelCase, string IDs, emails as objects | `user.linked_id`, snake_case, numeric IDs, emails as plain strings | rewrite the 3 applicant pages |
| u | Applicant detail page has **Revoke** | applicants cannot revoke | delete that button and handler |
| v | `AnalyticsPage` uses fake `getAnalyticsData()` | real data only in `/dashboard/*` (admin) | delete page; reuse admin Dashboard |
| w | Manideep routes `/applicant/*` | choose `/portal/*` | rename |
| x | Sriya `Guard` redirects everyone to `/admin` | roles have different homes | role-home map |

### 3.2 Sriya's steps (admin / HR / verifier): do in this order, test each in the browser

**3a. `src/services/api.js`**: change only these lines:
```js
export const getToken = () => sessionStorage.getItem('access_token');
// in request():
if (getToken()) headers['X-Auth-Token'] = getToken();           // replaces Authorization: Bearer
// on 401 (not on /auth/login): sessionStorage.clear(); window.location.href = '/login';
```
Replace every other `localStorage` use with `sessionStorage`. Keep the existing `data.data` unwrap and `data.error` message handling; they already match our envelope.

**3b. `src/context/AuthContext.jsx`**:
```js
async function login(username, password) {
  const res = await api.post('/auth/login', { username, password });   // api unwraps -> {token, user}
  const u = { username: res.user.username, role: res.user.user_type.toLowerCase(), linked_id: res.user.linked_id };
  sessionStorage.setItem('access_token', res.token);
  sessionStorage.setItem('user', JSON.stringify(u));
  setUser(u); return u;
}
```
Read the user back from `sessionStorage`. On first load, if a token exists, call `GET /auth/me` and clear the session if it fails.

**3c. `Login.jsx`**: label "Username"; call `login(username, password)`; then `navigate(HOME[role])` with
`HOME = { admin:'/admin', hr:'/admin/hr', verifier:'/admin/verifications', applicant:'/portal' }`.

**3d. `App.jsx`**: guard redirects to `HOME[user.role]` instead of `/admin`; `Dashboard` route admin-only; remove `verifier` from the Revocations route and from the Layout menu for that role.

**3e. `CrudPage.jsx` (contacts)**: delete the `GET/PUT ${endpoint}/:id/contacts` code. When opening the edit form: `setEmails(row.emails || []); setPhones(row.phones || [])`. When saving, merge them into the payload: `{...payload, emails, phones}`. Applicants: add field `{ key:'username', label:'Login username', createOnly:true }` next to `password`; make both optional.

**3f. Page edits** (one find-and-replace each):
- `Verifiers.jsx`: `organisation` → `organization`; make the HR dropdown read-only for non-admin.
- `HRPage.jsx`: remove the `/salary` call and use `hr.salary`; hide "assign verifier" unless `user.role === 'admin'`; for the logged-in HR use `GET /hr/${user.linked_id}`.
- `Certificates.jsx`: revocation info from `full.revocation_reason`/`full.revoked_date`; QR from `GET /certificates/:id/qr`; remove the `/revocation` call; creation form: remove `certificate_no` input (generated by server), leave `title, applicant_id, type_id, issuer_id, issue_date, expiry_date, document_url`.
- `RevokeModal.jsx`: send `{ reason }`; min 5 characters.
- `Revocations.jsx`: list from `GET /revocations`; fields `certificate_no, title, applicant_name, reason, revoked_date`.
- `Dashboard.jsx`: rename the card keys (gap l) and chart data (gap m).
- `Verifications.jsx`: show `reference_text` when `certificate_no` is null; `verifier_name` null → "Public"; method filter options `MANUAL, QR, API`; result filter `VALID, EXPIRED, REVOKED, TAMPERED, INVALID`.
- `Badge.jsx`: add colours for `TAMPERED` and `DRAFT`.

**3g–3k are Manideep's steps (below).**

### 3.3 Manideep's steps (public + applicant)

**3g. Delete `services/api.js` and `context/AuthContext.jsx` from his tree** (already not copied). His pages import `api` from `'../../services/api'`; give them the merged `api.get/post/put/del` instead and write small page-level calls:
- Dashboard/Profile: `api.get('/certificates')` (the server already returns only the applicant's own issued certificates), `api.get('/applicants/' + user.linked_id)`, `api.put('/applicants/' + user.linked_id, body)`.
- Verify (public): `api.post('/verify', { reference, method })`; the token header is added automatically when someone is logged in.
- QR image: `api.get('/certificates/' + id + '/qr')` → `data.verify_url` into `qrcode.react`.

**3h. `VerifyPage.jsx`**: read the reference from `?ref=` (also accept `?certificate_no=`), auto-verify on load, use method `'QR'` when it came from a link or the scanner, `'MANUAL'` when typed. Render the 5 results (VALID, EXPIRED, REVOKED, TAMPERED, INVALID) from `result`, show `message`, the flat `certificate` fields, and `signature_valid`/`hash_valid` ticks. Delete the "Serial/ID" nested fields. Remove the mock fallback entirely.

**3i. `QRScannerModal.jsx`**: keep `jsqr`; on a scan, take `ref` from the URL (`new URL(text).searchParams.get('ref')`) or use the raw text; call the same verify function with method `'QR'`.

**3j. Applicant pages** (`/portal`, `/portal/certificates/:id`, `/portal/profile`): snake_case fields; emails/phones are arrays of strings; profile edit sends `{first_name, middle_name, last_name, street, city, state, pincode, emails, phones}` (do not let the applicant change `aadhar_card` or `dob`); **delete the Revoke button and `revokeCertificate` usage**; do not show hash/signature.

**3k. `MainLayout` + `Navbar`**: show Login when logged out; when logged in show a link to the user's `HOME[role]`; remove the Analytics link (admin has the dashboard).

**Final router (in `App.jsx`)**
```
/                     public MainLayout (Home)
/verify               public
/login                one Login page
/portal/*             applicant (guard: applicant)
/admin/*              Sriya's Layout (guards as in 3d)
*                     redirect to /
```

### 3.4 AGY prompts for the merge (give them in this order)

**M1: Orient AGY (read-only)**
```
Read docs/API_CONTRACT.md (copy of the "API CONTRACT" section of DCVS_Complete_Guide.md) and DCVS_Merge_and_Finish_Plan.md section 3 (gap table). Then scan frontend/src and list: (1) every API call (method, path, body), (2) every place that uses localStorage, mock data, camelCase keys, or role names. Do NOT edit anything. Output a table of mismatches against the contract.
```
**M2: Foundation**
```
Apply gaps a, b, c, x from the gap table. Edit only src/services/api.js, src/context/AuthContext.jsx, src/pages/admin/Login.jsx and src/App.jsx. Use sessionStorage key "access_token", header X-Auth-Token, login body {username,password}, map user_type to lowercase role, role-home redirects (admin -> /admin, hr -> /admin/hr, verifier -> /admin/verifications, applicant -> /portal), and /auth/me on load. Show me the diff before moving on.
```
**M3: CrudPage + admin pages**
```
Apply gaps d, e, f, g, h, i, j, k, l, m, n, o from the gap table. Contacts are embedded as emails[] and phones[] in the entity JSON; remove all /contacts calls. Keep the CrudPage config-driven design. No new dependencies. Run npm run build and fix errors.
```
**M4: Public verify + QR**
```
Replace the verification flow in src/pages/public/VerifyPage.jsx and QRScannerModal.jsx per gaps p, q, r. Remove the INITIAL_DATABASE_STATE mock and ALL localStorage fallbacks (this file no longer exists as api.js; use the shared api service). POST /verify {reference, method}. Handle result values VALID, EXPIRED, REVOKED, TAMPERED, INVALID with distinct colours and icons, show message, signature_valid, hash_valid. Read ?ref= (and ?certificate_no=) from the URL and auto-verify.
```
**M5: Applicant portal**
```
Rewrite src/pages/applicant/* as /portal pages per gaps t, u, w. Use only: GET /certificates, GET /certificates/:id, GET /certificates/:id/qr, GET/PUT /applicants/{linked_id}. snake_case fields; emails/phones are string arrays. Delete the Revoke button and handler. Hide hash/signature. Add loading, empty and error states. No mock data.
```
**M6: Cleanup + security review**
```
Search the repo for: localStorage, "mock", "dev-mock", "Bearer", "jwt", hard-coded names or IDs like APP-2026, passwords in source, console.log. Remove or fix every hit. Confirm no page can call an endpoint that its role is not allowed to (see the roles column in docs/API_CONTRACT.md) and that 401 redirects to /login. Run npm run build and report warnings.
```
**M7: Update the contract checker**
```
Rewrite scripts/check-api.mjs for the real contract: login with {username,password} to get data.token, send X-Auth-Token, check GET /types, /issuers, /applicants, /certificates, /verifiers, /hr, /revocations, /verifications, /dashboard/stats for the keys listed in docs/API_CONTRACT.md, plus POST /verify with the seed certificate numbers. Print PASS/FAIL per check. Usage: node scripts/check-api.mjs <base> <username> <password>.
```

---

## 4. Integration test (Sriya + Manideep together, using real data)

Run `node scripts/check-api.mjs http://localhost:5173/api admin Admin@1234` first (through the proxy). Then:

| # | Test | Expected |
|---|---|---|
| 1 | Login admin / wrong password | lands on /admin / error shown, stays on /login |
| 2 | Login `hr1`, `verifier1`, `asha` | HR → /admin/hr · verifier → verifications · applicant → /portal |
| 3 | As HR open `/admin/applicants` | redirected, API would return 403 |
| 4 | Admin: add applicant with 2 emails, 2 phones + login | appears; reload shows both contacts |
| 5 | Aadhaar with 11 digits / pincode with 5 digits | blocked in form |
| 6 | Add certificate → Issue | status VALID; QR + hash + signature visible; hash/signature checks both green |
| 7 | Open the QR link (or scan with phone) | public page shows VALID |
| 8 | Revoke (reason ≥ 5 chars) | status REVOKED; second revoke shows the 409 message |
| 9 | Public verify: seed VALID/EXPIRED/REVOKED numbers, an unknown number | VALID / EXPIRED / REVOKED / INVALID |
| 10 | In SQL Commands change a title, verify, then `ROLLBACK` | TAMPERED |
| 11 | Applicant `asha` | sees only her issued certificates; no hash; cannot reach `/admin` |
| 12 | Verifier `verifier1` verifies a certificate | new row in Verifications with their name; public verifies show "Public" |
| 13 | Delete a type used by a certificate | server message shown |
| 14 | Mobile width 360px | menus scroll, tables scroll, forms stack |

Screenshots for the report are listed in Sriya's `TESTING_CHECKLIST.md` and the Guide, Phase 9.

---

## 5. Deployment (Harshil)
Follow Guide Phase 7. Order matters:
1. Deploy the frontend first to get its real URL (Vercel/Netlify; build command `npm run build`, output `dist`, add an SPA rewrite to `index.html`).
2. Put that URL into the database: `UPDATE app_config …` and `UPDATE certificate SET qr_code …` (Guide Phase 7 step 1), then `COMMIT`.
3. Set the ORDS module's **Origins Allowed** to that exact URL (edit `09_ords_modules.sql` and re-run, or the module page).
4. Set `VITE_API_URL` in the hosting dashboard to the **full ORDS URL copied from the module page**, redeploy.
5. Production (no dev proxy) requires CORS to work for the `X-Auth-Token` header. If the browser blocks the request, tell me the exact console error and I will give the fix.
6. Change all five seed passwords and keep only synthetic Aadhaar numbers.

---

## 6. Documentation to rewrite (Manideep)
Everything in the zip's `docs/` describes a different system. Rewrite them from the real code:
- **API_Documentation.md**: paste the contract table from the Guide.
- **Data_Dictionary.md**: generate with the SQL in Guide Phase 9 (`user_tab_columns`).
- **Project_Report.md → Word/PDF**: follow the 17 sections in Guide Phase 9. Specifically fix these wrong claims from the old docs: Express backend (we use ORDS/PL/SQL), "RSA digital signature" (we use a keyed SHA-256 signature, say so and list RSA as future work), bcrypt (we use salted SHA-256), `DBMS_CRYPTO` (we use `STANDARD_HASH`), JWT (we use random session tokens stored hashed).
- Architecture diagram: Browser (React) → HTTPS → ORDS REST (module `dcvs.api`) → PL/SQL packages → Oracle tables.

## 7. Final cleanup + submission checklist
- [ ] Only the Oracle schema from our scripts exists (no second schema); `archive/` folder is either deleted or clearly labelled not used
- [ ] No `dev-mock/`, no `localStorage`, no mock data, no `.env` committed, no real Aadhaar numbers
- [ ] `GET /ping` live; all 14 API tests and 14 UI tests pass
- [ ] Repo: 4 feature branches merged into `main` by Harshil; README with run steps + test logins
- [ ] Report, screenshots, ER diagram, architecture diagram, live URL
- [ ] Everyone can explain: the verification flow, the hash/signature, why signatures are keyed-digest not RSA, the role checks on the server, and why Express was dropped

## 8. Viva answers you should be ready for
- **Why ORDS instead of Express?** A hosted APEX workspace exposes REST through ORDS; an Express server would need direct database access we do not have, and would be a second backend to secure.
- **How do you prevent forged certificates?** Hash recomputed from stored fields on every verify; signature recomputed with the issuer's secret that never leaves the DB; any change gives TAMPERED.
- **How are roles enforced?** In every ORDS handler (`pkg_auth.guard`), not only in the React menus.
- **What would you improve?** RSA/ECDSA signing, rate limiting, server-side pagination, token refresh, email OTP.
