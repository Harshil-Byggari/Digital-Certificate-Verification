const express = require('express');
const router = express.Router();
const { verifyCertificate } = require('../controllers/verifyController');
const { executeQuery } = require('../config/database');

// Health Check
router.get('/health', (req, res) => {
  res.json({ status: 'UP', timestamp: new Date().toISOString() });
});

// Public Verification
router.post('/verify', verifyCertificate);

// Applicants
router.get('/applicants/:id', async (req, res) => {
  try {
    const appResult = await executeQuery(
      `SELECT * FROM APPLICANT WHERE APPLICANT_ID = :id`, [req.params.id]
    );
    if (!appResult.rows || appResult.rows.length === 0) {
      return res.status(404).json({ error: 'Applicant not found' });
    }
    const app = appResult.rows[0];

    const emails = await executeQuery(
      `SELECT EMAIL_ID, EMAIL, IS_PRIMARY FROM APPLICANT_EMAIL WHERE APPLICANT_ID = :id`, [req.params.id]
    );
    const phones = await executeQuery(
      `SELECT PHONE_ID, PHONE_NUMBER, IS_PRIMARY FROM APPLICANT_PHONE WHERE APPLICANT_ID = :id`, [req.params.id]
    );

    res.json({
      applicantId: app.APPLICANT_ID,
      firstName: app.FIRST_NAME,
      middleName: app.MIDDLE_NAME,
      lastName: app.LAST_NAME,
      dob: app.DOB,
      aadharCard: app.AADHAR_CARD,
      address: {
        street: app.STREET,
        city: app.CITY,
        state: app.STATE,
        pincode: app.PINCODE
      },
      emails: emails.rows,
      phones: phones.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/applicants/:id/certificates', async (req, res) => {
  try {
    const result = await executeQuery(
      `SELECT * FROM VW_CERTIFICATE_VERIFY WHERE APPLICANT_ID = :id`, [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dashboard stats
router.get('/dashboard/stats', async (req, res) => {
  try {
    const result = await executeQuery(`SELECT * FROM VW_SYSTEM_ANALYTICS`);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

