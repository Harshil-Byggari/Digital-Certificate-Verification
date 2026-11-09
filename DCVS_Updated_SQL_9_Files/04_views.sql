-- 04_views.sql : derived attributes (certificate STATUS) in one place

CREATE OR REPLACE VIEW v_certificate_detail AS
SELECT c.certificate_id, c.certificate_no, c.title,
       c.applicant_id,
       a.first_name || NVL2(a.middle_name, ' '||a.middle_name, '') || ' ' || a.last_name AS applicant_name,
       c.type_id, t.type_name,
       c.issuer_id, i.issuer_name, i.organisation,
       c.issue_date, c.expiry_date, c.document_url, c.upload_certificate,
       c.qr_code, c.digital_signature, c.certificate_hash, c.is_issued,
       CASE
         WHEN r.revocation_id IS NOT NULL THEN 'REVOKED'
         WHEN c.is_issued = 'N'           THEN 'DRAFT'
         WHEN c.expiry_date IS NOT NULL AND c.expiry_date < TRUNC(SYSDATE) THEN 'EXPIRED'
         ELSE 'VALID'
       END AS status,
       r.reason AS revocation_reason, r.revoked_date
FROM certificate c
JOIN applicant        a ON a.applicant_id = c.applicant_id
JOIN certificate_type t ON t.type_id      = c.type_id
JOIN issuer           i ON i.issuer_id    = c.issuer_id
LEFT JOIN revocation  r ON r.certificate_id = c.certificate_id;
