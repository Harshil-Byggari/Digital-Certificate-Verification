# Track 3 – Admin / HR / Verifier frontend (Sriya)

## Run it (5 minutes)
```bash
npm install
node dev-mock/mock-server.mjs    # terminal 1: fake API on :5000 (dev only, until Pardhanadh's API is up)
npm run dev                      # terminal 2: http://localhost:5173/login  (any user id/password)
```
Login as `hr` or `verifier` to see role-limited menus; anything else is admin.
When the real backend runs on :5000, simply stop the mock - nothing else changes.

## Check the real backend against what the UI expects
```bash
node scripts/check-api.mjs http://localhost:5000/api <user_id> <password>
```
Prints PASS/FAIL for every list endpoint, contacts, signature and dashboard shape - send the FAIL lines to Pardhanadh.
Manual tests: `TESTING_CHECKLIST.md` (also tells you which screenshots to take).

## Where things are
| Spec item                                  | File |
|--------------------------------------------|------|
| Login, role routing                        | pages/admin/Login.jsx, context/AuthContext.jsx, App.jsx |
| Dashboard + Recharts                       | pages/admin/Dashboard.jsx |
| Applicants (name, address, multi email/phone, profile + certificates) | pages/admin/Applicants.jsx |
| Certificate types                          | pages/admin/CertificateTypes.jsx |
| Certificates (dropdowns, QR, hash, signature, status, revoke) | pages/admin/Certificates.jsx |
| Issuers + public key                       | pages/admin/Issuers.jsx |
| Revocation form + history, date filter     | pages/admin/Revocations.jsx, components/RevokeModal.jsx |
| Verifiers (+ HR dropdown, multi contacts, profile) | pages/verifier/Verifiers.jsx |
| HR (Basic/DA/HRA/salary/leave, assign + list managed verifiers) | pages/hr/HRPage.jsx |
| Verification history, filters, details     | pages/verifier/Verifications.jsx |
| Shared list/add/edit/delete engine         | components/CrudPage.jsx |

## Contract assumptions - confirm with Pardhanadh at 0:45
1. JSON keys are lowercase snake_case of the ER attributes (`first_name`, `aadhar_card`, `leave_days`, ...).
2. Responses are bare JSON or `{ data: ... }`.
3. `POST /auth/login {user_id,password}` -> `{ token, user:{ user_id, role } }`, role = admin | hr | verifier | applicant.
4. `GET/PUT /applicants/:id/contacts` and `/verifiers/:id/contacts` use `{ emails:[], phones:[] }`.
5. Certificate list rows include joined `applicant_name`, `issuer_name`, `type_name`, and derived `status`.
6. `GET /certificates/:id/signature` -> `{ certificate_hash, digital_signature, hash_valid, signature_valid }`.
7. `POST /certificates/:id/revoke {reason, revoked_date}`.
8. Dashboard: stats object; certificates `[{label,value}]` by status; verifications `[{label:date,value}]`.
9. The QR encodes `/verify?certificate_no=...` (Manideep's public page must read that param).
If a key differs, change it in the `fields` / `columns` arrays of that one page.

## Before submission
- Delete `dev-mock/` and make sure nothing is served by it (rule 6: no hardcoded data).
- Set `VITE_API_URL` to the deployed backend.
- Screenshot every page for Manideep's report.
