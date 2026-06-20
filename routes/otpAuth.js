// otpAuth.js
// Drop this file into your existing Node/Express backend (e.g. in a /routes folder).
// Handles: generating + sending OTP codes (SMS via Twilio, email via SMTP),
// verifying codes, creating/finding the user, and issuing a session + JWT.
//
// Wire it into your app with:
//   const otpAuthRouter = require('./otpAuth');
//   app.use('/api/auth', otpAuthRouter);
//
// Required npm packages:
//   npm install express pg jsonwebtoken twilio nodemailer
//
// Required environment variables (see .env.example):
//   DATABASE_URL, JWT_SECRET,
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER,
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM

const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const twilio = require('twilio');
const nodemailer = require('nodemailer');

const router = express.Router();

// ---- Database connection ----
// Use the SAME Session pooler connection string you used in Termux,
// set as DATABASE_URL in your Render environment variables.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ---- SMS setup (Twilio) ----
const twilioClient =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

// ---- Email setup (works with Gmail SMTP, SendGrid SMTP, Resend SMTP, etc.) ----
const mailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-before-launch';
const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;

// ---- TEST MODE ----
// When OTP_TEST_MODE=true in your env vars, a fixed master code (default "123456")
// always works for verify-otp, regardless of what was actually sent. This lets
// testers skip past needing a real SMS/email. Set OTP_TEST_MODE=false (or remove
// the env var entirely) before letting real users in — this is NOT safe for production.
const TEST_MODE = process.env.OTP_TEST_MODE === 'true';
const TEST_CODE = process.env.OTP_TEST_CODE || '123456';

function generateOtpCode() {
  return crypto.randomInt(100000, 999999).toString();
}

function isEmail(contact) {
  return /\S+@\S+\.\S+/.test(contact);
}

// ---------------------------------------------------------------------------
// POST /send-otp
// body: { contact: "+15551234567"  OR  "user@email.com" }
// ---------------------------------------------------------------------------
router.post('/send-otp', async (req, res) => {
  try {
    const { contact } = req.body;
    if (!contact) {
      return res.status(400).json({ error: 'contact is required' });
    }

    const contactType = isEmail(contact) ? 'email' : 'phone';
    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await pool.query(
      `INSERT INTO otps (contact, contact_type, code, expires_at) VALUES ($1, $2, $3, $4)`,
      [contact, contactType, code, expiresAt]
    );

    if (TEST_MODE) {
      console.log(`[TEST MODE] OTP for ${contact} is ${code} (also "${TEST_CODE}" always works)`);
    } else if (contactType === 'phone') {
      if (!twilioClient) {
        return res.status(500).json({ error: 'SMS provider not configured on the server' });
      }
      await twilioClient.messages.create({
        body: `Your QwinCHAT verification code is ${code}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: contact,
      });
    } else {
      await mailTransporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: contact,
        subject: 'Your QwinCHAT verification code',
        text: `Your verification code is ${code}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`,
      });
    }

    return res.json({ success: true, message: `OTP sent via ${contactType}` });
  } catch (err) {
    console.error('send-otp error:', err);
    return res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// ---------------------------------------------------------------------------
// POST /verify-otp
// body: { contact: "...", code: "123456", username: "optional, only used for new users",
//         deviceName: "optional", deviceType: "optional" }
// ---------------------------------------------------------------------------
router.post('/verify-otp', async (req, res) => {
  try {
    const { contact, code, username, deviceName, deviceType } = req.body;
    if (!contact || !code) {
      return res.status(400).json({ error: 'contact and code are required' });
    }

    const { rows } = await pool.query(
      `SELECT * FROM otps WHERE contact = $1 AND used = FALSE ORDER BY created_at DESC LIMIT 1`,
      [contact]
    );
    const otpRow = rows[0];

    if (!otpRow) {
      return res.status(400).json({ error: 'No active OTP found, request a new one' });
    }
    if (new Date(otpRow.expires_at) < new Date()) {
      return res.status(400).json({ error: 'OTP expired, request a new one' });
    }
    if (otpRow.attempts >= MAX_ATTEMPTS) {
      return res.status(429).json({ error: 'Too many attempts, request a new code' });
    }
    const isTestBypass = TEST_MODE && code === TEST_CODE;
    if (otpRow.code !== code && !isTestBypass) {
      await pool.query(`UPDATE otps SET attempts = attempts + 1 WHERE id = $1`, [otpRow.id]);
      return res.status(400).json({ error: 'Incorrect code' });
    }

    await pool.query(`UPDATE otps SET used = TRUE WHERE id = $1`, [otpRow.id]);

    const contactType = otpRow.contact_type;
    const userColumn = contactType === 'email' ? 'email' : 'phone';

    let { rows: userRows } = await pool.query(
      `SELECT * FROM users WHERE ${userColumn} = $1`,
      [contact]
    );
    let user = userRows[0];

    if (!user) {
      const finalUsername = username || `user_${crypto.randomBytes(4).toString('hex')}`;
      const insertResult = await pool.query(
        `INSERT INTO users (${userColumn}, username) VALUES ($1, $2) RETURNING *`,
        [contact, finalUsername]
      );
      user = insertResult.rows[0];
    }

    const sessionResult = await pool.query(
      `INSERT INTO sessions (user_id, device_name, device_type, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [
        user.id,
        deviceName || 'unknown',
        deviceType || 'unknown',
        req.ip,
        req.headers['user-agent'] || '',
      ]
    );
    const sessionId = sessionResult.rows[0].id;

    const token = jwt.sign({ userId: user.id, sessionId }, JWT_SECRET, {
      expiresIn: '30d',
    });

    return res.json({ success: true, token, user });
  } catch (err) {
    console.error('verify-otp error:', err);
    return res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

module.exports = router;

// ---------------------------------------------------------------------------
// POST /quick-login  — TESTING ONLY, skips OTP completely
// body: { contact: "+15551234567" or "user@email.com", username: "optional" }
// Immediately finds-or-creates the user and returns a session token.
// No code is sent, no code is checked. Anyone who knows a phone/email gets in.
// DO NOT leave this endpoint active once real users are using the app.
// ---------------------------------------------------------------------------
router.post('/quick-login', async (req, res) => {
  try {
    const { contact, username, deviceName, deviceType } = req.body;
    if (!contact) {
      return res.status(400).json({ error: 'contact is required' });
    }

    const contactType = isEmail(contact) ? 'email' : 'phone';
    const userColumn = contactType === 'email' ? 'email' : 'phone';

    let { rows: userRows } = await pool.query(
      `SELECT * FROM users WHERE ${userColumn} = $1`,
      [contact]
    );
    let user = userRows[0];

    if (!user) {
      const finalUsername = username || `user_${crypto.randomBytes(4).toString('hex')}`;
      const insertResult = await pool.query(
        `INSERT INTO users (${userColumn}, username) VALUES ($1, $2) RETURNING *`,
        [contact, finalUsername]
      );
      user = insertResult.rows[0];
    }

    const sessionResult = await pool.query(
      `INSERT INTO sessions (user_id, device_name, device_type, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [
        user.id,
        deviceName || 'unknown',
        deviceType || 'unknown',
        req.ip,
        req.headers['user-agent'] || '',
      ]
    );
    const sessionId = sessionResult.rows[0].id;

    const token = jwt.sign({ userId: user.id, sessionId }, JWT_SECRET, {
      expiresIn: '30d',
    });

    return res.json({ success: true, token, user });
  } catch (err) {
    console.error('quick-login error:', err);
    return res.status(500).json({ error: 'Failed to log in' });
  }
});
