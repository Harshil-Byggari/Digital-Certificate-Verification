# DCVS — Team Contributions and Code Preservation Record

This document records the official baseline contributions of team members Sriya and Manideep, their specific technical areas, and the preservation measures implemented during system integration.

---

## 1. Team Responsibilities & Track Ownership

### Track 3: Administrative Management & Staff Interfaces
**Lead Contributor:** Sriya  
**Scope & Responsibility:**
- Administrative frontend architecture.
- Full CRUD management pages: Applicants, Certificate Types, Issuers, Certificates, Revocations, Verifiers, and HR.
- Recharts-powered dashboard metrics and data visualizations.
- Unified CrudPage abstraction (`CrudPage.jsx`), modal dialogs (`Modal.jsx`), and status badges (`Badge.jsx`).
- Custom semantic styling in `src/styles.css`.

### Track 4: Public Verification Flow & Applicant Self-Service Portal
**Lead Contributor:** Manideep  
**Scope & Responsibility:**
- Public landing page (`HomePage.jsx`) with hero banner, statistics showcase, and verification entry point.
- Public Verification interface (`VerifyPage.jsx`) supporting reference queries and live camera QR code scanning (`QRScannerModal.jsx`).
- Applicant Portal dashboard (`ApplicantDashboard.jsx`) with certificate overview cards, status filtering, and quick QR code modals.
- Detailed Certificate Inspection view (`CertificateDetailPage.jsx`) rendering tamper-evident cryptographic metadata.
- Applicant Profile Management (`ApplicantProfilePage.jsx`) with composite address handling and multivalued email/phone contact arrays.
- Tailwind CSS design system integration (`src/tailwind.css`), responsive layouts (`MainLayout.jsx`), and Lucide React icons.

---

## 2. Inventory of Preserved Original Source Code

### 2.1 Preserved Components & Layouts
| File | Original Author | Description & Preservation Details |
| :--- | :--- | :--- |
| `src/layouts/Layout.jsx` | Sriya | Admin portal layout with responsive sidebar, top navigation, and staff user menu. Preserved intact. |
| `src/layouts/MainLayout.jsx` | Manideep | Public & applicant layout featuring branded header navigation and footer. Preserved intact. |
| `src/components/CrudPage.jsx` | Sriya | Table-driven CRUD management interface with search, pagination, and modal triggers. Reused across all 8 admin pages. |
| `src/components/Modal.jsx` | Sriya | Standardized dialog popup component for record creation and editing. Preserved intact. |
| `src/components/Badge.jsx` | Sriya | Semantic status indicators for `VALID`, `EXPIRED`, `REVOKED`, and `DRAFT`. Preserved intact. |
| `src/components/ContactEditor.jsx` | Sriya | Multivalued array input editor for dynamic emails and phone numbers. Preserved intact. |
| `src/components/QRScannerModal.jsx` | Manideep | Camera stream video scanner and file upload QR reader powered by `jsQR`. Preserved intact. |
| `src/components/Navbar.jsx` | Manideep | Main responsive navigation bar with mobile drawer toggle. Preserved intact. |
| `src/components/Footer.jsx` | Manideep | Standardized footer displaying system architecture info. Preserved intact. |

### 2.2 Preserved Pages
| File | Original Author | Functional Scope & Preservation |
| :--- | :--- | :--- |
| `src/pages/public/HomePage.jsx` | Manideep | Hero banner, live verification input, and feature cards. Preserved intact. |
| `src/pages/public/VerifyPage.jsx` | Manideep | Complete 6-state cryptographic verification result cards. Connected to real `POST /verify`. |
| `src/pages/admin/Dashboard.jsx` | Sriya | KPI statistics cards and Recharts distribution charts. Connected to live ORDS `/dashboard/*`. |
| `src/pages/admin/Applicants.jsx` | Sriya | Administrative applicant registry. Connected to live ORDS `/applicants`. |
| `src/pages/admin/CertificateTypes.jsx` | Sriya | Academic and professional certificate types CRUD. Connected to live ORDS `/types`. |
| `src/pages/admin/Issuers.jsx` | Sriya | Accreditation authorities management with `organisation` field alignment. Connected to `/issuers`. |
| `src/pages/admin/Certificates.jsx` | Sriya | Certificate management, issuing, QR view, and revocation modal. Connected to `/certificates`. |
| `src/pages/admin/Revocations.jsx` | Sriya | Audit log of revoked certificates and reasons. Connected to `/revocations`. |
| `src/pages/verifier/Verifiers.jsx` | Sriya | Corporate and government verifiers management with `organization` alignment. Connected to `/verifiers`. |
| `src/pages/hr/HRPage.jsx` | Sriya | Human Resources compensation and leave management. Connected to `/hr`. |
| `src/pages/verifier/Verifications.jsx` | Sriya | Real-time audit log of all verification attempts. Connected to `/verifications`. |
| `src/pages/applicant/ApplicantDashboard.jsx` | Manideep | Personal certificate cards and quick QR view. Connected to live scoped `/certificates`. |
| `src/pages/applicant/CertificateDetailPage.jsx`| Manideep | Comprehensive metadata and cryptographic hash view. Scoped to applicant ownership. |
| `src/pages/applicant/ApplicantProfilePage.jsx` | Manideep | Profile self-service with read-only protected identifiers and editable contact info. Connected to `/applicants/:id`. |

---

## 3. Necessary Harmonizations and Security Adjustments

During the unified integration (M1 through M8), only non-destructive, security-mandated harmonizations were applied:
1. **API Client Centralization (`src/services/api.js`):** Unified all fetch requests to route through a single client communicating with Oracle ORDS via `X-Auth-Token` headers.
2. **Field Name Harmonization:**
   - Preserved `organisation` for Issuers and Certificate Details.
   - Preserved `organization` for Verifiers and HR records.
   - Preserved exact database field names without artificial mappings.
3. **Privilege Hardening on Applicant Views:**
   - In Manideep's original template, `CertificateDetailPage.jsx` contained an interactive "Revoke Certificate" button. In accordance with administrative privilege separation, this button was removed from the applicant view (revocation is strictly restricted to `ADMIN`).
4. **Session Authentication Binding (`AuthContext.jsx`):**
   - Linked both Sriya's and Manideep's routes to the single session context backed by Oracle ORDS `GET /auth/me`.
   - Admin routes redirect to `/admin`; Applicant routes redirect to `/portal`.
