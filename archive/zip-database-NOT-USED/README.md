# Oracle Database Setup Guide — Digital Certificate Verification System

This directory contains the production-ready Oracle Database DDL, integrity constraints, views, stored procedures, and seed data scripts for the Digital Certificate Verification System.

## Execution Sequence

Execute the SQL scripts in this exact numbered sequence to satisfy foreign key dependencies:

```bash
# Connect to your Oracle instance (PDB or XE) as privileged user or application user:
sqlplus certitrust_admin/your_password@localhost:1521/XEPDB1

# 1. Create all base entities and child tables for multivalued attributes
@01_create_tables.sql

# 2. Add relational foreign key constraints matching ER diagram
@02_relationships.sql

# 3. Add integrity constraints and performance B-Tree indexes
@03_constraints.sql

# 4. Create business views for derived attributes (Salary, Status)
@04_views.sql

# 5. Create stored functions (SHA-256) and audit procedures
@05_functions_procedures.sql

# 6. Load realistic seed data for all entities
@06_seed_data.sql
```

## Environment Variables Configuration

In `backend/.env`, specify your Oracle connection details:

```env
PORT=5000
NODE_ENV=development
ORACLE_USER=certitrust_admin
ORACLE_PASSWORD=your_password
ORACLE_CONNECT_STRING=localhost:1521/XEPDB1
JWT_SECRET=super_secure_jwt_secret_key_2026
```

