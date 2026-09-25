import React, { useState, useEffect } from 'react';
import { 
  X, 
  Database, 
  Mail, 
  Send, 
  Check, 
  Copy, 
  Save,
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import { api } from '../services/api';

export default function SettingsModal({ isOpen, onClose, onShowToast, onRefreshStatus, systemStatus }) {
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  
  // Nodemailer SMTP State
  const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState('465');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  
  const [alertEmail, setAlertEmail] = useState('');
  const [testEmailAddress, setTestEmailAddress] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [copiedSchema, setCopiedSchema] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (systemStatus?.supabase?.url) setSupabaseUrl(systemStatus.supabase.url);
      if (systemStatus?.mailer?.host) setSmtpHost(systemStatus.mailer.host);
      if (systemStatus?.mailer?.port) setSmtpPort(String(systemStatus.mailer.port));
      if (systemStatus?.mailer?.user) setSmtpUser(systemStatus.mailer.user);
      if (systemStatus?.defaultAlertEmail) {
        setAlertEmail(systemStatus.defaultAlertEmail);
        setTestEmailAddress(systemStatus.defaultAlertEmail);
      }
    }
  }, [isOpen, systemStatus]);

  if (!isOpen) return null;

  async function handleSaveSettings(e) {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await api.settings.updateKeys({
        supabaseUrl,
        supabaseKey,
        smtpHost,
        smtpPort,
        smtpUser,
        smtpPass,
        alertEmail
      });

      onShowToast(res.message || 'Configuration saved', 'success');
      onRefreshStatus();
      onClose();
    } catch (err) {
      onShowToast(err.message || 'Failed to update settings', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSendTestEmail() {
    if (!testEmailAddress) {
      onShowToast('Enter an email address for testing', 'warning');
      return;
    }

    setIsTestingEmail(true);
    try {
      const res = await api.settings.testEmail(testEmailAddress);
      if (res.success) {
        onShowToast(`Verification email delivered to ${testEmailAddress}`, 'success');
      } else {
        onShowToast(res.message || 'Email test failed. Check your SMTP credentials.', 'warning');
      }
    } catch (err) {
      onShowToast(err.message || 'Error triggering test email', 'error');
    } finally {
      setIsTestingEmail(false);
    }
  }

  function handleSetGmailPreset() {
    setSmtpHost('smtp.gmail.com');
    setSmtpPort('465');
    onShowToast('Applied Gmail SMTP settings (Port 465 SSL)', 'info');
  }

  function handleCopySqlInstructions() {
    const text = `/* Run this SQL in your Supabase SQL Editor: */\n/* The file is located at: backend/supabase_schema.sql */`;
    navigator.clipboard.writeText(text);
    setCopiedSchema(true);
    setTimeout(() => setCopiedSchema(false), 2000);
    onShowToast('Schema reference copied (backend/supabase_schema.sql)', 'info');
  }

  const isConfigured = systemStatus?.mailer?.configured || systemStatus?.resend?.configured;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content settings-modal-box" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="modal-icon-badge">
              <Database size={16} />
            </div>
            <div>
              <h3>Service Integrations</h3>
              <p className="modal-desc">Configure Supabase PostgreSQL database and Nodemailer SMTP email credentials</p>
            </div>
          </div>
          <button className="btn-icon-close" onClick={onClose} id="close-settings-modal">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSaveSettings} className="settings-form">
          {/* Section 1: Supabase Cloud Database */}
          <div className="settings-section">
            <div className="section-status-header">
              <div className="section-title-with-icon">
                <Database size={15} />
                <span className="section-title-text">Supabase PostgreSQL Database</span>
              </div>
              <span className={`badge ${systemStatus?.supabase?.connected ? 'badge-low' : 'badge-urgent'}`}>
                {systemStatus?.supabase?.connected ? 'Cloud Connected' : 'Local Storage Mode'}
              </span>
            </div>

            <p className="settings-section-desc">
              Connect to your Supabase project for persistent cloud database storage across browsers and devices.
            </p>

            <div className="input-group">
              <label className="input-label">Project URL</label>
              <input 
                type="text"
                placeholder="https://xyzcompany.supabase.co"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                className="input-field font-mono"
                id="settings-supabase-url"
              />
            </div>

            <div className="input-group">
              <label className="input-label">Service Role / Secret API Key</label>
              <input 
                type="password"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={supabaseKey}
                onChange={(e) => setSupabaseKey(e.target.value)}
                className="input-field font-mono"
                id="settings-supabase-key"
              />
              <span className="input-hint">Requires Service Role key or public anon key with appropriate RLS permissions.</span>
            </div>

            <div className="sql-action-row">
              <button 
                type="button" 
                className="btn btn-secondary btn-sm"
                onClick={handleCopySqlInstructions}
              >
                {copiedSchema ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                <span>{copiedSchema ? 'SQL Path Copied!' : 'Copy Schema SQL Path'}</span>
              </button>
            </div>
          </div>

          {/* Section 2: Nodemailer SMTP Email Engine */}
          <div className="settings-section">
            <div className="section-status-header">
              <div className="section-title-with-icon">
                <Mail size={15} />
                <span className="section-title-text">Nodemailer SMTP Email Engine</span>
              </div>
              <span className={`badge ${isConfigured ? 'badge-low' : 'badge-high'}`}>
                {isConfigured ? 'Active (Live)' : 'Simulation Mode'}
              </span>
            </div>

            <p className="settings-section-desc">
              Sends automated email notifications for approaching task deadlines and 1-hour advance emergency reminders via your own SMTP server (e.g. Gmail).
            </p>

            {/* Quick Preset */}
            <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Provider Preset:</span>
              <button 
                type="button" 
                className="btn btn-secondary btn-sm"
                onClick={handleSetGmailPreset}
                style={{ fontSize: '11px', padding: '3px 8px' }}
              >
                Use Gmail SMTP Preset
              </button>
            </div>

            <div className="form-row-2col">
              <div className="input-group">
                <label className="input-label">SMTP Host</label>
                <input 
                  type="text"
                  placeholder="smtp.gmail.com"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  className="input-field font-mono"
                  id="settings-smtp-host"
                />
              </div>

              <div className="input-group">
                <label className="input-label">SMTP Port</label>
                <input 
                  type="number"
                  placeholder="465"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  className="input-field font-mono"
                  id="settings-smtp-port"
                />
              </div>
            </div>

            <div className="form-row-2col">
              <div className="input-group">
                <label className="input-label">Sender Email (SMTP User)</label>
                <input 
                  type="email"
                  placeholder="yourname@gmail.com"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  className="input-field"
                  id="settings-smtp-user"
                />
              </div>

              <div className="input-group">
                <label className="input-label">App Password (SMTP Password)</label>
                <input 
                  type="password"
                  placeholder="16-character app password"
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  className="input-field font-mono"
                  id="settings-smtp-pass"
                />
              </div>
            </div>

            <div style={{ background: 'var(--bg-subtle)', padding: '10px 12px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)', marginBottom: '14px', fontSize: '11.5px', color: 'var(--text-tertiary)', lineHeight: '1.5' }}>
              <div style={{ color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <HelpCircle size={13} /> Gmail Configuration Instructions:
              </div>
              Do not use your personal Gmail password. Enable 2-Step Verification on your Google account, then create a dedicated 16-character password at <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" style={{ color: '#818cf8', textDecoration: 'underline' }}>Google App Passwords</a> and paste it above.
            </div>

            <div className="input-group">
              <label className="input-label">Default Alert Recipient</label>
              <input 
                type="email"
                placeholder="alerts@yourdomain.com"
                value={alertEmail}
                onChange={(e) => setAlertEmail(e.target.value)}
                className="input-field"
                id="settings-alert-email"
              />
            </div>

            {/* Test Email Box */}
            <div className="test-email-card">
              <div className="input-label">Live SMTP Test Dispatch</div>
              <div className="test-email-input-row">
                <input 
                  type="email"
                  placeholder="Enter email to receive test message"
                  value={testEmailAddress}
                  onChange={(e) => setTestEmailAddress(e.target.value)}
                  className="input-field"
                />
                <button 
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleSendTestEmail}
                  disabled={isTestingEmail}
                  id="test-email-btn"
                >
                  <Send size={13} />
                  <span>{isTestingEmail ? 'Sending...' : 'Test Send'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="modal-actions-footer">
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={isSaving}
              id="save-settings-btn"
            >
              <Save size={14} />
              <span>{isSaving ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
