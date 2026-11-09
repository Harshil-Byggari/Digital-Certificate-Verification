import puppeteer from 'puppeteer-core';

const CHROMIUM_PATH = '/usr/bin/chromium';
const BASE_URL = 'http://localhost:5173';

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log('=== Starting Full DCVS Regression Suite ===');
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  try {
    // 1. Home Page
    console.log('\n[Regression 1] Checking Home Page (/)...');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
    await sleep(500);
    const homeTitle = await page.title();
    const hasHero = await page.evaluate(() => document.body.innerText.includes('Digital Credentials Instantly'));
    console.log(`Home Page Loaded: title="${homeTitle}", hasHero=${hasHero}`);
    if (!hasHero) throw new Error('Home page hero section not found');

    // 2. Public Verification Page directly
    console.log('\n[Regression 2] Checking Verify Page direct (/verify)...');
    await page.goto(`${BASE_URL}/verify`, { waitUntil: 'networkidle2' });
    await sleep(500);
    const hasSearchInput = await page.evaluate(() => !!document.querySelector('input[type="text"]'));
    console.log(`Verify Page Search Input present: ${hasSearchInput}`);
    if (!hasSearchInput) throw new Error('Search input not found on /verify');

    // 3. URL Parameter Auto-verification (?ref=DCVS-2026-001)
    console.log('\n[Regression 3] Checking URL Parameter Auto-Verification (?ref=DCVS-2026-001)...');
    await page.goto(`${BASE_URL}/verify?ref=DCVS-2026-001`, { waitUntil: 'networkidle2' });
    await sleep(1500);
    const validResult = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasValid: text.includes('Certificate Is Valid & Active') || text.includes('VERIFIED AUTHENTIC'),
        applicant: text.includes('Asha M Nair'),
        hashMatch: text.includes('SHA-256 Hash Digest') && text.toUpperCase().includes('MATCH'),
        sigVerified: text.includes('Digital Signature') && text.toUpperCase().includes('VERIFIED')
      };
    });
    console.log('Auto-Verification Result:', validResult);
    if (!validResult.hasValid || !validResult.applicant || !validResult.hashMatch) {
      throw new Error(`Auto-verification failed: ${JSON.stringify(validResult)}`);
    }

    // 4. URL Parameter Auto-verification with ?certificate_no=DCVS-2026-002
    console.log('\n[Regression 4] Checking URL Parameter with ?certificate_no=DCVS-2026-002 (Expired)...');
    await page.goto(`${BASE_URL}/verify?certificate_no=DCVS-2026-002`, { waitUntil: 'networkidle2' });
    await sleep(1500);
    const expiredResult = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        hasExpired: text.includes('Certificate Has Expired') || text.includes('CREDENTIAL EXPIRED'),
        applicant: text.includes('Asha M Nair')
      };
    });
    console.log('Expired Verification Result:', expiredResult);
    if (!expiredResult.hasExpired) {
      throw new Error(`Expired verification failed: ${JSON.stringify(expiredResult)}`);
    }

    // 5. Admin Login & Protected Route Access
    console.log('\n[Regression 5] Checking Admin Authentication & Protected Dashboards...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await sleep(500);

    // Type credentials
    await page.type('input[type="text"], input[name="username"]', 'admin');
    await page.type('input[type="password"]', 'Admin@1234');
    await page.click('form.login-card button');
    await sleep(2000);

    const adminUrl = page.url();
    console.log(`Navigated to after login: ${adminUrl}`);
    if (!adminUrl.includes('/admin')) throw new Error(`Expected redirect to /admin, got ${adminUrl}`);

    // Check Admin sub-pages
    const adminPages = [
      { path: '/admin', heading: 'Dashboard' },
      { path: '/admin/applicants', heading: 'Applicants' },
      { path: '/admin/types', heading: 'Certificate Types' },
      { path: '/admin/issuers', heading: 'Issuers' },
      { path: '/admin/certificates', heading: 'Certificates' },
      { path: '/admin/revocations', heading: 'Revocations' },
      { path: '/admin/verifiers', heading: 'Verifiers' },
      { path: '/admin/verifications', heading: 'Verifications' },
      { path: '/admin/hr', heading: 'HR' }
    ];

    for (const p of adminPages) {
      await page.goto(`${BASE_URL}${p.path}`, { waitUntil: 'networkidle2' });
      await sleep(1000);
      const text = await page.evaluate(() => document.body.innerText);
      const matched = text.includes(p.heading);
      console.log(`Admin route ${p.path}: ${matched ? 'OK' : 'HEADING NOT FOUND'}`);
      if (!matched) throw new Error(`Heading "${p.heading}" not found on ${p.path}`);
    }

    // 6. Check Console Errors
    const filteredErrors = consoleErrors.filter(e => !e.includes('favicon'));
    console.log(`\nTotal Console Errors Logged: ${filteredErrors.length}`);
    if (filteredErrors.length > 0) {
      console.warn('Console Errors:', filteredErrors);
    }

    console.log('\n=============================================');
    console.log('ALL REGRESSION TESTS PASSED!');
    console.log('=============================================');

  } catch (err) {
    console.error('Regression Test Failed:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
