<USER_REQUEST>
# DCVS — AUTONOMOUS FINAL EXECUTION MASTER PROMPT
## M6 + M7 + M8 + Complete System Integration + Final Release

You are authorized to autonomously complete all remaining stages of the Digital Certificate Verification System (DCVS).

**Your objective is to finish the entire project, validate all functionality, resolve all safely fixable defects, prepare deployment documentation and deliver one comprehensive final report.**

You have authorization to proceed through M6, M7 and M8 without requesting approval between stages.

Do not stop after planning.
Do not ask for approval after each stage.
Do not leave work unfinished simply because an intermediate stage is complete.

Continue until the entire authorized scope is completed.

---

# 1. PROJECT ARCHITECTURE — MUST REMAIN UNCHANGED

The existing system uses:

- Oracle Database 26ai Free
- PL/SQL packages and triggers
- Oracle REST Data Services (ORDS)
- React + Vite frontend

Existing API:

`http://localhost:8080/ords/dcvs/api`

Database PDB: `FREEPDB1`

The architecture must remain unchanged.

Do not introduce:
- Express
- Firebase
- MongoDB
- Supabase
- PostgreSQL
- A second database
- A separate backend server
- Unnecessary frameworks or services

Oracle and ORDS remain the only backend.

# 2. MANDATORY PRESERVATION OF ORIGINAL TEAM CONTRIBUTIONS

This requirement applies to every stage.

The project contains original code and UI/UX contributed by:

**Sriya**
- Admin frontend
- Admin dashboard
- CRUD pages
- Admin components
- HR and verifier management pages

**Manideep**
- Public frontend
- Applicant portal
- Applicant dashboard
- Certificate details
- Applicant profile management
- Public layouts and components

Their work is the official project baseline.

Before making changes:

1. Locate and inspect their original source files.
2. Compare the original code with the current integrated implementation.
3. Identify original layouts, styles, components, assets and interactions.
4. Reuse their original code wherever possible.
5. Preserve their visual identity and functionality.
6. Do not unnecessarily rewrite working components.
7. Do not replace their interfaces with generic generated dashboards.
8. Do not overwrite original files without understanding their purpose.

Preserve:
- Original colors
- Typography
- Spacing
- Layouts
- Components
- Navigation
- Animations
- Assets
- Responsive behavior
- Existing interactions

If original files are missing, search the repository and existing project directories. If they genuinely cannot be recovered, document the limitation and continue with unrelated work. Do not fabricate their original code.

Maintain a record of original files reused, restored and modified.

# 3. EXECUTION POLICY — AUTONOMOUS COMPLETION

Execute M6, M7 and M8 sequentially without waiting for intermediate approval.

For every stage:

1. Inspect the existing implementation.
2. Identify defects.
3. Implement safe corrections.
4. Run relevant tests.
5. Fix failures.
6. Run regression tests.
7. Document results.
8. Continue to the next stage.

You are authorized to make ordinary frontend, API-client, testing, configuration and documentation changes necessary to complete the project.

You are also authorized to make non-destructive backend code corrections when clearly required, provided that:
- Existing architecture is preserved.
- Existing API contracts remain compatible.
- No database schema or seed data is destructively modified.
- Changes are tested.
- A backup or recovery path exists.

## Operations that remain prohibited without my intervention

Do not:
- Reset or drop the database.
- Delete existing seed records.
- Rerun database setup or seed scripts.
- Revoke original seed certificates.
- Delete existing audit history.
- Perform destructive schema migrations.
- Overwrite original team source files without a recovery copy.
- Expose real passwords, tokens, private keys or credentials.
- Weaken security controls to make tests pass.

If an operation requires one of these actions, do not execute it.

Document the exact blocker, preserve the current state and continue with all independent tasks.

Do not stop the entire project because one optional test or operation is unavailable.

# 4. M6 — COMPLETE SECURITY HARDENING

Perform a comprehensive security audit of the frontend, ORDS handlers and PL/SQL packages.

## 4.1 Authentication

Inspect:
- Login
- Password handling
- Token generation
- Token expiry
- Token validation
- Logout
- Session invalidation
- `/auth/me`
- Session storage

Verify:
- Passwords are never exposed.
- Tokens are not hardcoded.
- Tokens are not logged.
- Invalid and expired tokens are rejected.
- Logout invalidates sessions appropriately.
- Role validation is enforced by the backend.

Treat previously exposed credentials and tokens as compromised. Do not reuse them.

Use supported mechanisms to invalidate or rotate compromised test credentials where safe.

Never print secrets in reports.

## 4.2 Authorization

Audit:
- ADMIN
- HR
- VERIFIER
- APPLICANT
- PUBLIC

Test direct API requests, not just React route guards.

Verify:
- Applicants cannot access other applicants' records.
- Applicants cannot issue or revoke certificates.
- Applicants cannot access administrator-only resources.
- Verifiers cannot perform administrator operations.
- HR permissions are appropriately restricted.
- Public verification exposes only permitted information.
- ID-based endpoints enforce object ownership.

## 4.3 SQL Injection and Input Validation

Inspect:
- PL/SQL dynamic SQL
- ORDS handlers
- JSON parsing
- URI parameters
- Request body handling
- Search and filtering parameters

Fix confirmed SQL injection vulnerabilities.

Validate malformed JSON, invalid IDs, empty inputs, long inputs, invalid dates and unexpected fields.

Preserve API compatibility.

## 4.4 XSS and Frontend Security

Inspect:
- Unsafe HTML rendering
- `dangerouslySetInnerHTML`
- User-controlled content
- Untrusted URLs
- QR URL construction
- API error rendering

Fix confirmed vulnerabilities.

## 4.5 CORS and ORDS

Inspect:
- CORS configuration
- ORDS privileges
- Public endpoint exposure
- Authentication enforcement
- HTTP methods
- Error handling

Do not weaken authorization.

## 4.6 Sensitive Information

Verify:
- No passwords in API responses.
- No authentication tokens in logs.
- Applicant identifiers are masked where appropriate.
- Personal information is not unnecessarily exposed.
- Database errors do not expose internal SQL details.

## 4.7 Security Regression

After fixing issues, retest every role and all major operations.

Produce `docs/SECURITY_AUDIT.md`.

Include vulnerabilities found, severity, remediation, remaining risks and evidence.

# 5. M7 — AUTOMATED API AND INTEGRATION TESTING

Create:

`scripts/check-api.mjs`

Use the real ORDS API.

Do not create a mock backend.

## 5.1 API coverage

Test all existing supported endpoints, including:

### Health and Authentication
- GET `/health`
- POST `/auth/login`
- GET `/auth/me`
- POST `/auth/logout`

### Applicants
- GET `/applicants`
- GET `/applicants/:id`
- POST `/applicants`
- PUT `/applicants/:id`
- DELETE `/applicants/:id`, if supported

### Certificate Types
- GET `/types`
- POST `/types`
- PUT `/types/:id`
- DELETE `/types/:id`

### Issuers
- GET `/issuers`
- POST `/issuers`
- PUT `/issuers/:id`
- DELETE `/issuers/:id`

### Certificates
- GET `/certificates`
- GET `/certificates/:id`
- POST `/certificates`
- POST `/certificates/:id/issue`
- GET `/certificates/:id/qr`
- GET `/certificates/:id/signature`
- POST `/certificates/:id/revoke`

### Revocations
- GET `/revocations`

### Verifiers
- GET `/verifiers`
- POST `/verifiers`
- PUT `/verifiers/:id`
- DELETE `/verifiers/:id`

### HR
- GET `/hr`
- POST `/hr`
- GET `/hr/:id`
- PUT `/hr/:id`
- DELETE `/hr/:id`

### Verification
- GET `/verifications`
- GET `/verifications/:id`
- POST `/verify`

### Dashboard
- GET `/dashboard/stats`
- GET `/dashboard/certificates`
- GET `/dashboard/verifications`

Include all actual applicant portal endpoints.

Only test endpoints that exist in the API contract and live ORDS definitions.

Unsupported endpoints must be reported as NOT SUPPORTED.

## 5.2 Role-Based Testing

Test:
- ADMIN
- HR
- VERIFIER
- APPLICANT
- PUBLIC

Test allowed and denied requests.

Verify object-level authorization.

## 5.3 Certificate Lifecycle

Use isolated test certificates.

Test:

`DRAFT → VALID → REVOKED`

Also test:
- Expired certificates.
- QR generation.
- Public verification.
- Revocation history.
- Signature validation.
- Hash validation.

Never modify seed certificates.

## 5.4 Public Verification

Test:
- VALID
- EXPIRED
- REVOKED
- DRAFT / unissued
- INVALID
- TAMPERED, if safely reproducible

Confirm public verification works without login.

Confirm authenticated verifier requests generate audit records.

## 5.5 Test Script Requirements

The test script must:
- Read configuration from environment variables.
- Never hardcode credentials.
- Never print tokens.
- Display PASS / FAIL / SKIPPED.
- Show HTTP status codes.
- Validate response structures.
- Return nonzero exit code for critical failures.
- Clean up only records created by its own tests, when safe.
- Preserve seed records.
- Support local development execution.

Create `.env.example` without actual credentials.

Document how to execute the test suite.

Produce `docs/TESTING.md`.

Run the tests against the actual Oracle + ORDS backend wherever it is available.

# 6. M8 — UI/UX PRESERVATION AND INTEGRATION AUDIT

The UI/UX has already been created by Sriya and Manideep.

This is NOT a redesign project.

## 6.1 Inspect all interfaces

Audit:
- Public home
- Public verification
- Login
- Admin dashboard
- Applicant management
- Issuer management
- Certificate management
- Certificate types
- Revocations
- HR
- Verifier
- Verification records
- Applicant dashboard
- Applicant profile
- Applicant certificate detail

## 6.2 Preserve original designs

Preserve:
- Layouts
- Colors
- Typography
- Cards
- Tables
- Forms
- Sidebar
- Navbar
- Footer
- Icons
- Spacing
- Animations
- Components
- Responsive behavior

Only fix genuine defects.

Do not replace original designs with generic templates.

## 6.3 Functional UI testing

Verify:
- Navigation links.
- Buttons.
- Forms.
- Search.
- Filters.
- Pagination.
- Modals.
- Confirmation dialogs.
- QR generation.
- QR scanning.
- Loading states.
- Empty states.
- Error messages.
- Successful-operation refreshes.

Every visible control must work as advertised.

## 6.4 Responsive testing

Test:
- 1920 × 1080
- 1366 × 768
- 768 × 1024
- 390 × 844

Fix genuine overflow, broken layouts and unusable controls without changing the original visual identity.

## 6.5 Accessibility

Check:
- Keyboard navigation.
- Labels.
- Focus visibility.
- Color contrast.
- Semantic structure.
- Modal accessibility.
- Screen-reader-friendly status indicators.

Produce `docs/UI_UX_AUDIT.md`.

# 7. FINAL SYSTEM INTEGRATION

After M6–M8, run a complete regression audit.

## 7.1 Build

Run:

```bash
cd frontend
npm run build
```

Fix actual build errors and broken imports.

## 7.2 Backend connectivity

Verify:
- Oracle is accessible.
- FREEPDB1 is open.
- ORDS is running.
- API health responds.
- Vite proxy configuration is correct.
- Production API configuration is correct.

A successful frontend build alone is not sufficient.

## 7.3 Complete E2E testing

### ADMIN
- Login
- Dashboard
- Applicants
- Issuers
- Certificate types
- Certificate creation
- Certificate issuing
- Revocation
- Revocation history
- Verifiers
- HR
- Verification records
- Logout

### HR
- Login
- HR dashboard
- Permitted verifier operations
- Profile
- Logout

### VERIFIER
- Login
- Verification
- Audit trail
- Logout

### APPLICANT
- Login
- Dashboard
- Profile
- Certificate listing
- Certificate details
- QR retrieval
- Logout

### PUBLIC
- Home
- Manual verification
- URL auto-verification
- QR generation
- Camera QR scanning
- QR image upload
- VALID
- EXPIRED
- REVOKED
- INVALID
- TAMPERED, if safely reproducible

## 7.4 Database integrity

Confirm:
- Original seed certificates remain unchanged.
- No unintended duplicate records exist.
- Test records are identified.
- Test profile modifications have been restored where appropriate.
- No database reset occurred.
- No seed scripts were rerun.
- Audit history remains intact.

Do not delete old test records indiscriminately.

# 8. DEPLOYMENT AND DOCUMENTATION

Update or create:

- `README.md`
- `docs/API_CONTRACT.md` where actual changes require it
- `docs/DEPLOYMENT.md`
- `docs/SECURITY_AUDIT.md`
- `docs/TESTING.md`
- `docs/UI_UX_AUDIT.md`
- `docs/TEAM_CONTRIBUTIONS.md`

Document:
- Architecture
- Technology stack
- Database setup
- ORDS startup
- Frontend startup
- Environment variables
- Authentication roles
- API endpoints
- Security findings
- Testing commands
- Deployment instructions
- Known limitations

Explicitly document that certificate application submission is not supported by the current database/API schema.

Never include real passwords, tokens or private keys.

# 9. EXECUTION ORDER — NO INTERMEDIATE APPROVAL

Execute in this order without waiting for me:

1. Repository inspection and original team-code preservation audit.
2. M6 security hardening.
3. M6 security regression.
4. M7 automated API test implementation.
5. M7 live API testing and failure correction.
6. M8 UI/UX preservation and consistency audit.
7. Responsive and functional UI testing.
8. Complete M3–M8 regression.
9. Database integrity verification.
10. Production build.
11. Deployment documentation.
12. Final release report.

If a test cannot be executed, report NOT TESTED and continue.

If a fix is blocked by a missing dependency, document the blocker and continue with other tasks.

Do not wait for approval between M6, M7 and M8.

# 10. FINAL DELIVERABLE

Produce:

**DCVS — FINAL PROJECT COMPLETION AND RELEASE REPORT**

Include:

1. Executive summary.
2. Final architecture.
3. M6 security audit and vulnerabilities fixed.
4. Remaining security risks.
5. M7 automated API test coverage.
6. Actual test counts: PASS / FAIL / SKIPPED.
7. M8 UI/UX audit.
8. Sriya's original code preserved.
9. Manideep's original code preserved.
10. Files created and modified.
11. Full role-based E2E results.
12. Public verification results.
13. QR scanner results.
14. Cryptographic integrity test results.
15. Database integrity report.
16. Production build output.
17. Deployment instructions.
18. Known limitations.
19. Final release readiness assessment.

Clearly distinguish:
- PASS
- FAIL
- NOT TESTED
- NOT SUPPORTED
- BLOCKED

Do not invent successful results.

Do not claim production readiness if critical tests remain failed or untested.

## FINAL AUTHORIZATION

You are authorized to complete M6, M7 and M8 autonomously without requesting intermediate approval.

Make all safe, non-destructive changes necessary to complete the project.

Preserve the original contributions of Sriya and Manideep.

Do not reset the database, delete seed records or perform destructive migrations.

Do not stop merely because one optional feature or test is blocked.

Continue until all authorized work is complete.

**Your final response must contain the complete project completion report, actual test evidence, build result, deployment instructions and remaining limitations.**

Do not begin a new feature stage after M8. Stop only after delivering the final report or when a genuinely unavoidable user intervention is required.
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-11-09T03:49:37+05:30.
</ADDITIONAL_METADATA>