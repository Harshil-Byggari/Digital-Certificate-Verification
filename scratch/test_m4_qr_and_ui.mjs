import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROMIUM_PATH = '/usr/bin/chromium';
const BASE_URL = 'http://localhost:5173';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  console.log('=== Starting M4 QR Scanner & UI Validation Suite ===');
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--use-fake-ui-for-media-stream']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  try {
    // -------------------------------------------------------------
    // Step 1: Generate valid QR PNG and invalid dummy PNG
    // -------------------------------------------------------------
    console.log('\n[Test 1] Generating QR test images...');
    await page.goto(`${BASE_URL}/verify?ref=DCVS-2026-001`, { waitUntil: 'networkidle2' });
    await sleep(1500);

    const validQrPath = path.resolve('../scratch/valid_qr_dcvs_001.png');
    const qrElement = await page.$('svg[width="160"]');
    if (!qrElement) throw new Error('QRCodeSVG element with width="160" not found');
    await qrElement.screenshot({ path: validQrPath });
    const qrStat = fs.statSync(validQrPath);
    console.log(`Saved valid QR PNG screenshot: ${validQrPath} (${qrStat.size} bytes)`);

    // Create an invalid dummy PNG (just a blue square, no QR code)
    const invalidPngDataUrl = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 200;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(0, 0, 200, 200);
      return canvas.toDataURL('image/png');
    });
    const invalidQrBuffer = Buffer.from(invalidPngDataUrl.split(',')[1], 'base64');
    const invalidQrPath = path.resolve('../scratch/invalid_no_qr.png');
    fs.writeFileSync(invalidQrPath, invalidQrBuffer);
    console.log(`Saved invalid dummy PNG: ${invalidQrPath} (${invalidQrBuffer.length} bytes)`);

    // -------------------------------------------------------------
    // Step 2: Test File Upload with Valid QR Code
    // -------------------------------------------------------------
    console.log('\n[Test 2] Testing File Upload with Valid QR Code...');
    await page.goto(`${BASE_URL}/verify`, { waitUntil: 'networkidle2' });
    await sleep(500);

    // Click "Scan QR" button
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const scanBtn = btns.find(b => b.textContent.includes('Scan QR'));
      if (scanBtn) scanBtn.click();
      else throw new Error('Scan QR button not found');
    });
    await sleep(500);

    // Verify modal opened
    const isModalOpen = await page.evaluate(() => {
      return !!document.querySelector('input[type="file"]');
    });
    console.log(`QR Scanner Modal opened: ${isModalOpen}`);
    if (!isModalOpen) throw new Error('Scanner modal did not open');

    // Upload the valid QR file
    const fileInput = await page.$('input[type="file"]');
    await fileInput.uploadFile(validQrPath);
    await sleep(1500);

    // Verify modal closed and verification triggered for DCVS-2026-001
    const pageContentAfterUpload = await page.evaluate(() => {
      return {
        queryValue: document.querySelector('input[type="text"]')?.value,
        hasValidBanner: document.body.innerText.includes('VERIFIED AUTHENTIC') || document.body.innerText.includes('Certificate Is Valid & Active'),
        hasApplicant: document.body.innerText.includes('Asha M Nair')
      };
    });
    console.log('Result after Valid QR Upload:', pageContentAfterUpload);
    if (!pageContentAfterUpload.hasValidBanner || !pageContentAfterUpload.hasApplicant) {
      throw new Error(`Valid QR upload did not verify successfully: ${JSON.stringify(pageContentAfterUpload)}`);
    }
    console.log('>>> [PASS] Valid QR Image Upload & Decoding');

    // -------------------------------------------------------------
    // Step 3: Test File Upload with Invalid Image (No QR)
    // -------------------------------------------------------------
    console.log('\n[Test 3] Testing File Upload with Invalid Image (No QR)...');
    // Open modal again
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const scanBtn = btns.find(b => b.textContent.includes('Scan QR'));
      if (scanBtn) scanBtn.click();
    });
    await sleep(500);

    const fileInputInvalid = await page.$('input[type="file"]');
    await fileInputInvalid.uploadFile(invalidQrPath);
    await sleep(1000);

    const errorMessage = await page.evaluate(() => {
      const modal = document.querySelector('.fixed.inset-0');
      return modal?.querySelector('.bg-red-50')?.innerText;
    });
    console.log(`Invalid image error display: "${errorMessage}"`);
    if (!errorMessage || !errorMessage.includes('No valid QR code was detected')) {
      throw new Error(`Expected 'No valid QR code was detected' error, got: ${errorMessage}`);
    }
    console.log('>>> [PASS] Invalid Image Rejection with User-Friendly Error');

    // Close modal
    await page.evaluate(() => {
      const closeBtn = document.querySelector('button .lucide-x')?.closest('button');
      if (closeBtn) closeBtn.click();
    });
    await sleep(500);

    // -------------------------------------------------------------
    // Step 4: Test Camera Permission Denial / Failure Handling
    // -------------------------------------------------------------
    console.log('\n[Test 4] Testing Camera Permission Denial / Failure Handling...');
    const deniedContext = await browser.createBrowserContext();
    // Deny camera permissions
    await deniedContext.overridePermissions(BASE_URL, []);
    const deniedPage = await deniedContext.newPage();
    
    // Mock getUserMedia to throw PermissionDenied
    await deniedPage.evaluateOnNewDocument(() => {
      if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
      }
    });

    await deniedPage.goto(`${BASE_URL}/verify`, { waitUntil: 'networkidle2' });
    await sleep(500);

    // Open QR modal
    await deniedPage.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const scanBtn = btns.find(b => b.textContent.includes('Scan QR'));
      if (scanBtn) scanBtn.click();
    });
    await sleep(500);

    // Click "Live Camera" tab
    await deniedPage.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const camBtn = btns.find(b => b.textContent.includes('Live Camera'));
      if (camBtn) camBtn.click();
    });
    await sleep(500);

    const camErrorMessage = await deniedPage.evaluate(() => {
      const modal = document.querySelector('.fixed.inset-0');
      return modal?.querySelector('.bg-red-50')?.innerText;
    });
    console.log(`Camera error display: "${camErrorMessage}"`);
    if (!camErrorMessage || !camErrorMessage.includes('Unable to access camera')) {
      throw new Error(`Expected 'Unable to access camera' error, got: ${camErrorMessage}`);
    }
    console.log('>>> [PASS] Camera Permission Denial Handled Gracefully');
    await deniedContext.close();

    // -------------------------------------------------------------
    // Step 5: Test TAMPERED Verification Display on Frontend
    // -------------------------------------------------------------
    console.log('\n[Test 5] Testing TAMPERED Certificate Display on Frontend...');
    // We created DCVS-2026-012 in Step 1 which is TAMPERED
    await page.goto(`${BASE_URL}/verify?ref=DCVS-2026-012`, { waitUntil: 'networkidle2' });
    await sleep(1500);

    const tamperedUiState = await page.evaluate(() => {
      const bodyText = document.body.innerText;
      return {
        hasTamperAlert: bodyText.includes('SECURITY ALERT: TAMPERED'),
        hasIntegrityFail: bodyText.includes('Cryptographic Integrity Check Failed') || bodyText.includes('Integrity Violation'),
        hasAuditCard: bodyText.includes('Cryptographic Failure Audit'),
        hasHashMismatch: bodyText.includes('SHA-256 Data Hash') && bodyText.includes('Mismatch'),
        hasSignatureInvalid: bodyText.includes('Digital Signature (HMAC)') && bodyText.includes('Invalid')
      };
    });
    console.log('TAMPERED UI State:', tamperedUiState);
    if (!tamperedUiState.hasTamperAlert || !tamperedUiState.hasIntegrityFail || !tamperedUiState.hasAuditCard) {
      throw new Error(`TAMPERED UI failed to render correctly: ${JSON.stringify(tamperedUiState)}`);
    }
    console.log('>>> [PASS] TAMPERED Security Alert & Cryptographic Audit Display');

    console.log('\n=============================================');
    console.log('ALL M4 QR & UI ACCEPTANCE TESTS PASSED!');
    console.log('=============================================');

  } catch (err) {
    console.error('Test Suite Failed:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
