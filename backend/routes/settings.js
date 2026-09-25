import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isSupabaseConnected, initSupabase } from '../config/supabase.js';
import { isMailerConfigured, sendTestEmail, getMailerTransport } from '../config/mailer.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENV_PATH = path.resolve(__dirname, '../.env');

// GET /api/settings/status - Check services status
router.get('/status', (req, res) => {
  const isConfigured = isMailerConfigured();

  return res.json({
    supabase: {
      connected: isSupabaseConnected(),
      url: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.replace(/^(https?:\/\/[^/]+).*/, '$1') : null,
      hasKey: !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)
    },
    mailer: {
      configured: isConfigured,
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || '465',
      user: process.env.SMTP_USER || null,
      maskedPass: process.env.SMTP_PASS ? '••••••••••••••••' : null
    },
    // Backwards-compatible for frontend status queries
    resend: {
      configured: isConfigured,
      fromEmail: process.env.SMTP_USER || 'Not configured',
      maskedKey: process.env.SMTP_PASS ? '••••••••••••••••' : null
    },
    defaultAlertEmail: process.env.DEFAULT_ALERT_EMAIL || ''
  });
});

// POST /api/settings/test-email - Send a test email via Nodemailer (Requires Auth)
router.post('/test-email', requireAuth, async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Target email address is required' });
  }

  const result = await sendTestEmail(email);
  return res.json(result);
});

// POST /api/settings/update-keys - Save Supabase & Nodemailer SMTP keys into .env (Requires Auth)
router.post('/update-keys', requireAuth, (req, res) => {
  const { 
    supabaseUrl, 
    supabaseKey, 
    smtpHost, 
    smtpPort, 
    smtpUser, 
    smtpPass, 
    alertEmail,
    // backwards-compat
    resendKey 
  } = req.body;

  let currentEnv = '';
  if (fs.existsSync(ENV_PATH)) {
    currentEnv = fs.readFileSync(ENV_PATH, 'utf-8');
  }

  // Parse existing env
  const existingMap = {};
  currentEnv.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        existingMap[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
      }
    }
  });

  if (supabaseUrl) existingMap.SUPABASE_URL = supabaseUrl.trim();
  if (supabaseKey) {
    existingMap.SUPABASE_SERVICE_ROLE_KEY = supabaseKey.trim();
    existingMap.SUPABASE_ANON_KEY = supabaseKey.trim();
  }
  if (smtpHost) existingMap.SMTP_HOST = smtpHost.trim();
  if (smtpPort) existingMap.SMTP_PORT = String(smtpPort).trim();
  if (smtpUser) existingMap.SMTP_USER = smtpUser.trim();
  if (smtpPass) existingMap.SMTP_PASS = smtpPass.trim();
  if (alertEmail) existingMap.DEFAULT_ALERT_EMAIL = alertEmail.trim();

  // If user passed a key through resendKey input (e.g. app password)
  if (resendKey && !smtpPass) {
    existingMap.SMTP_PASS = resendKey.trim();
  }

  // Update process.env in-memory
  Object.entries(existingMap).forEach(([k, v]) => {
    process.env[k] = v;
  });

  // Re-write .env file
  const lines = Object.entries(existingMap).map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(ENV_PATH, lines.join('\n'), 'utf-8');

  // Re-initialize Supabase client
  initSupabase();

  return res.json({
    success: true,
    message: 'Configuration updated successfully! Nodemailer and Supabase refreshed.',
    status: {
      supabaseConnected: isSupabaseConnected(),
      mailerConfigured: isMailerConfigured(),
      resendConfigured: isMailerConfigured()
    }
  });
});

export default router;
