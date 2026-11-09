# Track 3 manual test checklist (tick as you go; screenshots for Manideep's report in brackets)

## Auth and roles
- [ ] Login with wrong password shows an error and stays on /login
- [ ] Admin sees all menu items; HR sees Dashboard, Verifiers, HR, Verifications; Verifier sees Dashboard, Certificates (read-only), Revocations (read-only), Verifications
- [ ] Opening /admin/applicants as HR redirects away; Logout clears the session [screenshot: login, dashboard]

## Applicants [screenshot: list, form, profile]
- [ ] Add with 2 emails + 2 phones; edit and remove one of each; reload -> saved in Oracle
- [ ] Aadhar with 11 digits and pincode with 5 digits are rejected
- [ ] Profile shows name, DOB, address, contacts, certificates; delete asks for confirmation

## Types / Issuers [screenshot each]
- [ ] Type add/edit/delete; deleting a type used by a certificate shows the backend error
- [ ] Issuer add/edit/delete with public key; "Certificates" button lists what it issued

## Certificates [screenshot: list, issue form, details with QR]
- [ ] Applicant, issuer and type dropdowns are filled from the database
- [ ] Issue a certificate -> appears as Valid with hash + signature; QR scans to /verify?certificate_no=...
- [ ] Hash check and Signature check show Valid; expired date shows Expired
- [ ] Revoke with reason + date -> status Revoked, button disappears, revocation visible in details

## Revocations [screenshot]
- [ ] "Revoke a certificate" lists only non-revoked certificates; history shows reason + date; date filter works

## Verifiers / HR [screenshot each + managed list]
- [ ] Verifier add/edit/delete with HR dropdown, role, type, org, joining date, multiple contacts
- [ ] Verifier profile lists verifications performed
- [ ] HR record: salary = Basic + DA + HRA; leave shown; "Verifiers" modal lists managed verifiers
- [ ] Assign a verifier to a different HR and see it move

## Verifications [screenshot]
- [ ] Filters (result, method, date range) and search narrow the list
- [ ] "Linked records" shows the verification, certificate and verifier

## Final
- [ ] Mobile width: menu scrolls horizontally, tables scroll, forms stack
- [ ] No mock server running, VITE_API_URL points at deployed backend
