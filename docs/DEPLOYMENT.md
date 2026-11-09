# DCVS — Production Deployment and Setup Guide

This guide describes the complete setup, configuration, and deployment procedures for the Digital Certificate Verification System (DCVS).

---

## 1. System Architecture & Tech Stack

```
   ┌─────────────────────────────────────────────────────────────┐
   │                   React + Vite Frontend                     │
   │               (Track 3 Admin + Track 4 Public)              │
   │            Runs on Node.js / Static HTTP Hosting            │
   └──────────────────────────────┬──────────────────────────────┘
                                  │ JSON via HTTP/REST
                                  ▼
   ┌─────────────────────────────────────────────────────────────┐
   │             Oracle REST Data Services (ORDS)                │
   │                 Standalone Server (Port 8080)               │
   │                     Module: `dcvs.api`                      │
   └──────────────────────────────┬──────────────────────────────┘
                                  │ JDBC / Oracle SQL-Net
                                  ▼
   ┌─────────────────────────────────────────────────────────────┐
   │                Oracle Database 26ai Free                    │
   │             Pluggable Database: `FREEPDB1`                  │
   │                Schema: `DCVS` (PL/SQL API)                  │
   └─────────────────────────────────────────────────────────────┘
```

### Technology Matrix
- **Database:** Oracle Database 26ai Free (Pluggable Database: `FREEPDB1`).
- **REST Gateway:** Oracle REST Data Services (ORDS) v24+.
- **Frontend Framework:** React 18 with Vite.
- **Styling:** Custom Semantic CSS (`src/styles.css` — Track 3) + Tailwind CSS (`src/tailwind.css` — Track 4).
- **Icons & Visualization:** Lucide React & Recharts.
- **Cryptographic Engine:** SHA-256 (`STANDARD_HASH`) + RSA Simulation in PL/SQL.

---

## 2. Database Setup & Initialization

### 2.1 Starting the Oracle Database Container (Podman / Docker)
```bash
podman run -d --name oracle-db \
  -p 1521:1521 -p 8080:8080 \
  -e ORACLE_PWD=YourStrongPassword \
  container-registry.oracle.com/database/free:latest
```

### 2.2 Schema & Data Setup
The database schema is organized into 9 numbered SQL scripts located in `DCVS_Updated_SQL_9_Files/`:
1. `01_entities.sql` — Tables, primary keys, check constraints.
2. `02_relationships.sql` — Foreign keys and referential integrity constraints.
3. `03_multivalued.sql` — Applicant & Verifier email and phone array tables.
4. `04_views.sql` — Derived views (`v_certificate_detail`, `v_applicant_list`).
5. `05_packages.sql` — Core PL/SQL API packages (`pkg_auth`, `pkg_api`, `pkg_applicant`, `pkg_certificate`, `pkg_verification`, etc.).
6. `06_triggers.sql` — State transitions, audit logging, and immutability rules.
7. `07_seed_data.sql` — Baseline credentials and test records.
8. `08_tests.sql` — SQL verification tests.
9. `09_ords_modules.sql` — ORDS REST templates, handlers, and parameter bindings.

Execute in order within `FREEPDB1`:
```bash
podman exec -i oracle-db sqlplus -s / as sysdba << 'EOF'
alter session set container = FREEPDB1;
@DCVS_Updated_SQL_9_Files/01_entities.sql
@DCVS_Updated_SQL_9_Files/02_relationships.sql
@DCVS_Updated_SQL_9_Files/03_multivalued.sql
@DCVS_Updated_SQL_9_Files/04_views.sql
@DCVS_Updated_SQL_9_Files/05_packages.sql
@DCVS_Updated_SQL_9_Files/06_triggers.sql
@DCVS_Updated_SQL_9_Files/07_seed_data.sql
@DCVS_Updated_SQL_9_Files/09_ords_modules.sql
exit;
EOF
```

---

## 3. Oracle REST Data Services (ORDS) Setup

ORDS maps the PL/SQL module `dcvs.api` to the REST base URL `http://localhost:8080/ords/dcvs/api`.

### 3.1 Verifying ORDS Health
```bash
curl -i http://localhost:8080/ords/dcvs/api/health
```
Expected response:
```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=UTF-8

{"status":"UP","database":"OK"}
```

---

## 4. Frontend Setup & Deployment

### 4.1 Prerequisites
- Node.js 18.0.0+
- npm 9.0.0+

### 4.2 Installation
```bash
cd frontend
npm install
```

### 4.3 Environment Configuration
Create `.env` inside `frontend/` (or copy from `.env.example`):
```bash
# In local development, leave empty so Vite automatically proxies /api -> http://localhost:8080/ords/dcvs/api
VITE_API_BASE_URL=

# In production deployment, specify the absolute URL of the deployed ORDS gateway:
# VITE_API_BASE_URL=https://dcvs-api.example.com/ords/dcvs/api
```

### 4.4 Local Development
```bash
npm run dev -- --host
```
The frontend is available at `http://localhost:5173/`.

### 4.5 Production Build
```bash
npm run build
```
Build artifacts are placed in `frontend/dist/`.

### 4.6 Production Static Hosting (Nginx Example)
```nginx
server {
    listen 80;
    server_name dcvs.example.com;

    root /var/www/dcvs/frontend/dist;
    index index.html;

    # Single Page Application (SPA) routing fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Reverse proxy to ORDS API
    location /ords/ {
        proxy_pass http://127.0.0.1:8080/ords/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 5. System Roles & Access Matrix

| Role | Default Username | Scope & Permissions | Default Landing Page |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin` | Full system control: Issue/Revoke certificates, manage types, issuers, verifiers, HR, and view analytics. | `/admin` |
| **HR** | `hr1` | Manage organizational verifiers and view salary/leave records. | `/admin/hr` |
| **VERIFIER** | `verifier1` | Public and authenticated credential verification; logging to audit trail. | `/admin/verifications` |
| **APPLICANT** | `asha` | Self-service portal: view owned certificates, QR download, profile updates. | `/portal` |
| **PUBLIC** | *(Anonymous)* | Manual certificate lookup and camera QR scanning (`/verify`). | `/` |

---

## 6. Verification and Acceptance Testing

### 6.1 Automated Contract & Integration Test
```bash
node scripts/check-api.mjs
```
Validates all 13 endpoint categories, 6-state verification matrix, and RBAC guards.

### 6.2 Security Audit Suite
```bash
python3 scratch/test_m6_security.py
```
Validates 45 security test cases including token invalidation, injection prevention, and PII protection.

### 6.3 UI/UX & Responsive Suite
```bash
cd frontend && node scripts/test_m8_uiux_responsive.mjs
```
Validates 33 interactive assertions across 4 responsive device viewports.

---

## 7. Known Architectural Limitations & Boundaries

1. **Certificate Application Submission:** The database schema has no `application` or `certificate_application` table. Certificate generation is performed directly by administrators via `POST /certificates` and issued via `POST /certificates/:id/issue`. The frontend does not expose a mock or disconnected application submission form.
2. **Network Encryption:** Local development runs ORDS over plain HTTP. Production deployments must place ORDS behind a TLS 1.3 reverse proxy (e.g. Nginx, Cloudflare) with HTTP Strict Transport Security (HSTS).
3. **Database Reset Policy:** Seed data and database tables must never be dropped or rerun in a live environment to preserve cryptographic signatures, audit logs, and issued certificate history.
