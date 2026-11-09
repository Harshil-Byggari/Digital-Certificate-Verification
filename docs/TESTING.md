# DCVS — Automated Testing and Quality Assurance Guide (Stage M7)

This document provides instructions and specifications for running the automated test suites of the Digital Certificate Verification System (DCVS).

---

## 1. Overview of Test Suites

The DCVS testing framework consists of four primary suites:
1. **API & Contract Test Suite (`scripts/check-api.mjs`)**: Comprehensive integration test suite validating all ORDS endpoints, CRUD workflows, certificate lifecycle (`DRAFT → VALID → REVOKED`), 6-state public verification matrix, dashboard metrics, and role boundaries.
2. **Security Hardening Suite (`scratch/test_m6_security.py`)**: 45 security test cases covering authentication hardening, token invalidation, role-based escalation prevention, object-level scoping, and SQL injection immunity.
3. **Puppeteer UI/UX & Responsive Suite**: Browser-driven end-to-end testing across 4 viewports (Desktop 1920×1080, Laptop 1366×768, Tablet 768×1024, Mobile 390×844) validating navigation, search, filters, modals, and QR scanning.
4. **Cryptographic Integrity Suite (`scratch/test_crypto_integrity.py`)**: SHA-256 hash recalculation and HMAC/signature verification against isolated tampered records.

---

## 2. Prerequisites

- **Node.js:** v18.0.0 or later (uses native `fetch`).
- **Python:** 3.8+ (for security regression suite).
- **Backend Services:** Oracle Database 26ai Free (`FREEPDB1`) and Oracle REST Data Services (ORDS) running at `http://localhost:8080/ords/dcvs/api`.

---

## 3. Running the Automated API Test Suite

### Default Execution (Local ORDS)
From the repository root:
```bash
node scripts/check-api.mjs
```
Or from the `frontend/` directory:
```bash
node scripts/check-api.mjs
```

### Execution with Custom Environment Variables
```bash
DCVS_API_BASE="http://localhost:8080/ords/dcvs/api" \
DCVS_ADMIN_USER="admin" \
DCVS_ADMIN_PASS="Admin@1234" \
DCVS_APPLICANT_USER="asha" \
DCVS_APPLICANT_PASS="Applicant@123" \
DCVS_VERIFIER_USER="verifier1" \
DCVS_VERIFIER_PASS="Verifier@123" \
DCVS_HR_USER="hr1" \
DCVS_HR_PASS="Hr@12345" \
node scripts/check-api.mjs
```

### Exit Codes
- `0`: All tests passed.
- `1`: One or more tests failed.

---

## 4. Test Coverage Matrix (`scripts/check-api.mjs`)

| Test Category | Endpoints Tested | Expected Status Codes | Result |
| :--- | :--- | :--- | :--- |
| **Health & Auth** | `GET /health`, `GET /ping`, `POST /auth/login` (4 roles), `GET /auth/me`, `POST /auth/logout` | 200, 200, 200, 200, 200 | **PASS** |
| **Certificate Types** | `GET /types`, `POST /types`, `GET /types/:id`, `PUT /types/:id`, `DELETE /types/:id` | 200, 201, 200, 200, 200 | **PASS** |
| **Issuers** | `GET /issuers`, `POST /issuers`, `GET /issuers/:id`, `PUT /issuers/:id`, `DELETE /issuers/:id` | 200, 201, 200, 200, 200 | **PASS** |
| **Applicants** | `GET /applicants`, `GET /applicants/1`, `DELETE /applicants/:id` | 200, 200, 404/409 | **PASS** |
| **Certificate Lifecycle** | `GET /certificates`, `POST /certificates` (DRAFT), `POST /certificates/:id/issue` (VALID), `GET /qr`, `GET /signature`, `POST /revoke` (REVOKED) | 200, 201, 200, 200, 200, 201 | **PASS** |
| **Revocations** | `GET /revocations`, `GET /revocations/:id` | 200, 200 | **PASS** |
| **HR Management** | `GET /hr`, `POST /hr`, `GET /hr/:id`, `PUT /hr/:id`, `DELETE /hr/:id` | 200, 201, 200, 200, 200 | **PASS** |
| **Verifiers Management** | `GET /verifiers`, `POST /verifiers`, `GET /verifiers/:id`, `PUT /verifiers/:id`, `DELETE /verifiers/:id` | 200, 201, 200, 200, 200 | **PASS** |
| **Public Verification Matrix** | `POST /verify` (VALID, EXPIRED, REVOKED, DRAFT, INVALID, TAMPERED, QR Verifier) | 200 (All 7 variations) | **PASS** |
| **Verifications Audit** | `GET /verifications`, `GET /verifications/:id` | 200, 200 | **PASS** |
| **Dashboard Analytics** | `GET /dashboard/stats`, `GET /dashboard/certificates`, `GET /dashboard/verifications` | 200, 200, 200 | **PASS** |
| **RBAC Security Guards** | 401 unauth guard, 403 applicant guard, 403 verifier guard, 403 cross-applicant guard | 401, 403, 403, 403 | **PASS** |
| **Unsupported Endpoints** | `POST /applications` | 404 | **NOT SUPPORTED** |

---

## 5. Live Test Run Evidence

```
===========================================================================
DCVS — Stage M7 Automated API & Integration Test Suite
Target Base URL: http://localhost:8080/ords/dcvs/api
===========================================================================

--- 1. Health and Authentication Endpoints ---
  [PASS] GET /health responds with 200 OK (status=200)
  [PASS] GET /ping responds with 200 OK (status=200)
  [PASS] POST /auth/login (ADMIN) (role=ADMIN)
  [PASS] GET /auth/me (ADMIN) (username=admin)
  [PASS] POST /auth/login (APPLICANT) (linked_id=1)
  [PASS] POST /auth/login (VERIFIER) (user_type=VERIFIER)
  [PASS] POST /auth/login (HR) (user_type=HR)
  [PASS] POST /auth/logout invalidates session token immediately (next request returned 401)

--- 2. Certificate Types CRUD ---
  [PASS] GET /types (count=7)
  [PASS] POST /types (Create) (type_id=43, status=201)
  [PASS] GET /types/:id (type_name=AutoType_1794177028386)
  [PASS] PUT /types/:id (Update) (status=200)
  [PASS] DELETE /types/:id (Delete isolated record) (status=200)

--- 3. Issuers CRUD ---
  [PASS] GET /issuers (count=6, organisation=true)
  [PASS] POST /issuers (Create) (issuer_id=43, status=201)
  [PASS] GET /issuers/:id (issuer_name=AutoIssuer_9308)
  [PASS] PUT /issuers/:id (Update) (status=200)
  [PASS] DELETE /issuers/:id (Delete isolated record) (status=200)

--- 4. Applicants Endpoints ---
  [PASS] GET /applicants (ADMIN) (count=5)
  [PASS] GET /applicants/1 (Asha profile) (first_name=Asha)
  [PASS] DELETE /applicants/:id safely handled (status=404)

--- 5. Certificate Full Lifecycle & Endpoints ---
  [PASS] GET /certificates (ADMIN) (total=12)
  [PASS] POST /certificates (Create DRAFT) (cert_id=32, cert_no=DCVS-2026-016, status=201)
  [PASS] GET /certificates/:id (DRAFT state) (status=DRAFT)
  [PASS] POST /certificates/:id/issue (Issue Certificate) (status=200)
  [PASS] GET /certificates/:id (VALID state with signature & hash) (hash=e516fe13...)
  [PASS] GET /certificates/:id/qr (url=http://localhost:5173/verify?ref=DCVS-2026-016)
  [PASS] GET /certificates/:id/signature (sig_present=true)
  [PASS] POST /certificates/:id/revoke (Revoke Certificate) (status=201)
  [PASS] GET /certificates/:id (REVOKED state) (status=REVOKED, reason=Automated lifecycle test revocation 37537)

--- 6. Revocations Endpoints ---
  [PASS] GET /revocations (count=6)
  [PASS] GET /revocations/:id (revocation_id=25)

--- 7. HR Management CRUD ---
  [PASS] GET /hr (count=2)
  [PASS] POST /hr (Create) (hr_id=43, status=201)
  [PASS] GET /hr/:id (basic=55000)
  [PASS] PUT /hr/:id (Update) (status=200)
  [PASS] DELETE /hr/:id (Delete isolated record) (status=200)

--- 8. Verifiers Management CRUD ---
  [PASS] GET /verifiers (count=2, organization=true)
  [PASS] POST /verifiers (Create) (verifier_id=43, status=201)
  [PASS] GET /verifiers/:id (first_name=TestVerifier)
  [PASS] PUT /verifiers/:id (Update) (status=200)
  [PASS] DELETE /verifiers/:id (Delete isolated record) (status=200)

--- 9. Public Verification 6-State Matrix ---
  [PASS] State 1: VALID (DCVS-2026-001) (hash_valid=true, sig_valid=true)
  [PASS] State 2: EXPIRED (DCVS-2026-002) (result=EXPIRED, message=Expired on 2025-12-31)
  [PASS] State 3: REVOKED (DCVS-2026-003) (result=REVOKED, message=Revoked on 2026-11-08)
  [PASS] State 4: DRAFT / Unissued (DCVS-2026-004) (result=INVALID, message=Certificate has not been issued)
  [PASS] State 5: INVALID (Non-existent reference) (result=INVALID, cert=null)
  [PASS] State 6: TAMPERED (DCVS-2026-012 cryptographic mismatch detected) (hash_valid=true, sig_valid=false)
  [PASS] POST /verify (QR Method with Verifier session) (method=QR, verifier_captured=true)

--- 10. Verifications Audit Trail ---
  [PASS] GET /verifications (ADMIN) (count=153)
  [PASS] GET /verifications/:id (verification_id=172)

--- 11. Dashboard Analytics Endpoints ---
  [PASS] GET /dashboard/stats (total_certificates=13, valid=5)
  [PASS] GET /dashboard/certificates (categories=by_month, by_type, by_issuer, by_status)
  [PASS] GET /dashboard/verifications (categories=by_day, by_result, by_method)

--- 12. Role-Based Access Control (RBAC) Guards ---
  [PASS] Unauthenticated request to protected endpoint returns 401
  [PASS] APPLICANT blocked from /dashboard/stats (403)
  [PASS] VERIFIER blocked from /certificates/:id/revoke (403)
  [PASS] APPLICANT blocked from accessing other applicant profile (403)

--- 13. Architectural Boundary & Unsupported Endpoints ---
  [NOT SUPPORTED] POST /applications — Database schema has no application table; certificates are directly issued by administrators

===========================================================================
Test Execution Summary:
  PASS:          58
  FAIL:          0
  SKIPPED:       0
  NOT SUPPORTED: 1
===========================================================================
```
