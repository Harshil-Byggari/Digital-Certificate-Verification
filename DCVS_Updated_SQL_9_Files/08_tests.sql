-- 08_tests.sql : run each block separately in SQL Workshop > SQL Commands (or SQL Scripts)

-- T1. Objects exist
SELECT table_name FROM user_tables ORDER BY table_name;
SELECT object_name, status FROM user_objects WHERE object_type IN ('PACKAGE','PACKAGE BODY','TRIGGER','VIEW') ORDER BY 1;   -- all VALID

-- T2. Constraints
SELECT constraint_name, table_name, constraint_type, status FROM user_constraints
 WHERE table_name NOT LIKE 'APEX$%' AND table_name NOT LIKE 'DR$%' ORDER BY table_name, constraint_type;

-- T3. Derived attributes
SELECT hr_id, basic, da, hra, salary FROM hr;                                   -- salary = basic+da+hra
SELECT certificate_no, title, status FROM v_certificate_detail ORDER BY certificate_id;  -- VALID, EXPIRED, REVOKED, DRAFT

-- T4. Verification outcomes
SELECT pkg_verification.verify((SELECT certificate_no FROM certificate WHERE title='B.Tech Degree Certificate'),'MANUAL',NULL,'127.0.0.1','sql-test') AS valid_case FROM dual;
SELECT pkg_verification.verify((SELECT certificate_no FROM certificate WHERE title='Summer Internship 2025'),'MANUAL',NULL,'127.0.0.1','sql-test') AS expired_case FROM dual;
SELECT pkg_verification.verify((SELECT certificate_no FROM certificate WHERE title='Embedded Systems Course'),'QR',NULL,'127.0.0.1','sql-test') AS revoked_case FROM dual;
SELECT pkg_verification.verify('DCVS-0000-999','MANUAL',NULL,'127.0.0.1','sql-test') AS unknown_case FROM dual;

-- T5. Tamper test (run these 3 statements together, then rollback so data stays clean)
UPDATE certificate SET title = 'B.Tech Degree Certificate (EDITED)' WHERE title = 'B.Tech Degree Certificate';
SELECT pkg_verification.verify((SELECT certificate_no FROM certificate WHERE title LIKE 'B.Tech Degree Certificate (EDITED)'),'MANUAL',NULL,'127.0.0.1','sql-test') AS tampered_case FROM dual;  -- TAMPERED
ROLLBACK;

-- T6. Constraint / trigger tests (each must FAIL with the shown error)
-- DELETE FROM certificate WHERE title='B.Tech Degree Certificate';                       -- ORA-20040
-- UPDATE revocation SET reason='x';                                                      -- ORA-20041
-- INSERT INTO applicant(first_name,last_name,dob,aadhar_card) VALUES('A','B',DATE '2000-01-01','123');  -- ORA-02290
-- DELETE FROM hr WHERE hr_id=1;                                                          -- ORA-02292 (verifier assigned)

-- T7. Login helper check
SELECT username, user_type, applicant_id, verifier_id, hr_id FROM account ORDER BY account_id;
SELECT * FROM verification ORDER BY verification_id DESC;
