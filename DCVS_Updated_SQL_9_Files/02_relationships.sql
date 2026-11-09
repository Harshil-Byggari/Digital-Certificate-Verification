-- 02_relationships.sql : every diamond of the ER diagram as a foreign key

-- APPLICANT 1 --RECEIVES-- N CERTIFICATE
ALTER TABLE certificate ADD CONSTRAINT fk_cert_applicant FOREIGN KEY (applicant_id) REFERENCES applicant(applicant_id);
-- CERTIFICATE_TYPE 1 --HAS_TYPE-- N CERTIFICATE
ALTER TABLE certificate ADD CONSTRAINT fk_cert_type      FOREIGN KEY (type_id)      REFERENCES certificate_type(type_id);
-- ISSUER 1 --ISSUES-- N CERTIFICATE
ALTER TABLE certificate ADD CONSTRAINT fk_cert_issuer    FOREIGN KEY (issuer_id)    REFERENCES issuer(issuer_id);
-- CERTIFICATE 1 --HAS_REVOCATION-- 1 REVOCATION  (UNIQUE uq_revocation_cert makes it 1:1)
ALTER TABLE revocation  ADD CONSTRAINT fk_rev_cert       FOREIGN KEY (certificate_id) REFERENCES certificate(certificate_id);
-- CERTIFICATE 1 --HAS-- N VERIFICATION
ALTER TABLE verification ADD CONSTRAINT fk_ver_cert      FOREIGN KEY (certificate_id) REFERENCES certificate(certificate_id);
-- VERIFIER 1 --PERFORMS-- N VERIFICATION (history kept if a verifier is deleted)
ALTER TABLE verification ADD CONSTRAINT fk_ver_verifier  FOREIGN KEY (verifier_id)  REFERENCES verifier(verifier_id) ON DELETE SET NULL;
-- HR 1 --MANAGES-- N VERIFIER
ALTER TABLE verifier    ADD CONSTRAINT fk_verifier_hr    FOREIGN KEY (hr_id)        REFERENCES hr(hr_id);
-- issuer secret key
ALTER TABLE issuer_secret ADD CONSTRAINT fk_secret_issuer FOREIGN KEY (issuer_id)   REFERENCES issuer(issuer_id) ON DELETE CASCADE;
-- HOME PAGE --LOGIN-- APPLICANT / VERIFIER / HR (1:1)
ALTER TABLE account ADD CONSTRAINT fk_acc_applicant FOREIGN KEY (applicant_id) REFERENCES applicant(applicant_id) ON DELETE CASCADE;
ALTER TABLE account ADD CONSTRAINT fk_acc_verifier  FOREIGN KEY (verifier_id)  REFERENCES verifier(verifier_id)   ON DELETE CASCADE;
ALTER TABLE account ADD CONSTRAINT fk_acc_hr        FOREIGN KEY (hr_id)        REFERENCES hr(hr_id)               ON DELETE CASCADE;
ALTER TABLE auth_session ADD CONSTRAINT fk_session_account FOREIGN KEY (account_id) REFERENCES account(account_id) ON DELETE CASCADE;

-- indexes on foreign keys (speed + fewer locks)
CREATE INDEX ix_cert_applicant ON certificate(applicant_id);
CREATE INDEX ix_cert_type      ON certificate(type_id);
CREATE INDEX ix_cert_issuer    ON certificate(issuer_id);
CREATE INDEX ix_ver_cert       ON verification(certificate_id);
CREATE INDEX ix_ver_verifier   ON verification(verifier_id);
CREATE INDEX ix_ver_time       ON verification(verification_time);
CREATE INDEX ix_verifier_hr    ON verifier(hr_id);
CREATE INDEX ix_session_exp    ON auth_session(expires_at);
