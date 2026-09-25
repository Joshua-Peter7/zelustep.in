import React, { useState } from 'react';
import logoImg from '../source/logo.png';
import { Lock, Mail, ArrowRight, AlertCircle, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';

export default function LoginPage({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setError('');
    setLoading(true);

    try {
      const res = await api.auth.login(email.trim(), password);
      if (res.user) {
        const userData = {
          id: res.user.id,
          email: res.user.email,
          fullName: res.user.fullName,
          role: res.user.role || (res.user.email.includes('admin') ? 'admin' : 'user'),
          token: res.token
        };
        localStorage.setItem('zelustep_user', JSON.stringify(userData));
        localStorage.setItem('omni_user', JSON.stringify(userData));
        onLoginSuccess(userData);
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check your email and password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page-container">
      <div className="login-card-wrapper">
        {/* Brand Header */}
        <div className="login-brand-header">
          <img src={logoImg} alt="Zelustep Logo" className="login-brand-logo-img" />
          <div className="login-brand-title">Zelustep</div>
          <p className="login-brand-subtitle">Personal Tracker</p>
        </div>

        {/* Login Box */}
        <div className="clean-card login-box">
          <div className="login-box-header">
            <h3>Sign in to your account</h3>
            <p>Enter your credentials to access your isolated workspace</p>
          </div>

          {error && (
            <div className="auth-error-banner" style={{ margin: '0 0 16px 0' }}>
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label className="input-label">Email Address</label>
              <div className="input-with-icon">
                <Mail size={14} className="input-icon" />
                <input 
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  id="login-email-input"
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Password</label>
              <div className="input-with-icon">
                <Lock size={14} className="input-icon" />
                <input 
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                  id="login-password-input"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary btn-block"
              disabled={loading}
              id="login-submit-btn"
              style={{ marginTop: '8px' }}
            >
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
              <ArrowRight size={14} />
            </button>
          </form>

          <div className="login-footer-info" style={{ marginTop: '20px' }}>
            <ShieldCheck size={13} />
            <span>Accounts are provisioned and managed by the system administrator.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
