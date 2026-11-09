-- ============================================================================
-- DIGITAL CERTIFICATE VERIFICATION SYSTEM (CertiTrust)
-- 05_functions_procedures.sql: Stored Functions and Verification Procedures
-- ============================================================================

-- Function 1: Compute Cryptographic SHA-256 Hash of Certificate Core Attributes
CREATE OR REPLACE FUNCTION FN_COMPUTE_CERT_HASH (
    p_cert_no IN VARCHAR2,
    p_applicant_id IN VARCHAR2,
    p_issuer_id IN VARCHAR2,
    p_issue_date IN DATE
) RETURN VARCHAR2 IS
    v_raw_input RAW(2000);
    v_hash RAW(32);
    v_combined VARCHAR2(2000);
BEGIN
    v_combined := p_cert_no || '|' || p_applicant_id || '|' || p_issuer_id || '|' || TO_CHAR(p_issue_date, 'YYYY-MM-DD');
    v_raw_input := UTL_I18N.STRING_TO_RAW(v_combined, 'AL32UTF8');
    v_hash := DBMS_CRYPTO.HASH(v_raw_input, DBMS_CRYPTO.HASH_SH256);
    RETURN LOWER(RAWTOHEX(v_hash));
END;
/

-- Procedure 2: Record Verification Audit Log
CREATE OR REPLACE PROCEDURE SP_LOG_VERIFICATION (
    p_cert_id IN VARCHAR2,
    p_verifier_id IN VARCHAR2,
    p_user_agent IN VARCHAR2,
    p_ip_address IN VARCHAR2,
    p_result IN VARCHAR2,
    p_method IN VARCHAR2,
    p_remarks IN VARCHAR2,
    p_verification_id OUT VARCHAR2
) IS
BEGIN
    p_verification_id := 'VRF-' || TO_CHAR(SYSTIMESTAMP, 'YYYYMMDDHH24MISSFF3');
    INSERT INTO VERIFICATION (
        VERIFICATION_ID,
        CERTIFICATE_ID,
        VERIFIER_ID,
        VERIFICATION_TIME,
        USER_AGENT,
        IP_ADDRESS,
        RESULT,
        METHOD,
        REMARKS
    ) VALUES (
        p_verification_id,
        p_cert_id,
        p_verifier_id,
        CURRENT_TIMESTAMP,
        p_user_agent,
        p_ip_address,
        p_result,
        p_method,
        p_remarks
    );
    COMMIT;
END;
/

-- Procedure 3: Revoke Certificate
CREATE OR REPLACE PROCEDURE SP_REVOKE_CERTIFICATE (
    p_cert_id IN VARCHAR2,
    p_reason IN VARCHAR2,
    p_revocation_id OUT VARCHAR2
) IS
BEGIN
    p_revocation_id := 'REV-' || TO_CHAR(SYSTIMESTAMP, 'YYYYMMDDHH24MISSFF3');
    
    -- Insert 1:1 Revocation record
    INSERT INTO REVOCATION (
        REVOCATION_ID,
        CERTIFICATE_ID,
        REASON,
        REVOKED_DATE
    ) VALUES (
        p_revocation_id,
        p_cert_id,
        p_reason,
        CURRENT_TIMESTAMP
    );
    
    -- Update certificate status column
    UPDATE CERTIFICATE
    SET STATUS = 'REVOKED'
    WHERE CERTIFICATE_ID = p_cert_id;
    
    COMMIT;
END;
/

