import React, { useState } from 'react';
import { X, Lock, Mail, User, ShieldCheck, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let res;
      if (isRegister) {
        res = await api.auth.register(email, password, fullName);
      } else {
        res = await api.auth.login(email, password);
      }

      if (res.user) {
        const userData = {
          id: res.user.id,
          email: res.user.email,
          fullName: res.user.fullName,
          token: res.token
        };
        localStorage.setItem('omni_user', JSON.stringify(userData));
        onAuthSuccess(userData);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  }

  function handleDemoLogin() {
    const demoUser = {
      id: 'usr_demo_vip',
      email: 'demo@omnitrack.pro',
      fullName: 'Product Account',
      token: 'demo_token'
    };
    localStorage.setItem('omni_user', JSON.stringify(demoUser));
    onAuthSuccess(demoUser);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content auth-modal-box" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="modal-icon-badge">
              <ShieldCheck size={16} />
            </div>
            <div>
              <h3>{isRegister ? 'Create Account' : 'Account Sign In'}</h3>
              <p className="modal-desc">
                {isRegister 
                  ? 'Sign up to manage personal tasks, work logs, and finances'
                  : 'Enter your credentials to access your workspace'}
              </p>
            </div>
          </div>
          <button className="btn-icon-close" onClick={onClose} id="close-auth-modal">
            <X size={16} />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="auth-error-banner">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          {isRegister && (
            <div className="input-group">
              <label className="input-label">Full Name</label>
              <div className="input-with-icon">
                <User size={14} className="input-icon" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Morgan"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="input-field"
                  id="auth-name"
                />
              </div>
            </div>
          )}

          <div className="input-group">
            <label className="input-label">Email Address</label>
            <div className="input-with-icon">
              <Mail size={14} className="input-icon" />
              <input
                type="email"
                required
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                id="auth-email"
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
                id="auth-password"
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary btn-block"
            disabled={loading}
            id="auth-submit-btn"
          >
            {loading ? 'Authenticating...' : (isRegister ? 'Register Account' : 'Sign In')}
          </button>

          <div className="auth-divider">
            <span>OR</span>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-block demo-btn"
            onClick={handleDemoLogin}
            id="auth-demo-btn"
          >
            <span>Continue with Demo Session</span>
          </button>

          <div className="auth-footer-toggle">
            {isRegister ? (
              <p>
                Existing account?{' '}
                <button 
                  type="button" 
                  className="link-btn" 
                  onClick={() => { setIsRegister(false); setError(''); }}
                >
                  Sign In
                </button>
              </p>
            ) : (
              <p>
                Need an account?{' '}
                <button 
                  type="button" 
                  className="link-btn" 
                  onClick={() => { setIsRegister(true); setError(''); }}
                >
                  Register
                </button>
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
