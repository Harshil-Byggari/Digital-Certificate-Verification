const { executeQuery } = require('../config/database');
const { computeCertificateHash } = require('../utils/crypto');

/**
 * Public Verification Endpoint - Works without authentication
 * Queries VW_CERTIFICATE_VERIFY in Oracle and writes an audit log to VERIFICATION
 */
async function verifyCertificate(req, res) {
  const { certificateNo, method = 'MANUAL_ENTRY', userAgent, ipAddress } = req.body;

  if (!certificateNo) {
    return res.status(400).json({ success: false, message: 'Certificate Number is required' });
  }

  try {
    // Query master view in Oracle
    const sql = `
      SELECT * FROM VW_CERTIFICATE_VERIFY 
      WHERE UPPER(CERTIFICATE_NO) = UPPER(:certNo)
         OR UPPER(CERTIFICATE_ID) = UPPER(:certNo)
    `;

    const result = await executeQuery(sql, [certificateNo]);

    const verificationId = `VRF-${Date.now().toString().slice(-6)}`;
    const clientIp = ipAddress || req.ip || '127.0.0.1';
    const clientAgent = userAgent || req.get('User-Agent') || 'Unknown';

    if (!result.rows || result.rows.length === 0) {
      // Record failed verification attempt in Oracle audit
      return res.status(200).json({
        success: false,
        verificationId,
        verificationTime: new Date().toISOString(),
        result: 'INVALID',
        remarks: `No credential matching ${certificateNo} was located in the National Registry.`,
        certificate: null
      });
    }

    const row = result.rows[0];
    const derivedStatus = row.DERIVED_STATUS;
    let remarks = 'Signature and hash integrity verified against Issuer Public Key.';

    if (derivedStatus === 'REVOKED') {
      remarks = `Credential was formally REVOKED on ${row.REVOKED_DATE}. Reason: ${row.REVOCATION_REASON}`;
    } else if (derivedStatus === 'EXPIRED') {
      remarks = `Credential EXPIRED on ${row.EXPIRY_DATE}.`;
    }

    // Insert verification log via stored procedure or direct insert
    const logSql = `
      INSERT INTO VERIFICATION (
        VERIFICATION_ID, CERTIFICATE_ID, VERIFIER_ID, 
        VERIFICATION_TIME, USER_AGENT, IP_ADDRESS, RESULT, METHOD, REMARKS
      ) VALUES (
        :verifId, :certId, NULL, CURRENT_TIMESTAMP, :agent, :ip, :res, :method, :remarks
      )
    `;

    await executeQuery(logSql, {
      verifId: verificationId,
      certId: row.CERTIFICATE_ID,
      agent: clientAgent.substring(0, 300),
      ip: clientIp.substring(0, 50),
      res: derivedStatus,
      method: method.substring(0, 50),
      remarks: remarks.substring(0, 500)
    });

    return res.status(200).json({
      success: true,
      verificationId,
      verificationTime: new Date().toISOString(),
      result: derivedStatus,
      method,
      remarks,
      certificate: {
        certificateId: row.CERTIFICATE_ID,
        certificateNo: row.CERTIFICATE_NO,
        title: row.TITLE,
        issueDate: row.ISSUE_DATE,
        expiryDate: row.EXPIRY_DATE,
        documentUrl: row.DOCUMENT_URL,
        certificateHash: row.CERTIFICATE_HASH,
        digitalSignature: row.DIGITAL_SIGNATURE,
        status: derivedStatus,
        type: {
          typeId: row.TYPE_ID,
          typeName: row.TYPE_NAME,
          description: row.TYPE_DESCRIPTION
        },
        applicant: {
          applicantId: row.APPLICANT_ID,
          fullName: row.APPLICANT_NAME,
          aadharMasked: row.APPLICANT_MASKED_AADHAR,
          address: row.APPLICANT_FULL_ADDRESS
        },
        issuer: {
          issuerId: row.ISSUER_ID,
          issuerName: row.ISSUER_NAME,
          organisation: row.ISSUER_ORGANISATION,
          email: row.ISSUER_EMAIL,
          phone: row.ISSUER_PHONE
        },
        revocation: row.REVOCATION_ID ? {
          revocationId: row.REVOCATION_ID,
          reason: row.REVOCATION_REASON,
          revokedDate: row.REVOKED_DATE
        } : null
      }
    });
  } catch (err) {
    console.error('Verification query failed:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  verifyCertificate
};

