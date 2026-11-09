import puppeteer from 'puppeteer-core';
import path from 'path';
import fs from 'fs';

const CHROMIUM_PATH = '/usr/bin/chromium';
const BASE_URL = 'http://localhost:5173';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log('=== Starting M5: Applicant Portal Comprehensive Test Suite ===');
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 950 });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  try {
    // -------------------------------------------------------------
    // Test 1: Applicant Login & Navigation to /portal
    // -------------------------------------------------------------
    console.log('\n[Test 1] Testing Applicant Login & Redirect to /portal...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await sleep(500);

    await page.type('input[type="text"], input[name="username"]', 'asha');
    await page.type('input[type="password"]', 'Applicant@123');
    await page.click('form.login-card button');
    await sleep(2000);

    const currentUrl = page.url();
    console.log(`Current URL after login: ${currentUrl}`);
    if (!currentUrl.includes('/portal')) {
      throw new Error(`Expected redirect to /portal, got: ${currentUrl}`);
    }
    console.log('>>> [PASS] Applicant Login & Role Navigation to /portal');

    // -------------------------------------------------------------
    // Test 2: Applicant Dashboard Information & Visual Verification
    // -------------------------------------------------------------
    console.log('\n[Test 2] Testing Applicant Dashboard Data & Metric Cards...');
    await sleep(1000);
    const dashboardState = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        welcomeText: text.includes('Welcome, Asha M Nair'),
        applicantIdText: text.includes('Applicant ID: #1'),
        hasTotal: text.includes('Total Issued'),
        hasActive: text.includes('Active / Valid'),
        hasExpired: text.includes('Expired'),
        hasRevoked: text.includes('Revoked'),
        hasCert1: text.includes('B.Tech Degree Certificate') && text.includes('DCVS-2026-001'),
        hasCert2: text.includes('Summer Internship 2025') && text.includes('DCVS-2026-002'),
        hasCert10: text.includes('DCVS-2026-010')
      };
    });
    console.log('Dashboard Live Content State:', dashboardState);
    if (!dashboardState.welcomeText || !dashboardState.applicantIdText || !dashboardState.hasCert1) {
      throw new Error(`Dashboard failed to render live Oracle data: ${JSON.stringify(dashboardState)}`);
    }

    // Capture Applicant Dashboard Screenshot
    const dashShotPath = path.resolve('../scratch/screenshot_applicant_dashboard.png');
    await page.screenshot({ path: dashShotPath, fullPage: true });
    console.log(`Saved screenshot: ${dashShotPath}`);
    console.log('>>> [PASS] Applicant Dashboard Live Data & Rendering');

    // -------------------------------------------------------------
    // Test 3: Interactive Status Filtering & Search
    // -------------------------------------------------------------
    console.log('\n[Test 3] Testing Dashboard Status Filtering and Search...');
    // Click 'VALID' filter button
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const validBtn = btns.find(b => b.textContent.trim() === 'VALID');
      if (validBtn) validBtn.click();
    });
    await sleep(500);

    const validFilterState = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasValidCert: text.includes('B.Tech Degree Certificate'),
        hasExpiredCert: text.includes('Summer Internship 2025')
      };
    });
    console.log('Filter VALID State:', validFilterState);
    if (!validFilterState.hasValidCert || validFilterState.hasExpiredCert) {
      throw new Error(`Status filter failed: ${JSON.stringify(validFilterState)}`);
    }

    // Reset filter to 'ALL'
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const allBtn = btns.find(b => b.textContent.trim() === 'ALL');
      if (allBtn) allBtn.click();
    });
    await sleep(500);
    console.log('>>> [PASS] Interactive Status Filter');

    // -------------------------------------------------------------
    // Test 4: Quick QR Modal on Dashboard
    // -------------------------------------------------------------
    console.log('\n[Test 4] Testing Dashboard QR Quick Modal...');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const qrBtn = btns.find(b => b.textContent.includes('View QR'));
      if (qrBtn) qrBtn.click();
    });
    await sleep(600);

    const qrModalState = await page.evaluate(() => {
      const modal = document.querySelector('.fixed.inset-0');
      return {
        isOpen: !!modal,
        hasSvg: !!modal?.querySelector('svg'),
        hasVerifyLink: !!modal?.querySelector('a[href*="/verify"]')
      };
    });
    console.log('QR Quick Modal State:', qrModalState);
    if (!qrModalState.isOpen || !qrModalState.hasSvg) {
      throw new Error('Quick QR modal failed to display SVG');
    }

    // Close modal
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.fixed.inset-0 button'));
      const closeBtn = btns.find(b => b.textContent.includes('Close'));
      if (closeBtn) closeBtn.click();
    });
    await sleep(500);
    console.log('>>> [PASS] Quick QR Code Modal');

    // -------------------------------------------------------------
    // Test 5: Certificate Detail View (/portal/certificates/1)
    // -------------------------------------------------------------
    console.log('\n[Test 5] Testing Certificate Detail View (/portal/certificates/1)...');
    await page.goto(`${BASE_URL}/portal/certificates/1`, { waitUntil: 'networkidle2' });
    await sleep(1500);

    const detailState = await page.evaluate(() => {
      const text = document.body.innerText;
      const revokeBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.toLowerCase().includes('revoke'));
      return {
        hasTitle: text.includes('B.Tech Degree Certificate'),
        hasSerial: text.includes('DCVS-2026-001'),
        hasActiveBadge: text.includes('Active & Authentic'),
        hasApplicant: text.includes('Asha M Nair'),
        hasIssuer: text.includes('Example University'),
        hasHash: text.includes('Certificate Hash (SHA-256 Digest)'),
        hasSignature: text.includes('Digital Signature (Issuer Secret HMAC)'),
        hasQR: !!document.querySelector('svg[width="180"], div.bg-slate-50 svg'),
        hasRevokeButton: !!revokeBtn
      };
    });
    console.log('Certificate Detail State:', detailState);
    if (!detailState.hasTitle || !detailState.hasSerial || !detailState.hasActiveBadge || !detailState.hasQR) {
      throw new Error(`Certificate detail view failed: ${JSON.stringify(detailState)}`);
    }
    if (detailState.hasRevokeButton) {
      throw new Error('SECURITY VIOLATION: Revoke button must not be visible to applicants!');
    }

    // Capture Certificate Detail Screenshot
    const detailShotPath = path.resolve('../scratch/screenshot_certificate_detail.png');
    await page.screenshot({ path: detailShotPath, fullPage: true });
    console.log(`Saved screenshot: ${detailShotPath}`);
    console.log('>>> [PASS] Certificate Detail View & Security Enforcement (No Revoke Button)');

    // -------------------------------------------------------------
    // Test 6: Applicant Profile & Multivalued Contact Management
    // -------------------------------------------------------------
    console.log('\n[Test 6] Testing Applicant Profile View & Edit (/portal/profile)...');
    await page.goto(`${BASE_URL}/portal/profile`, { waitUntil: 'networkidle2' });
    await sleep(1500);

    const profileState = await page.evaluate(() => {
      const firstNameInput = document.querySelector('input[value="Asha"]');
      const aadharInput = document.querySelector('input[value="999900000002"]');
      const streetInput = document.querySelector('input[placeholder*="Flat / House"]');
      return {
        hasFirstName: !!firstNameInput,
        hasAadhar: !!aadharInput,
        isAadharDisabled: aadharInput?.disabled || aadharInput?.readOnly,
        streetValue: streetInput?.value,
        hasEmails: document.body.innerText.includes('asha@example.com'),
        hasPhones: document.body.innerText.includes('9000000020')
      };
    });
    console.log('Profile Initial State:', profileState);
    if (!profileState.hasFirstName || !profileState.isAadharDisabled) {
      throw new Error(`Profile fields or read-only constraints failed: ${JSON.stringify(profileState)}`);
    }

    // Test Updating Address and Saving
    console.log('Testing Profile Update via UI...');
    await page.evaluate(() => {
      const streetInput = document.querySelector('input[placeholder*="Flat / House"]');
      streetInput.value = '12 Lake View Residency';
      streetInput.dispatchEvent(new Event('input', { bubbles: true }));
      streetInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await sleep(500);

    // Click "Save Profile Changes"
    await page.evaluate(() => {
      const submitBtn = document.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.click();
      else throw new Error('Submit button not found');
    });
    await sleep(2500);

    const saveSuccess = await page.evaluate(() => {
      return document.body.innerText.includes('Changes saved to Oracle DB!');
    });
    console.log(`Save Success Banner Displayed: ${saveSuccess}`);
    if (!saveSuccess) throw new Error('Save profile notification was not displayed');

    // Capture Applicant Profile Screenshot
    const profShotPath = path.resolve('../scratch/screenshot_applicant_profile.png');
    await page.screenshot({ path: profShotPath, fullPage: true });
    console.log(`Saved screenshot: ${profShotPath}`);
    console.log('>>> [PASS] Applicant Profile View & Live Update in Oracle DB');

    // -------------------------------------------------------------
    // Test 7: Route Protection & Access Restrictions
    // -------------------------------------------------------------
    console.log('\n[Test 7] Testing Route Restrictions (Applicant blocked from admin)...');
    
    // Try visiting /admin
    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle2' });
    await sleep(1000);
    const blockedAdminUrl = page.url();
    console.log(`Visited /admin, routed to: ${blockedAdminUrl}`);
    if (!blockedAdminUrl.includes('/portal')) {
      throw new Error(`Applicant was not blocked from /admin! Current URL: ${blockedAdminUrl}`);
    }

    // Try visiting /admin/hr
    await page.goto(`${BASE_URL}/admin/hr`, { waitUntil: 'networkidle2' });
    await sleep(1000);
    const blockedHrUrl = page.url();
    console.log(`Visited /admin/hr, routed to: ${blockedHrUrl}`);
    if (!blockedHrUrl.includes('/portal')) {
      throw new Error(`Applicant was not blocked from /admin/hr! Current URL: ${blockedHrUrl}`);
    }

    // Try visiting /admin/certificates
    await page.goto(`${BASE_URL}/admin/certificates`, { waitUntil: 'networkidle2' });
    await sleep(1000);
    const blockedCertsUrl = page.url();
    console.log(`Visited /admin/certificates, routed to: ${blockedCertsUrl}`);
    if (!blockedCertsUrl.includes('/portal')) {
      throw new Error(`Applicant was not blocked from /admin/certificates! Current URL: ${blockedCertsUrl}`);
    }
    console.log('>>> [PASS] Applicant Route Guard Restrictions');

    // -------------------------------------------------------------
    // Test 8: Logout & Unauthenticated Redirection
    // -------------------------------------------------------------
    console.log('\n[Test 8] Testing Logout & Session Invalidation...');
    await page.goto(`${BASE_URL}/portal`, { waitUntil: 'networkidle2' });
    await sleep(500);

    // Click logout button in Navbar
    await page.evaluate(() => {
      const logoutBtn = document.querySelector('header button[title="Logout"]');
      if (logoutBtn) logoutBtn.click();
      else throw new Error('Logout button not found in Navbar');
    });
    await sleep(1500);

    const urlAfterLogout = page.url();
    console.log(`URL after logout: ${urlAfterLogout}`);
    if (!urlAfterLogout.includes('/login')) {
      throw new Error(`Expected redirect to /login after logout, got: ${urlAfterLogout}`);
    }

    // Try opening /portal when logged out
    await page.goto(`${BASE_URL}/portal`, { waitUntil: 'networkidle2' });
    await sleep(1000);
    const protectedUrl = page.url();
    console.log(`Attempted /portal while logged out, routed to: ${protectedUrl}`);
    if (!protectedUrl.includes('/login')) {
      throw new Error(`Unauthenticated access to /portal was not redirected to /login! Got: ${protectedUrl}`);
    }
    console.log('>>> [PASS] Logout & Unauthenticated Route Protection');

    // -------------------------------------------------------------
    // Test 9: Public Verification Regression
    // -------------------------------------------------------------
    console.log('\n[Test 9] Checking Public Verification Regression...');
    await page.goto(`${BASE_URL}/verify?ref=DCVS-2026-001`, { waitUntil: 'networkidle2' });
    await sleep(1500);
    const pubVerifyState = await page.evaluate(() => {
      return document.body.innerText.includes('VERIFIED AUTHENTIC') || document.body.innerText.includes('Certificate Is Valid & Active');
    });
    console.log(`Public verification valid banner: ${pubVerifyState}`);
    if (!pubVerifyState) throw new Error('Public verification regression check failed');
    console.log('>>> [PASS] Public Verification Regression');

    console.log('\n======================================================');
    console.log('ALL M5 APPLICANT PORTAL TESTS COMPLETED SUCCESSFULLY!');
    console.log('======================================================');

  } catch (err) {
    console.error('M5 Suite Failed:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
