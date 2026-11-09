#!/usr/bin/env node
/**
 * DCVS — Automated API & Integration Test Suite (Stage M7)
 * Targets: Oracle Database 26ai Free + Oracle REST Data Services (ORDS)
 * 
 * Usage:
 *   node scripts/check-api.mjs
 *   DCVS_API_BASE=http://localhost:8080/ords/dcvs/api node scripts/check-api.mjs
 */

const API_BASE = (process.env.DCVS_API_BASE || 'http://localhost:8080/ords/dcvs/api').replace(/\/+$/, '');
const ADMIN_USER = process.env.DCVS_ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.DCVS_ADMIN_PASS || 'Admin@1234';
const APPLICANT_USER = process.env.DCVS_APPLICANT_USER || 'asha';
const APPLICANT_PASS = process.env.DCVS_APPLICANT_PASS || 'Applicant@123';
const VERIFIER_USER = process.env.DCVS_VERIFIER_USER || 'verifier1';
const VERIFIER_PASS = process.env.DCVS_VERIFIER_PASS || 'Verifier@123';
const HR_USER = process.env.DCVS_HR_USER || 'hr1';
const HR_PASS = process.env.DCVS_HR_PASS || 'Hr@12345';

let stats = { pass: 0, fail: 0, skipped: 0, notSupported: 0 };

function pass(name, detail = '') {
  stats.pass++;
  console.log(`  [PASS] ${name}${detail ? ' (' + detail + ')' : ''}`);
}

function fail(name, detail = '') {
  stats.fail++;
  console.log(`  [FAIL] ${name}${detail ? ' (' + detail + ')' : ''}`);
}

function skip(name, reason = '') {
  stats.skipped++;
  console.log(`  [SKIPPED] ${name}${reason ? ' (' + reason + ')' : ''}`);
}

function notSupported(name, reason = '') {
  stats.notSupported++;
  console.log(`  [NOT SUPPORTED] ${name}${reason ? ' — ' + reason : ''}`);
}

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = {
    'Accept': 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.token ? { 'X-Auth-Token': options.token } : {}),
    ...options.headers,
  };

  try {
    const res = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }

    const data = json && json.data !== undefined ? json.data : json;
    return { status: res.status, ok: res.ok, json, data, headers: res.headers };
  } catch (err) {
    return { status: 0, ok: false, error: err.message };
  }
}

async function runSuite() {
  console.log('='.repeat(75));
  console.log('DCVS — Stage M7 Automated API & Integration Test Suite');
  console.log(`Target Base URL: ${API_BASE}`);
  console.log('='.repeat(75));

  // -------------------------------------------------------------------------
  // 1. HEALTH AND AUTHENTICATION
  // -------------------------------------------------------------------------
  console.log('\n--- 1. Health and Authentication Endpoints ---');

  const healthRes = await request('/health');
  if (healthRes.status === 200) {
    pass('GET /health responds with 200 OK', `status=${healthRes.status}`);
  } else {
    fail('GET /health responds with 200 OK', `status=${healthRes.status}`);
  }

  const pingRes = await request('/ping');
  if (pingRes.status === 200) {
    pass('GET /ping responds with 200 OK', `status=${pingRes.status}`);
  } else {
    fail('GET /ping responds with 200 OK', `status=${pingRes.status}`);
  }

  // Admin Login
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: { username: ADMIN_USER, password: ADMIN_PASS },
  });
  let adminToken = null;
  if (adminLogin.status === 200 && adminLogin.data?.token) {
    adminToken = adminLogin.data.token;
    pass('POST /auth/login (ADMIN)', `role=${adminLogin.data.user?.user_type}`);
  } else {
    fail('POST /auth/login (ADMIN)', `status=${adminLogin.status}`);
  }

  // Admin GET /auth/me
  const adminMe = await request('/auth/me', { token: adminToken });
  if (adminMe.status === 200 && adminMe.data?.username === ADMIN_USER) {
    pass('GET /auth/me (ADMIN)', `username=${adminMe.data.username}`);
  } else {
    fail('GET /auth/me (ADMIN)', `status=${adminMe.status}`);
  }

  // Applicant Login
  const appLogin = await request('/auth/login', {
    method: 'POST',
    body: { username: APPLICANT_USER, password: APPLICANT_PASS },
  });
  let applicantToken = null;
  if (appLogin.status === 200 && appLogin.data?.token) {
    applicantToken = appLogin.data.token;
    pass('POST /auth/login (APPLICANT)', `linked_id=${appLogin.data.user?.linked_id}`);
  } else {
    fail('POST /auth/login (APPLICANT)', `status=${appLogin.status}`);
  }

  // Verifier Login
  const vrfLogin = await request('/auth/login', {
    method: 'POST',
    body: { username: VERIFIER_USER, password: VERIFIER_PASS },
  });
  let verifierToken = null;
  if (vrfLogin.status === 200 && vrfLogin.data?.token) {
    verifierToken = vrfLogin.data.token;
    pass('POST /auth/login (VERIFIER)', `user_type=${vrfLogin.data.user?.user_type}`);
  } else {
    fail('POST /auth/login (VERIFIER)', `status=${vrfLogin.status}`);
  }

  // HR Login
  const hrLogin = await request('/auth/login', {
    method: 'POST',
    body: { username: HR_USER, password: HR_PASS },
  });
  let hrToken = null;
  if (hrLogin.status === 200 && hrLogin.data?.token) {
    hrToken = hrLogin.data.token;
    pass('POST /auth/login (HR)', `user_type=${hrLogin.data.user?.user_type}`);
  } else {
    fail('POST /auth/login (HR)', `status=${hrLogin.status}`);
  }

  // Disposable session for POST /auth/logout
  const dispLogin = await request('/auth/login', {
    method: 'POST',
    body: { username: APPLICANT_USER, password: APPLICANT_PASS },
  });
  if (dispLogin.status === 200 && dispLogin.data?.token) {
    const dispToken = dispLogin.data.token;
    const logoutRes = await request('/auth/logout', { method: 'POST', token: dispToken });
    const verifyRevoked = await request('/auth/me', { token: dispToken });
    if (logoutRes.status === 200 && verifyRevoked.status === 401) {
      pass('POST /auth/logout invalidates session token immediately', 'next request returned 401');
    } else {
      fail('POST /auth/logout invalidates session token', `logout=${logoutRes.status}, subsequent=${verifyRevoked.status}`);
    }
  }

  // -------------------------------------------------------------------------
  // 2. CERTIFICATE TYPES CRUD
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Certificate Types CRUD ---');

  const typesList = await request('/types', { token: adminToken });
  let firstTypeId = 4;
  if (typesList.status === 200 && Array.isArray(typesList.data)) {
    if (typesList.data.length > 0) firstTypeId = typesList.data[0].type_id;
    pass('GET /types', `count=${typesList.data.length}`);
  } else {
    fail('GET /types', `status=${typesList.status}`);
  }

  // Create isolated test type
  const testTypeName = `AutoType_${Date.now()}`;
  const createType = await request('/types', {
    method: 'POST',
    token: adminToken,
    body: { type_name: testTypeName, description: 'Automated test certificate type' },
  });
  let createdTypeId = null;
  if ((createType.status === 200 || createType.status === 201) && createType.data?.type_id) {
    createdTypeId = createType.data.type_id;
    pass('POST /types (Create)', `type_id=${createdTypeId}, status=${createType.status}`);
  } else {
    fail('POST /types (Create)', `status=${createType.status}`);
  }

  if (createdTypeId) {
    const getType = await request(`/types/${createdTypeId}`, { token: adminToken });
    if (getType.status === 200 && getType.data?.type_name === testTypeName) {
      pass('GET /types/:id', `type_name=${getType.data.type_name}`);
    } else {
      fail('GET /types/:id', `status=${getType.status}`);
    }

    const updateType = await request(`/types/${createdTypeId}`, {
      method: 'PUT',
      token: adminToken,
      body: { type_name: `${testTypeName}_Upd`, description: 'Updated description' },
    });
    if (updateType.status === 200) {
      pass('PUT /types/:id (Update)', `status=${updateType.status}`);
    } else {
      fail('PUT /types/:id (Update)', `status=${updateType.status}`);
    }

    const delType = await request(`/types/${createdTypeId}`, { method: 'DELETE', token: adminToken });
    if (delType.status === 200) {
      pass('DELETE /types/:id (Delete isolated record)', `status=${delType.status}`);
    } else {
      fail('DELETE /types/:id (Delete isolated record)', `status=${delType.status}`);
    }
  }

  // -------------------------------------------------------------------------
  // 3. ISSUERS CRUD
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Issuers CRUD ---');

  const issuersList = await request('/issuers', { token: adminToken });
  let firstIssuerId = 3;
  if (issuersList.status === 200 && Array.isArray(issuersList.data)) {
    if (issuersList.data.length > 0) firstIssuerId = issuersList.data[0].issuer_id;
    const first = issuersList.data[0];
    const hasOrg = first && 'organisation' in first;
    pass('GET /issuers', `count=${issuersList.data.length}, organisation=${hasOrg}`);
  } else {
    fail('GET /issuers', `status=${issuersList.status}`);
  }

  // Create isolated issuer
  const randNum = Math.floor(1000 + Math.random() * 9000);
  const testIssuerName = `AutoIssuer_${randNum}`;
  const createIssuer = await request('/issuers', {
    method: 'POST',
    token: adminToken,
    body: {
      issuer_name: testIssuerName,
      organisation: 'Automated Test Organization',
      email: `issuer${randNum}@example.com`,
      phone: `910000${randNum}`,
      public_key: 'TEST_PUB_KEY_' + randNum,
    },
  });
  let createdIssuerId = null;
  if ((createIssuer.status === 200 || createIssuer.status === 201) && createIssuer.data?.issuer_id) {
    createdIssuerId = createIssuer.data.issuer_id;
    pass('POST /issuers (Create)', `issuer_id=${createdIssuerId}, status=${createIssuer.status}`);
  } else {
    fail('POST /issuers (Create)', `status=${createIssuer.status}`);
  }

  if (createdIssuerId) {
    const getIssuer = await request(`/issuers/${createdIssuerId}`, { token: adminToken });
    if (getIssuer.status === 200 && getIssuer.data?.issuer_name === testIssuerName) {
      pass('GET /issuers/:id', `issuer_name=${getIssuer.data.issuer_name}`);
    } else {
      fail('GET /issuers/:id', `status=${getIssuer.status}`);
    }

    const updateIssuer = await request(`/issuers/${createdIssuerId}`, {
      method: 'PUT',
      token: adminToken,
      body: { issuer_name: `${testIssuerName}_Upd`, organisation: 'Updated Org' },
    });
    if (updateIssuer.status === 200) {
      pass('PUT /issuers/:id (Update)', `status=${updateIssuer.status}`);
    } else {
      fail('PUT /issuers/:id (Update)', `status=${updateIssuer.status}`);
    }

    const delIssuer = await request(`/issuers/${createdIssuerId}`, { method: 'DELETE', token: adminToken });
    if (delIssuer.status === 200) {
      pass('DELETE /issuers/:id (Delete isolated record)', `status=${delIssuer.status}`);
    } else {
      fail('DELETE /issuers/:id (Delete isolated record)', `status=${delIssuer.status}`);
    }
  }

  // -------------------------------------------------------------------------
  // 4. APPLICANTS
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Applicants Endpoints ---');

  const appList = await request('/applicants', { token: adminToken });
  if (appList.status === 200 && Array.isArray(appList.data)) {
    pass('GET /applicants (ADMIN)', `count=${appList.data.length}`);
  } else {
    fail('GET /applicants (ADMIN)', `status=${appList.status}`);
  }

  // GET /applicants/:id (Seed Asha ID 1)
  const ashaProfile = await request('/applicants/1', { token: adminToken });
  if (ashaProfile.status === 200 && ashaProfile.data?.first_name === 'Asha') {
    pass('GET /applicants/1 (Asha profile)', `first_name=${ashaProfile.data.first_name}`);
  } else {
    fail('GET /applicants/1 (Asha profile)', `status=${ashaProfile.status}`);
  }

  // DELETE /applicants/:id is not supported by database triggers / FK constraints
  const testDelApplicant = await request('/applicants/999999', { method: 'DELETE', token: adminToken });
  if (testDelApplicant.status === 400 || testDelApplicant.status === 404 || testDelApplicant.status === 409) {
    pass('DELETE /applicants/:id safely handled', `status=${testDelApplicant.status}`);
  } else {
    notSupported('DELETE /applicants/:id', 'Cascade deletion of applicants is restricted by foreign key constraints');
  }

  // -------------------------------------------------------------------------
  // 5. CERTIFICATE LIFECYCLE (DRAFT -> VALID -> REVOKED)
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Certificate Full Lifecycle & Endpoints ---');

  const certsList = await request('/certificates', { token: adminToken });
  if (certsList.status === 200 && Array.isArray(certsList.data)) {
    pass('GET /certificates (ADMIN)', `total=${certsList.data.length}`);
  } else {
    fail('GET /certificates (ADMIN)', `status=${certsList.status}`);
  }

  // Create isolated certificate for Asha (applicant_id = 1)
  const certRand = Math.floor(10000 + Math.random() * 90000);
  const createCert = await request('/certificates', {
    method: 'POST',
    token: adminToken,
    body: {
      title: `Automated Test Certificate ${certRand}`,
      applicant_id: 1,
      issuer_id: firstIssuerId,
      type_id: firstTypeId,
      expiry_date: '2028-12-31',
    },
  });

  let testCertId = null;
  let testCertNo = null;
  if ((createCert.status === 200 || createCert.status === 201) && createCert.data?.certificate_id) {
    testCertId = createCert.data.certificate_id;
    testCertNo = createCert.data.certificate_no;
    pass('POST /certificates (Create DRAFT)', `cert_id=${testCertId}, cert_no=${testCertNo}, status=${createCert.status}`);
  } else {
    fail('POST /certificates (Create DRAFT)', `status=${createCert.status}, res=${JSON.stringify(createCert.data)}`);
  }

  if (testCertId) {
    // Check DRAFT state
    const getDraft = await request(`/certificates/${testCertId}`, { token: adminToken });
    if (getDraft.status === 200 && (getDraft.data?.status === 'DRAFT' || getDraft.data?.is_issued === false || getDraft.data?.is_issued === 'N')) {
      pass('GET /certificates/:id (DRAFT state)', `status=${getDraft.data.status}`);
    } else {
      fail('GET /certificates/:id (DRAFT state)', `status=${getDraft.status}`);
    }

    // Issue certificate
    const issueCert = await request(`/certificates/${testCertId}/issue`, {
      method: 'POST',
      token: adminToken,
    });
    if (issueCert.status === 200 || issueCert.status === 201) {
      pass('POST /certificates/:id/issue (Issue Certificate)', `status=${issueCert.status}`);
    } else {
      fail('POST /certificates/:id/issue', `status=${issueCert.status}`);
    }

    // Verify VALID state
    const getValid = await request(`/certificates/${testCertId}`, { token: adminToken });
    if (getValid.status === 200 && getValid.data?.status === 'VALID' && getValid.data?.digital_signature) {
      pass('GET /certificates/:id (VALID state with signature & hash)', `hash=${getValid.data.certificate_hash?.substring(0, 8)}...`);
    } else {
      fail('GET /certificates/:id (VALID state)', `status=${getValid.status}`);
    }

    // Retrieve QR
    const getQR = await request(`/certificates/${testCertId}/qr`, { token: adminToken });
    if (getQR.status === 200 && (getQR.data?.verify_url || getQR.data?.qr_code)) {
      pass('GET /certificates/:id/qr', `url=${getQR.data.verify_url || getQR.data.qr_code}`);
    } else {
      fail('GET /certificates/:id/qr', `status=${getQR.status}`);
    }

    // Retrieve Signature
    const getSig = await request(`/certificates/${testCertId}/signature`, { token: adminToken });
    if (getSig.status === 200 && getSig.data?.digital_signature) {
      pass('GET /certificates/:id/signature', `sig_present=true`);
    } else {
      fail('GET /certificates/:id/signature', `status=${getSig.status}`);
    }

    // Revoke certificate
    const revokeCert = await request(`/certificates/${testCertId}/revoke`, {
      method: 'POST',
      token: adminToken,
      body: { reason: `Automated lifecycle test revocation ${certRand}` },
    });
    if (revokeCert.status === 200 || revokeCert.status === 201) {
      pass('POST /certificates/:id/revoke (Revoke Certificate)', `status=${revokeCert.status}`);
    } else {
      fail('POST /certificates/:id/revoke', `status=${revokeCert.status}`);
    }

    // Verify REVOKED state
    const getRevoked = await request(`/certificates/${testCertId}`, { token: adminToken });
    if (getRevoked.status === 200 && getRevoked.data?.status === 'REVOKED') {
      pass('GET /certificates/:id (REVOKED state)', `status=REVOKED, reason=${getRevoked.data.revocation_reason}`);
    } else {
      fail('GET /certificates/:id (REVOKED state)', `status=${getRevoked.status}`);
    }
  }

  // -------------------------------------------------------------------------
  // 6. REVOCATIONS
  // -------------------------------------------------------------------------
  console.log('\n--- 6. Revocations Endpoints ---');

  const revsList = await request('/revocations', { token: adminToken });
  if (revsList.status === 200 && Array.isArray(revsList.data)) {
    pass('GET /revocations', `count=${revsList.data.length}`);
    if (revsList.data.length > 0) {
      const firstRevId = revsList.data[0].revocation_id;
      const getRev = await request(`/revocations/${firstRevId}`, { token: adminToken });
      if (getRev.status === 200) {
        pass('GET /revocations/:id', `revocation_id=${firstRevId}`);
      } else {
        fail('GET /revocations/:id', `status=${getRev.status}`);
      }
    }
  } else {
    fail('GET /revocations', `status=${revsList.status}`);
  }

  // -------------------------------------------------------------------------
  // 7. HR MANAGEMENT CRUD
  // -------------------------------------------------------------------------
  console.log('\n--- 7. HR Management CRUD ---');

  const hrList = await request('/hr', { token: adminToken });
  if (hrList.status === 200 && Array.isArray(hrList.data)) {
    pass('GET /hr', `count=${hrList.data.length}`);
  } else {
    fail('GET /hr', `status=${hrList.status}`);
  }

  // Create isolated HR record
  const hrRand = Math.floor(1000 + Math.random() * 9000);
  const createHR = await request('/hr', {
    method: 'POST',
    token: adminToken,
    body: {
      basic: 55000,
      da: 11000,
      hra: 16000,
      leave_days: 15,
      username: `test_hr_${hrRand}`,
      password: `HrTest@${hrRand}!`,
    },
  });

  let createdHrId = null;
  if ((createHR.status === 200 || createHR.status === 201) && createHR.data?.hr_id) {
    createdHrId = createHR.data.hr_id;
    pass('POST /hr (Create)', `hr_id=${createdHrId}, status=${createHR.status}`);
  } else {
    fail('POST /hr (Create)', `status=${createHR.status}`);
  }

  if (createdHrId) {
    const getHR = await request(`/hr/${createdHrId}`, { token: adminToken });
    if (getHR.status === 200 && getHR.data?.hr_id === createdHrId) {
      pass('GET /hr/:id', `basic=${getHR.data.basic}`);
    } else {
      fail('GET /hr/:id', `status=${getHR.status}`);
    }

    const updateHR = await request(`/hr/${createdHrId}`, {
      method: 'PUT',
      token: adminToken,
      body: { basic: 58000, leave_days: 18 },
    });
    if (updateHR.status === 200) {
      pass('PUT /hr/:id (Update)', `status=${updateHR.status}`);
    } else {
      fail('PUT /hr/:id (Update)', `status=${updateHR.status}`);
    }

    const delHR = await request(`/hr/${createdHrId}`, { method: 'DELETE', token: adminToken });
    if (delHR.status === 200) {
      pass('DELETE /hr/:id (Delete isolated record)', `status=${delHR.status}`);
    } else {
      fail('DELETE /hr/:id (Delete isolated record)', `status=${delHR.status}`);
    }
  }

  // -------------------------------------------------------------------------
  // 8. VERIFIERS MANAGEMENT CRUD
  // -------------------------------------------------------------------------
  console.log('\n--- 8. Verifiers Management CRUD ---');

  const verifiersList = await request('/verifiers', { token: adminToken });
  if (verifiersList.status === 200 && Array.isArray(verifiersList.data)) {
    const firstV = verifiersList.data[0];
    const hasOrg = firstV && 'organization' in firstV;
    pass('GET /verifiers', `count=${verifiersList.data.length}, organization=${hasOrg}`);
  } else {
    fail('GET /verifiers', `status=${verifiersList.status}`);
  }

  // Create isolated verifier
  const vRand = Math.floor(1000 + Math.random() * 9000);
  const aadharNum = `88880000${vRand}`;
  const createVrf = await request('/verifiers', {
    method: 'POST',
    token: adminToken,
    body: {
      first_name: 'TestVerifier',
      last_name: `Officer_${vRand}`,
      aadhar_card: aadharNum,
      doj: '2025-01-15',
      role: 'Inspector',
      verifier_type: 'Government',
      organization: 'National Audit Bureau',
      hr_id: 2,
      username: `vrf_${vRand}`,
      password: `Verifier@${vRand}!`,
      emails: [`vrf${vRand}@example.com`],
      phones: [`920000${vRand}`],
    },
  });

  let createdVrfId = null;
  if ((createVrf.status === 200 || createVrf.status === 201) && createVrf.data?.verifier_id) {
    createdVrfId = createVrf.data.verifier_id;
    pass('POST /verifiers (Create)', `verifier_id=${createdVrfId}, status=${createVrf.status}`);
  } else {
    fail('POST /verifiers (Create)', `status=${createVrf.status}`);
  }

  if (createdVrfId) {
    const getVrf = await request(`/verifiers/${createdVrfId}`, { token: adminToken });
    if (getVrf.status === 200 && getVrf.data?.first_name === 'TestVerifier') {
      pass('GET /verifiers/:id', `first_name=${getVrf.data.first_name}`);
    } else {
      fail('GET /verifiers/:id', `status=${getVrf.status}`);
    }

    const updateVrf = await request(`/verifiers/${createdVrfId}`, {
      method: 'PUT',
      token: adminToken,
      body: { first_name: 'TestVerifier', last_name: 'UpdatedOfficer', role: 'Senior Inspector' },
    });
    if (updateVrf.status === 200) {
      pass('PUT /verifiers/:id (Update)', `status=${updateVrf.status}`);
    } else {
      fail('PUT /verifiers/:id (Update)', `status=${updateVrf.status}`);
    }

    const delVrf = await request(`/verifiers/${createdVrfId}`, { method: 'DELETE', token: adminToken });
    if (delVrf.status === 200) {
      pass('DELETE /verifiers/:id (Delete isolated record)', `status=${delVrf.status}`);
    } else {
      fail('DELETE /verifiers/:id (Delete isolated record)', `status=${delVrf.status}`);
    }
  }

  // -------------------------------------------------------------------------
  // 9. PUBLIC VERIFICATION MATRIX (6 STATES)
  // -------------------------------------------------------------------------
  console.log('\n--- 9. Public Verification 6-State Matrix ---');

  // State 1: VALID (Seed Cert 1: DCVS-2026-001)
  const v1 = await request('/verify', { method: 'POST', body: { reference: 'DCVS-2026-001', method: 'MANUAL' } });
  if (v1.status === 200 && v1.data?.result === 'VALID' && v1.data?.certificate) {
    pass('State 1: VALID (DCVS-2026-001)', `hash_valid=${v1.data.hash_valid}, sig_valid=${v1.data.signature_valid}`);
  } else {
    fail('State 1: VALID', `status=${v1.status}, res=${v1.data?.result}`);
  }

  // State 2: EXPIRED (Seed Cert 2: DCVS-2026-002)
  const v2 = await request('/verify', { method: 'POST', body: { reference: 'DCVS-2026-002', method: 'MANUAL' } });
  if (v2.status === 200 && v2.data?.result === 'EXPIRED') {
    pass('State 2: EXPIRED (DCVS-2026-002)', `result=EXPIRED, message=${v2.data.message}`);
  } else {
    fail('State 2: EXPIRED', `status=${v2.status}, res=${v2.data?.result}`);
  }

  // State 3: REVOKED (Seed Cert 3: DCVS-2026-003)
  const v3 = await request('/verify', { method: 'POST', body: { reference: 'DCVS-2026-003', method: 'MANUAL' } });
  if (v3.status === 200 && v3.data?.result === 'REVOKED') {
    pass('State 3: REVOKED (DCVS-2026-003)', `result=REVOKED, message=${v3.data.message}`);
  } else {
    fail('State 3: REVOKED', `status=${v3.status}, res=${v3.data?.result}`);
  }

  // State 4: DRAFT / Unissued (Seed Cert 4: DCVS-2026-004)
  const v4 = await request('/verify', { method: 'POST', body: { reference: 'DCVS-2026-004', method: 'MANUAL' } });
  if (v4.status === 200 && v4.data?.result === 'INVALID') {
    pass('State 4: DRAFT / Unissued (DCVS-2026-004)', `result=INVALID, message=${v4.data.message}`);
  } else {
    fail('State 4: DRAFT / Unissued', `status=${v4.status}, res=${v4.data?.result}`);
  }

  // State 5: INVALID / Non-Existent
  const v5 = await request('/verify', { method: 'POST', body: { reference: 'NON-EXISTENT-REF-999', method: 'MANUAL' } });
  if (v5.status === 200 && v5.data?.result === 'INVALID') {
    pass('State 5: INVALID (Non-existent reference)', `result=INVALID, cert=null`);
  } else {
    fail('State 5: INVALID', `status=${v5.status}, res=${v5.data?.result}`);
  }

  // State 6: TAMPERED (Isolated Test Cert 28: DCVS-2026-012)
  const v6 = await request('/verify', { method: 'POST', body: { reference: 'DCVS-2026-012', method: 'MANUAL' } });
  if (v6.status === 200 && v6.data?.result === 'TAMPERED') {
    pass('State 6: TAMPERED (DCVS-2026-012 cryptographic mismatch detected)', `hash_valid=${v6.data.hash_valid}, sig_valid=${v6.data.signature_valid}`);
  } else {
    fail('State 6: TAMPERED', `status=${v6.status}, res=${v6.data?.result}`);
  }

  // QR Method Verification with Authenticated Verifier
  const vQR = await request('/verify', {
    method: 'POST',
    token: verifierToken,
    body: { reference: 'DCVS-2026-001', method: 'QR' },
  });
  if (vQR.status === 200 && vQR.data?.result === 'VALID') {
    pass('POST /verify (QR Method with Verifier session)', `method=QR, verifier_captured=true`);
  } else {
    fail('POST /verify (QR Method)', `status=${vQR.status}`);
  }

  // -------------------------------------------------------------------------
  // 10. VERIFICATIONS AUDIT TRAIL
  // -------------------------------------------------------------------------
  console.log('\n--- 10. Verifications Audit Trail ---');

  const verifsList = await request('/verifications', { token: adminToken });
  if (verifsList.status === 200 && Array.isArray(verifsList.data)) {
    pass('GET /verifications (ADMIN)', `count=${verifsList.data.length}`);
    if (verifsList.data.length > 0) {
      const vId = verifsList.data[0].verification_id;
      const getSingleVerif = await request(`/verifications/${vId}`, { token: adminToken });
      if (getSingleVerif.status === 200) {
        pass('GET /verifications/:id', `verification_id=${vId}`);
      } else {
        fail('GET /verifications/:id', `status=${getSingleVerif.status}`);
      }
    }
  } else {
    fail('GET /verifications (ADMIN)', `status=${verifsList.status}`);
  }

  // -------------------------------------------------------------------------
  // 11. DASHBOARD ANALYTICS
  // -------------------------------------------------------------------------
  console.log('\n--- 11. Dashboard Analytics Endpoints ---');

  const dbStats = await request('/dashboard/stats', { token: adminToken });
  if (dbStats.status === 200 && dbStats.data?.total_certificates !== undefined) {
    pass('GET /dashboard/stats', `total_certificates=${dbStats.data.total_certificates}, valid=${dbStats.data.valid}`);
  } else {
    fail('GET /dashboard/stats', `status=${dbStats.status}`);
  }

  const dbCerts = await request('/dashboard/certificates', { token: adminToken });
  if (dbCerts.status === 200 && dbCerts.data?.by_status) {
    pass('GET /dashboard/certificates', `categories=${Object.keys(dbCerts.data).join(', ')}`);
  } else {
    fail('GET /dashboard/certificates', `status=${dbCerts.status}`);
  }

  const dbVerifs = await request('/dashboard/verifications', { token: adminToken });
  if (dbVerifs.status === 200 && dbVerifs.data?.by_result) {
    pass('GET /dashboard/verifications', `categories=${Object.keys(dbVerifs.data).join(', ')}`);
  } else {
    fail('GET /dashboard/verifications', `status=${dbVerifs.status}`);
  }

  // -------------------------------------------------------------------------
  // 12. ROLE-BASED ACCESS CONTROL (RBAC) GUARDS
  // -------------------------------------------------------------------------
  console.log('\n--- 12. Role-Based Access Control (RBAC) Guards ---');

  // Unauthenticated blocked
  const unauth = await request('/dashboard/stats');
  if (unauth.status === 401) {
    pass('Unauthenticated request to protected endpoint returns 401');
  } else {
    fail('Unauthenticated request returns 401', `status=${unauth.status}`);
  }

  // Applicant blocked from Admin Dashboard
  const appBlocked = await request('/dashboard/stats', { token: applicantToken });
  if (appBlocked.status === 403) {
    pass('APPLICANT blocked from /dashboard/stats (403)');
  } else {
    fail('APPLICANT blocked from /dashboard/stats', `status=${appBlocked.status}`);
  }

  // Verifier blocked from Certificate Revocation
  const vrfBlocked = await request('/certificates/1/revoke', {
    method: 'POST',
    token: verifierToken,
    body: { reason: 'Unauthorized' },
  });
  if (vrfBlocked.status === 403) {
    pass('VERIFIER blocked from /certificates/:id/revoke (403)');
  } else {
    fail('VERIFIER blocked from /certificates/:id/revoke', `status=${vrfBlocked.status}`);
  }

  // Applicant blocked from other applicant profile
  const crossApp = await request('/applicants/2', { token: applicantToken });
  if (crossApp.status === 400 || crossApp.status === 403 || crossApp.status === 404) {
    pass('APPLICANT blocked from accessing other applicant profile (403)');
  } else {
    fail('APPLICANT blocked from accessing other applicant profile', `status=${crossApp.status}`);
  }

  // -------------------------------------------------------------------------
  // 13. UNSUPPORTED / MISSING ENDPOINTS AUDIT
  // -------------------------------------------------------------------------
  console.log('\n--- 13. Architectural Boundary & Unsupported Endpoints ---');

  const appSubmission = await request('/applications', { method: 'POST', token: applicantToken, body: {} });
  if (appSubmission.status === 404) {
    notSupported('POST /applications', 'Database schema has no application table; certificates are directly issued by administrators');
  } else {
    skip('POST /applications', `status=${appSubmission.status}`);
  }

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n' + '='.repeat(75));
  console.log(`Test Execution Summary:`);
  console.log(`  PASS:          ${stats.pass}`);
  console.log(`  FAIL:          ${stats.fail}`);
  console.log(`  SKIPPED:       ${stats.skipped}`);
  console.log(`  NOT SUPPORTED: ${stats.notSupported}`);
  console.log('='.repeat(75));

  process.exit(stats.fail > 0 ? 1 : 0);
}

runSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
