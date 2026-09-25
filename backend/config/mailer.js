import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

let transporter = null;

/**
 * Initializes or retrieves the singleton Nodemailer SMTP transporter.
 */
export function getMailerTransport() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (user && pass) {
    if (!transporter) {
      transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user: user.trim(),
          pass: pass.trim().replace(/\s+/g, '') // remove spaces from app passwords
        },
        pool: true,
        maxConnections: 10,
        maxMessages: 100,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000
      });
    }
    return transporter;
  }
  return null;
}

/**
 * Checks whether SMTP credentials (user and password) are configured in .env
 */
export function isMailerConfigured() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  return !!(user && pass && pass.trim().length >= 6);
}

// Backwards-compatible aliases for existing routes
export const getResendClient = getMailerTransport;
export const isResendConfigured = isMailerConfigured;

// ============================================================================
// HTML & PLAIN TEXT EMAIL TEMPLATE BUILDERS
// ============================================================================
function generateTodoPlainText({ title, description, dueTime, priority }) {
  const formattedTime = new Date(dueTime).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return `Zelustep Task Deadline Reminder

Task: ${title}
${description ? `Details: ${description}\n` : ''}Due Time: ${formattedTime}
Priority: ${(priority || 'medium').toUpperCase()}
Status: Pending

Please make sure to complete it before the deadline.
- Zelustep Operations`;
}

function generateTodoEmailHtml({ title, description, dueTime, priority, userName }) {
  const formattedTime = new Date(dueTime).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const priorityColor =
    priority === 'urgent' ? '#ef4444' :
    priority === 'high' ? '#f97316' :
    priority === 'medium' ? '#6366f1' : '#10b981';

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Task Deadline Reminder</title>
  </head>
  <body style="margin:0;padding:0;background-color:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f4f4f5;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="padding: 30px 16px;">
      <tr>
        <td align="center">
          <table width="560" border="0" cellspacing="0" cellpadding="0" style="background:#18181b;border-radius:12px;border:1px solid #27272a;overflow:hidden;box-shadow:0 12px 30px rgba(0,0,0,0.5);">
            <!-- Header -->
            <tr>
              <td style="background:#121215;padding:24px 28px;border-bottom:1px solid #27272a;">
                <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#8b5cf6;margin-bottom:6px;">
                  Zelustep &bull; Task Deadline Reminder
                </div>
                <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;line-height:1.3;">
                  Task Deadline Reminder
                </h1>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:28px;">
                <p style="margin:0 0 16px 0;font-size:15px;color:#a1a1aa;line-height:1.5;">
                  Your scheduled deliverable is reaching its deadline. Here is the task you need to complete:
                </p>

                <!-- Normal text task card -->
                <div style="background:#121215;border-left:4px solid ${priorityColor};border-radius:6px;padding:18px;margin-bottom:20px;border-top:1px solid #27272a;border-right:1px solid #27272a;border-bottom:1px solid #27272a;">
                  <div style="font-size:17px;font-weight:600;color:#ffffff;margin-bottom:8px;">
                    ${escapeHtml(title)}
                  </div>
                  ${description ? `
                    <div style="font-size:14px;color:#d4d4d8;line-height:1.6;white-space:pre-wrap;margin-bottom:12px;">
                      ${escapeHtml(description)}
                    </div>
                  ` : ''}
                  <div style="font-size:12.5px;color:#a1a1aa;">
                    <strong>Due Time:</strong> ${formattedTime} &nbsp;&bull;&nbsp; 
                    <strong>Priority:</strong> <span style="color:${priorityColor};font-weight:600;">${(priority || 'normal').toUpperCase()}</span>
                  </div>
                </div>

                <div style="background:#121215;border:1px solid #27272a;border-radius:8px;padding:12px 16px;margin-bottom:20px;">
                  <table width="100%" border="0" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="color:#71717a;font-size:13px;">Current Status:</td>
                      <td align="right" style="color:#fbbf24;font-weight:600;font-size:13px;">Pending Action</td>
                    </tr>
                  </table>
                </div>

                <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;">
                  Please complete your task and mark it as done in your Zelustep workspace.
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#121215;padding:14px 28px;text-align:center;border-top:1px solid #27272a;font-size:12px;color:#52525b;">
                Sent to ${escapeHtml(userName || 'Registered User')} &bull; Zelustep Operations
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
}

function generateEmergencyEmailHtml({ title, details, targetTime, priority, userName }) {
  const targetFormatted = new Date(targetTime).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Emergency 1-Hour Reminder</title>
  </head>
  <body style="margin:0;padding:0;background-color:#0b0f19;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f8fafc;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="padding: 40px 20px;">
      <tr>
        <td align="center">
          <table width="560" border="0" cellspacing="0" cellpadding="0" style="background:#171d2b;border-radius:16px;border:2px solid #ef4444;overflow:hidden;box-shadow:0 25px 30px -5px rgba(239,68,68,0.25);">
            <!-- High Alert Header -->
            <tr>
              <td style="background:linear-gradient(135deg, #b91c1c 0%, #dc2626 50%, #ea580c 100%);padding:28px 32px;text-align:left;">
                <div style="display:inline-block;padding:3px 10px;border-radius:4px;background:rgba(0,0,0,0.3);font-size:11px;font-weight:800;letter-spacing:2px;color:#fecaca;margin-bottom:8px;">
                  🚨 1-HOUR ADVANCE ALERT
                </div>
                <h1 style="margin:0;font-size:24px;font-weight:800;color:#ffffff;line-height:1.2;">
                  URGENT: ${escapeHtml(title)}
                </h1>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:32px;">
                <div style="background:#ef444415;border:1px solid #ef444455;border-radius:10px;padding:14px 18px;margin-bottom:24px;">
                  <strong style="color:#f87171;font-size:14px;">Notice:</strong>
                  <span style="color:#fca5a5;font-size:14px;"> Your critical event is scheduled in exactly <strong>1 HOUR</strong> (${targetFormatted}). Please take immediate preparation.</span>
                </div>

                <div style="margin-bottom:24px;">
                  <label style="display:block;font-size:12px;font-weight:700;letter-spacing:1px;color:#94a3b8;text-transform:uppercase;margin-bottom:8px;">Emergency Details & Action Items:</label>
                  <div style="background:#0b0f19;border-radius:12px;padding:18px;border:1px solid #334155;color:#f1f5f9;font-size:15px;line-height:1.7;white-space:pre-wrap;">${escapeHtml(details)}</div>
                </div>

                <div style="background:#111827;border-radius:10px;padding:16px;border:1px solid #1f2937;">
                  <table width="100%" border="0" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="color:#9ca3af;font-size:13px;">Target Deadline / Event Time:</td>
                      <td align="right" style="color:#ef4444;font-weight:700;font-size:15px;">${targetFormatted}</td>
                    </tr>
                    <tr>
                      <td style="color:#9ca3af;font-size:13px;padding-top:6px;">Alert Timestamp:</td>
                      <td align="right" style="color:#e5e7eb;font-size:13px;padding-top:6px;">${new Date().toLocaleTimeString()}</td>
                    </tr>
                  </table>
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#0f1420;padding:16px 32px;text-align:center;border-top:1px solid #242e42;font-size:12px;color:#64748b;">
                Zelustep Emergency Alert System &bull; Automated 1-Hour Advance Dispatch
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================================
// EMAIL DISPATCH FUNCTIONS (NODEMAILER SMTP)
// ============================================================================

/**
 * Sends a To-Do reminder email via Nodemailer.
 */
export async function sendTodoReminderEmail({ to, title, description, dueTime, priority, userName }) {
  const recipient = to || process.env.DEFAULT_ALERT_EMAIL;
  if (!recipient) {
    console.warn(`⚠️ Cannot send To-Do reminder email: No recipient email specified.`);
    return { success: false, reason: 'no_recipient' };
  }

  const cleanTitle = (title || '').replace(/\[span:\d+\]/g, '').trim();
  const cleanDescription = (description || '').replace(/\[span:\d+\]/g, '').trim();

  const subject = `[Zelustep Reminder] Task Due: ${cleanTitle}`;
  const plainText = generateTodoPlainText({ title: cleanTitle, description: cleanDescription, dueTime, priority });
  const html = generateTodoEmailHtml({ title: cleanTitle, description: cleanDescription, dueTime, priority, userName: recipient });

  const transport = getMailerTransport();
  if (!transport) {
    console.log(`\n📨 [SIMULATED NODEMAILER DISPATCH - SMTP NOT CONFIGURED]`);
    console.log(`   To: ${recipient}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Text:\n${plainText}\n`);
    return {
      success: true,
      simulated: true,
      message: 'Email simulated (Configure SMTP_USER and SMTP_PASS in .env or Settings to send live email)'
    };
  }

  const from = process.env.SMTP_FROM || `Zelustep Reminders <${process.env.SMTP_USER}>`;

  try {
    const info = await transport.sendMail({
      from,
      to: recipient,
      replyTo: process.env.SMTP_USER,
      subject,
      text: plainText,
      html,
    });

    console.log(`✅ To-Do reminder sent to ${recipient} via Nodemailer. Message ID:`, info.messageId);
    return { success: true, id: info.messageId };
  } catch (err) {
    console.error(`❌ Nodemailer email dispatch failed for ${recipient}:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Sends a 1-Hour advance Emergency reminder email via Nodemailer.
 */
export async function sendEmergencyReminderEmail({ to, title, details, targetTime, priority, userName }) {
  const recipient = to || process.env.DEFAULT_ALERT_EMAIL;
  if (!recipient) {
    console.warn(`⚠️ Cannot send Emergency reminder email: No recipient email specified.`);
    return { success: false, reason: 'no_recipient' };
  }

  const subject = `🚨 [1-HOUR WARNING] Emergency Reminder: ${title}`;
  const html = generateEmergencyEmailHtml({ title, details, targetTime, priority, userName: recipient });

  const transport = getMailerTransport();
  if (!transport) {
    console.log(`\n🚨 [SIMULATED EMERGENCY NODEMAILER DISPATCH - SMTP NOT CONFIGURED]`);
    console.log(`   To: ${recipient}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Target Event Time: ${targetTime} (1 Hour from notification trigger)`);
    console.log(`   Emergency Details: ${details}\n`);
    return {
      success: true,
      simulated: true,
      message: 'Emergency email simulated (Configure SMTP_USER and SMTP_PASS to send live email)'
    };
  }

  const from = process.env.SMTP_FROM || `Zelustep Alerts <${process.env.SMTP_USER}>`;

  try {
    const info = await transport.sendMail({
      from,
      to: recipient,
      replyTo: process.env.SMTP_USER,
      subject,
      html,
    });
    console.log(`🚨 Emergency 1-Hour Reminder sent to ${recipient} via Nodemailer. Message ID:`, info.messageId);
    return { success: true, id: info.messageId };
  } catch (err) {
    console.error(`❌ Nodemailer emergency email failed for ${recipient}:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Sends a verification test email via Nodemailer.
 */
export async function sendTestEmail(recipientEmail) {
  const transport = getMailerTransport();
  if (!transport) {
    return {
      success: false,
      message: 'Nodemailer SMTP is not configured. Please add SMTP_USER and SMTP_PASS in .env or Settings.'
    };
  }

  const from = process.env.SMTP_FROM || `Zelustep <${process.env.SMTP_USER}>`;

  try {
    const info = await transport.sendMail({
      from,
      to: recipientEmail,
      subject: '✅ Zelustep: Nodemailer SMTP Integration Verified!',
      html: `
        <div style="background:#09090b;padding:32px;color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;border-radius:12px;border:1px solid #27272a;max-width:560px;margin:0 auto;">
          <h2 style="color:#8b5cf6;margin-top:0;font-size:22px;">Zelustep &bull; Live SMTP Test Successful</h2>
          <p style="color:#a1a1aa;font-size:15px;line-height:1.6;">
            Congratulations! Your Nodemailer SMTP email configuration is active and connected.
          </p>
          <div style="background:#18181b;padding:16px 20px;border-radius:8px;margin:20px 0;border:1px solid #27272a;">
            <p style="margin:4px 0;font-size:13px;color:#a1a1aa;"><strong>Sender (SMTP User):</strong> ${process.env.SMTP_USER}</p>
            <p style="margin:4px 0;font-size:13px;color:#a1a1aa;"><strong>Recipient:</strong> ${recipientEmail}</p>
            <p style="margin:4px 0;font-size:13px;color:#a1a1aa;"><strong>SMTP Host:</strong> ${process.env.SMTP_HOST || 'smtp.gmail.com'}:${process.env.SMTP_PORT || '465'}</p>
            <p style="margin:4px 0;font-size:13px;color:#a1a1aa;"><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
            <p style="margin:8px 0 4px 0;font-size:13px;color:#10b981;font-weight:600;"><strong>Status:</strong> Active & Ready for Task & Emergency Reminders</p>
          </div>
          <p style="margin:0;font-size:12px;color:#71717a;">
            Zelustep Operations System
          </p>
        </div>
      `
    });

    console.log(`✅ Test email delivered to ${recipientEmail}. Message ID:`, info.messageId);
    return { success: true, id: info.messageId };
  } catch (err) {
    console.error(`❌ Nodemailer test email failed:`, err.message);
    return { success: false, error: err.message };
  }
}
