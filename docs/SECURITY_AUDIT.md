# DCVS — Security Audit and Hardening Report (Stage M6)

**System Target:** Oracle Database 26ai Free (`FREEPDB1`) + ORDS (`http://localhost:8080/ords/dcvs/api`) + React Frontend  
**Audit Date:** November 9, 2026  
**Status:** COMPLETED & VERIFIED (45/45 Security Tests Passed)

---

## 1. Executive Summary

A comprehensive, end-to-end security audit and hardening cycle was conducted across all system tiers:
1. **Database Tier**: PL/SQL package definitions (`pkg_auth`, `pkg_api`, `pkg_certificate`, `pkg_applicant`, `pkg_verification`, etc.).
2. **API / ORDS Tier**: Handler definitions, SQL bind parameters, role guards, exception handling, and error response sanitization.
3. **Frontend Tier**: React route guards, token lifecycle management, input sanitation, QR URL generation, and XSS prevention.

---

## 2. Authentication & Session Management

### 2.1 Password Security
- **Algorithm:** Salted SHA-256 (`RAWTOHEX(SYS_GUID())` salt concatenated with plaintext password and hashed via `pkg_api.sha256`).
- **Format:** `salt:hash` stored in `dcvs.account.password_hash`.
- **Minimum Requirements:** Enforced via `pkg_auth.create_account` (Minimum 8 characters for passwords, 3 characters for usernames).
- **Leakage Prevention:** Passwords, password hashes, and salts are strictly excluded from all API responses (`POST /auth/login`, `GET /auth/me`, and applicant endpoints).

### 2.2 Token Lifecycle & Session Storage
- **Generation:** High-entropy pseudo-random tokens generated via `DBMS_RANDOM.STRING` combined with `RAWTOHEX(SYS_GUID())`, timestamp nanoseconds, and username.
- **Storage in DB:** The server only stores the SHA-256 hash of the token (`auth_session.token_hash`), ensuring that a database dump does not expose active session tokens.
- **Expiration:** Sessions expire automatically after 2 hours (`INTERVAL '2' HOUR`).
- **Logout Invalidation:** `POST /auth/logout` explicitly deletes the token hash from `auth_session`, immediately invalidating subsequent requests (tested and confirmed: returns HTTP 401).
- **Client Storage:** Tokens reside in `sessionStorage` (isolated to the browser tab, cleared on tab close or on HTTP 401 response). No credentials or tokens are saved to `localStorage` or logged to console in production.

---

## 3. Role-Based Access Control (RBAC) & Object Authorization

### 3.1 Role Guard Matrix
Every guarded ORDS handler invokes `pkg_auth.guard(:auth_token, '<ROLES>')`. If unauthenticated, it returns `HTTP 401`; if unauthorized for the role, it returns `HTTP 403`.

| Endpoint Group | Allowed Roles | Enforced Status Code on Unauthorized Role |
| :--- | :--- | :--- |
| `GET /dashboard/*` | ADMIN | 403 Forbidden |
| `GET /applicants` (list) | ADMIN, HR, VERIFIER | 403 Forbidden |
| `GET /issuers`, `POST /issuers/*` | ADMIN | 403 Forbidden |
| `GET /types`, `POST /types/*` | ADMIN (Write), ALL (Read) | 403 Forbidden (Write) |
| `POST /certificates`, `/issue`, `/revoke` | ADMIN | 403 Forbidden |
| `GET /revocations` | ADMIN | 403 Forbidden |
| `GET /hr` | ADMIN | 403 Forbidden |
| `GET /hr/:id` | ADMIN, HR | 403 Forbidden |
| `GET /verifiers` | ADMIN, HR | 403 Forbidden |
| `GET /verifications` | ADMIN, HR, VERIFIER | 403 Forbidden |
| `POST /verify` | PUBLIC / OPTIONAL AUTH | Records verifier ID if VERIFIER; 200 for public |

### 3.2 Object-Level Access Control (Applicant Isolation)
- **Profile Scoping:** `GET /applicants/:id` invokes `pkg_applicant.get_scoped`. When called by an `APPLICANT`, access is strictly permitted only if `:id == g_linked_id`. Unauthorized cross-applicant requests return `HTTP 403 Access denied`.
- **Certificate Scoping:** `GET /certificates` invokes `pkg_certificate.list_json(g_user_type, g_linked_id)`. For applicants, it filters `c.is_issued = 'Y' AND c.applicant_id = g_linked_id`. Certificates belonging to other applicants and unissued draft certificates are completely excluded.
- **Direct Certificate Access:** `GET /certificates/:id` and `GET /certificates/:id/qr` return `HTTP 404 Not found` if the requested certificate belongs to another applicant or is in `DRAFT` status.

---

## 4. SQL Injection & Input Validation

### 4.1 SQL Injection Hardening
- **Parameterized Bind Variables:** All ORDS templates use named bind parameters (`:id`, `:auth_token`, `:body`, `:ua`, `:xff`).
- **Dynamic SQL:** Only a single `EXECUTE IMMEDIATE` exists across the entire codebase (`pkg_dashboard.agg`), which strictly operates on hardcoded internal aggregate query literals and never accepts or interpolates user-controlled parameters.
- **Verification Input Sanitization:** SQL injection attack vectors (such as `' OR '1'='1`, `'; DROP TABLE certificate; --`, and `UNION SELECT`) submitted to `POST /verify` are processed as literal string references and cleanly return `HTTP 200 {"result": "INVALID"}` with 0 SQL exceptions.

### 4.2 Malformed Input & Buffer Overflow Handling
- **Malformed JSON:** Bodies with invalid JSON syntax are intercepted by `pkg_api.body_clob` and `JSON_OBJECT_T.parse`, cleanly returning `HTTP 400 Bad Request` (`{"success":false,"error":"JSON syntax error"}`).
- **Buffer Overflow & String Lengths:** Added Oracle error code `-6502` (`ORA-06502: character string buffer too small` / `character to number conversion error`) to `pkg_api.status_for`. Extremely long payloads (e.g., 10,000+ characters) or non-numeric path parameters to numeric routes return `HTTP 400 Bad Request` without causing unhandled server errors or leaking stack traces.

---

## 5. Frontend & UI Security

### 5.1 Cross-Site Scripting (XSS)
- Codebase audit confirmed **zero** occurrences of `dangerouslySetInnerHTML`, `eval()`, `new Function()`, or `javascript:` URI handlers in `frontend/src`.
- React's JSX virtual DOM automatically escapes all rendered variables (certificate titles, issuer names, applicant names, remarks).

### 5.2 QR Code Security
- QR code targets are constructed via `encodeURIComponent(cert.certificate_no)` to prevent URL parameter injection.
- QR decoding uses `jsQR` on image pixel buffers. The extracted raw string is parsed with native `URL` constructors inside a `try/catch` wrapper in `extractReference`, safely falling back to plain string reference extraction.

---

## 6. Information Disclosure & PII Protection

### 6.1 Public Verification Information Minimization
`POST /verify` exposes only approved public certificate fields:
- `certificate_no`, `title`, `applicant_name`, `issuer_name`, `type_name`, `issue_date`, `expiry_date`.
- **Sensitive PII Excluded:** Aadhaar numbers, date of birth, postal addresses, email addresses, phone numbers, issuer private keys, and internal account IDs are completely stripped from public verification responses.
- If a certificate is `INVALID` or `TAMPERED`, the `certificate` object is set to `null` to prevent leaking partial data.

### 6.2 Error Message Sanitization
- `pkg_api.clean_msg` automatically strips internal Oracle call stacks, line numbers, and `ORA-XXXXX` codes, returning clean user-facing error messages (e.g. `'Access denied'`, `'Request body is empty'`).

---

## 7. Automated M6 Security Test Suite Evidence

Execution of `scratch/test_m6_security.py` against `http://localhost:8080/ords/dcvs/api`:

```
======================================================================
DCVS — Stage M6 Comprehensive Security Hardening & Vulnerability Suite
API Target: http://localhost:8080/ords/dcvs/api
======================================================================

--- 1. Authentication Hardening ---
  [PASS] 1.1 Invalid password returns 401
  [PASS] 1.2 Non-existent user returns 401
  [PASS] 1.3 Empty credentials payload rejected (400 or 401)
  [PASS] 1.4 Admin login succeeds and returns token
  [PASS] 1.5 Login response excludes password_hash and salt
  [PASS] 1.6 GET /auth/me returns correct identity
  [PASS] 1.6b GET /auth/me excludes password hashes
  [PASS] 1.7 Unauthenticated access to /dashboard/stats returns 401
  [PASS] 1.7b Unauthenticated access to /certificates returns 401
  [PASS] 1.8 Forged token returns 401
  [PASS] 1.9 POST /auth/logout immediately invalidates token (subsequent request returns 401)

--- 2. RBAC & Cross-Role Privilege Escalation Prevention ---
  [PASS] 2.0 Applicant Asha login succeeds
  [PASS] 2.0b Verifier login succeeds
  [PASS] 2.1 Applicant blocked from GET /dashboard/stats (403)
  [PASS] 2.2 Applicant blocked from GET /applicants list (403)
  [PASS] 2.3 Applicant blocked from GET /issuers (403)
  [PASS] 2.4 Applicant blocked from GET /hr (403)
  [PASS] 2.5 Applicant blocked from GET /revocations (403)
  [PASS] 2.6 Applicant blocked from POST /certificates (403)
  [PASS] 2.7 Applicant blocked from POST /certificates/:id/revoke (403)
  [PASS] 2.8 Verifier blocked from GET /dashboard/stats (403)
  [PASS] 2.9 Verifier blocked from GET /issuers (403)
  [PASS] 2.10 Verifier blocked from GET /revocations (403)
  [PASS] 2.11 Verifier blocked from POST /certificates/:id/revoke (403)
  [PASS] 2.12 Verifier blocked from POST /certificates (403)

--- 3. Object-Level Access Control (Applicant Isolation) ---
  [PASS] 3.1 Asha can access own profile /applicants/1
  [PASS] 3.2 Asha blocked from accessing Kiran profile /applicants/2
  [PASS] 3.3 Asha blocked from modifying Kiran profile /applicants/2
  [PASS] 3.4 Asha cert list contains only owned issued certs (Kiran's cert 3 excluded, Draft cert 4 excluded)
  [PASS] 3.5 Asha accessing Kiran certificate /certificates/3 returns 404
  [PASS] 3.6 Asha accessing unissued certificate /certificates/4 returns 404
  [PASS] 3.7 Asha retrieving QR for Kiran's certificate /certificates/3/qr returns 404

--- 4. SQL Injection & Input Validation ---
  [PASS] 4.1 SQL injection payloads in /verify handled safely without SQL execution
  [PASS] 4.2 Malformed JSON returns HTTP 400 without crashing
  [PASS] 4.2b Malformed JSON in /auth/login returns HTTP 400
  [PASS] 4.3 Extremely long input handled gracefully (no server crash)
  [PASS] 4.4 Non-numeric path parameter handled safely (400 or 404)
  [PASS] 4.5 Negative path parameter safely rejected (403 or 404)

--- 5. Information Disclosure & PII Protection ---
  [PASS] 5.1 Public verification succeeds for DCVS-2026-001
  [PASS] 5.1b Public verification does NOT expose Aadhaar card
  [PASS] 5.1c Public verification does NOT expose emails or phones
  [PASS] 5.1d Public verification does NOT expose address / street
  [PASS] 5.1e Public verification does NOT expose internal account IDs
  [PASS] 5.2 Invalid verification sets certificate to null
  [PASS] 5.3 Database errors are sanitized (no unhandled PL/SQL stack traces)

======================================================================
M6 Security Suite Summary: 45 PASSED, 0 FAILED
======================================================================
```

---

## 8. Remaining Known Security Considerations
1. **Network Layer Encryption (HTTPS):** In this local development / testing container environment, ORDS is served via HTTP (`http://localhost:8080`). For production deployment, a reverse proxy (Nginx or Traefik) terminating TLS 1.3 is recommended.
2. **Rate Limiting:** Public endpoints (`POST /verify`, `POST /auth/login`) should be protected by IP rate-limiting at the reverse proxy or API gateway layer against credential stuffing and brute-force certificate reference enumeration.
