-- 06_triggers.sql : automated protections

-- 1. Issued certificates can never be deleted (revoke them instead)
CREATE OR REPLACE TRIGGER trg_certificate_no_delete_issued
BEFORE DELETE ON certificate FOR EACH ROW
BEGIN
  IF :OLD.is_issued = 'Y' THEN
    RAISE_APPLICATION_ERROR(-20040, 'Issued certificates cannot be deleted. Revoke them instead.');
  END IF;
END;
/
-- 2. Certificate number is permanent
CREATE OR REPLACE TRIGGER trg_certificate_no_immutable
BEFORE UPDATE OF certificate_no ON certificate FOR EACH ROW
BEGIN
  IF :NEW.certificate_no <> :OLD.certificate_no THEN
    RAISE_APPLICATION_ERROR(-20042, 'Certificate number cannot be changed');
  END IF;
END;
/
-- 3. Revocation history is permanent
CREATE OR REPLACE TRIGGER trg_revocation_immutable
BEFORE UPDATE OR DELETE ON revocation FOR EACH ROW
BEGIN
  RAISE_APPLICATION_ERROR(-20041, 'Revocation history cannot be changed');
END;
/
-- 4. Verification log is append-only (only exception: FK ON DELETE SET NULL when a verifier is removed)
CREATE OR REPLACE TRIGGER trg_verification_append_only
BEFORE UPDATE OR DELETE ON verification FOR EACH ROW
BEGIN
  IF DELETING OR NOT (:NEW.verifier_id IS NULL AND :NEW.result = :OLD.result
                      AND :NEW.verification_time = :OLD.verification_time) THEN
    RAISE_APPLICATION_ERROR(-20043, 'Verification history cannot be changed');
  END IF;
END;
/
-- 5. Usernames are always stored lower-case
CREATE OR REPLACE TRIGGER trg_account_username_lower
BEFORE INSERT OR UPDATE OF username ON account FOR EACH ROW
BEGIN
  :NEW.username := LOWER(TRIM(:NEW.username));
END;
/
