DCVS — UPDATED SQL PACKAGE (9 FILES)

Run these scripts in Oracle APEX SQL Workshop > SQL Scripts, in this order,
using the DCVS parsing schema (the schema that owns the tables/packages):

1. 01_entities.sql
2. 02_relationships.sql
3. 03_multivalued.sql
4. 04_views.sql
5. 05_packages.sql
6. 06_triggers.sql
7. 07_seed_data.sql
8. 08_tests.sql (validation/test queries; run selectively as needed)
9. 09_ords_modules.sql (publishes ORDS module dcvs.api at /api/)

Important:
- These are the nine application scripts. The former patch scripts 10, 12 and 13
  have been merged into 05_packages.sql. Request-body parsing fixes and the /health
  and /verify handlers are merged into 09_ords_modules.sql.
- 09_ords_modules.sql deletes and recreates the ORDS module dcvs.api. Re-running it
  republishes all routes in that module.
- The schema must already be ORDS-enabled with alias `dcvs`.
- Do NOT run 08_tests.sql as part of a production deployment; it includes test actions.
- The optional 00_reset.sql is intentionally not included: it drops project tables,
  packages, sequences and views.
- Rotate the sample passwords before using the application beyond local testing.
