import React, { useState, useEffect, useRef } from 'react';
import { 
  AlertTriangle, 
  Clock, 
  Send, 
  Check, 
  Trash2, 
  ShieldAlert, 
  Bell,
  ChevronDown
} from 'lucide-react';
import { api } from '../services/api';
import { getLocalDateTimeString } from '../utils/dateUtils';

export default function EmergencyReminders({ user, onShowToast }) {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testSendingId, setTestSendingId] = useState(null);

  // Form State
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [targetTime, setTargetTime] = useState('');
  const [priority, setPriority] = useState('emergency');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const d = new Date();
    d.setHours(d.getHours() + 2);
    setTargetTime(getLocalDateTimeString(d));
  }, []);

  useEffect(() => {
    fetchReminders();
  }, [user]);

  async function fetchReminders() {
    setLoading(true);
    try {
      const data = await api.emergency.getAll();
      setReminders(data || []);
    } catch (err) {
      console.error('Failed to load emergency reminders:', err);
      onShowToast('Could not load emergency alerts', 'error');
    } finally {
      setLoading(false);
    }
  }

  const computedTriggerTime = targetTime 
    ? new Date(new Date(targetTime).getTime() - 60 * 60 * 1000)
    : null;

  async function handleCreateReminder(e) {
    e.preventDefault();
    if (!title.trim() || !details.trim() || !targetTime) return;

    setIsSubmitting(true);
    try {
      const newReminder = await api.emergency.create({
        title: title.trim(),
        details: details.trim(),
        targetTime: new Date(targetTime).toISOString(),
        priority,
        userEmail: user?.email
      });

      setReminders(prev => [newReminder, ...prev]);
      setTitle('');
      setDetails('');
      onShowToast('Emergency reminder armed for 1 hour advance notification', 'success');
    } catch (err) {
      onShowToast(err.message || 'Failed to create alert', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDismiss(id) {
    try {
      await api.emergency.dismiss(id);
      setReminders(prev => prev.map(r => r.id === id ? { ...r, is_dismissed: true } : r));
      onShowToast('Alert marked as handled', 'info');
    } catch (err) {
      onShowToast('Failed to dismiss reminder', 'error');
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this reminder?')) return;
    try {
      await api.emergency.delete(id);
      setReminders(prev => prev.filter(r => r.id !== id));
      onShowToast('Reminder deleted', 'info');
    } catch (err) {
      onShowToast('Failed to delete reminder', 'error');
    }
  }

  async function handleTestEmail(reminder) {
    setTestSendingId(reminder.id);
    try {
      const res = await api.emergency.testEmail(reminder.id);
      if (res.success) {
        onShowToast(`Emergency notification sent for "${reminder.title}"`, 'success');
        setReminders(prev => prev.map(r => r.id === reminder.id ? { ...r, email_sent: true } : r));
      } else {
        onShowToast(res.message || 'Email delivery failed', 'warning');
      }
    } catch (err) {
      onShowToast(err.message || 'Failed to send emergency email', 'error');
    } finally {
      setTestSendingId(null);
    }
  }

  const SEVERITY_OPTIONS = [
    {
      id: 'urgent',
      label: 'Urgent',
      dotColor: '#f59e0b',
      desc: 'High priority event'
    },
    {
      id: 'emergency',
      label: 'High Emergency',
      dotColor: '#ef4444',
      desc: 'Immediate advance preparation'
    },
    {
      id: 'critical',
      label: 'Critical Priority',
      dotColor: '#ec4899',
      desc: 'System critical intervention'
    }
  ];

  const [filter, setFilter] = useState('all');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeReminders = reminders.filter(r => !r.is_dismissed && !r.email_sent);
  const dispatchedReminders = reminders.filter(r => r.email_sent);
  const filteredReminders = reminders.filter(r => {
    if (filter === 'armed') return !r.email_sent && !r.is_dismissed;
    if (filter === 'dispatched') return r.email_sent;
    return true;
  });

  const currentOption = SEVERITY_OPTIONS.find(o => o.id === priority) || SEVERITY_OPTIONS[1];

  return (
    <div className="section-container">
      {/* Header Banner */}
      <div className="section-header-row">
        <div>
          <div className="section-subtitle">Critical Operations</div>
          <h2 className="section-title">Emergency 1-Hour Advance Reminders</h2>
          <p className="section-desc">
            Automated dispatcher sends email notifications exactly 1 hour prior to critical deadlines.
          </p>
        </div>
        <div className="emergency-header-badges">
          <div className="header-stat-chip">
            <ShieldAlert size={13} className="text-danger" />
            <span>{activeReminders.length} Armed</span>
          </div>
          <div className="header-stat-chip">
            <Send size={13} className="text-success" />
            <span>{dispatchedReminders.length} Dispatched</span>
          </div>
          <div className="engine-minimal-chip">
            <div className="engine-pulse-dot"></div>
            <span>Active (30s)</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Form & Active Alerts */}
      <div className="emergency-grid-layout">
        
        {/* Left Column: Creator Card */}
        <div className="clean-card emergency-creator-card">
          <div className="clean-card-header-compact">
            <div className="card-title-compact">
              <ShieldAlert size={15} style={{ color: '#ef4444' }} />
              <h4>Configure Emergency Alert</h4>
            </div>
          </div>

          <form onSubmit={handleCreateReminder} className="emergency-form">
            <div className="input-group">
              <label className="input-label">Event / Deadline Title</label>
              <input 
                type="text"
                required
                placeholder="e.g. Critical Client Security Audit or Production Deployment"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input-field"
                id="emergency-title-input"
              />
            </div>

            <div className="form-row-2col">
              <div className="input-group">
                <label className="input-label">Target Event Time</label>
                <input 
                  type="datetime-local"
                  required
                  value={targetTime}
                  onChange={(e) => setTargetTime(e.target.value)}
                  className="input-field"
                  id="emergency-time-input"
                />
              </div>

              {/* Custom Premium Severity Dropdown */}
              <div className="custom-dropdown-container" ref={dropdownRef}>
                <label className="input-label">Severity Level</label>
                <button 
                  type="button"
                  className={`custom-dropdown-trigger ${isDropdownOpen ? 'is-open' : ''}`}
                  onClick={() => setIsDropdownOpen(prev => !prev)}
                  id="emergency-priority-select"
                >
                  <div className="dropdown-trigger-val">
                    <span className="severity-dot" style={{ background: currentOption.dotColor }}></span>
                    <span className="severity-label">{currentOption.label}</span>
                  </div>
                  <ChevronDown size={14} className={`dropdown-chevron ${isDropdownOpen ? 'chevron-up' : ''}`} />
                </button>

                {isDropdownOpen && (
                  <div className="custom-dropdown-menu">
                    {SEVERITY_OPTIONS.map(opt => {
                      const isSelected = opt.id === priority;
                      return (
                        <div
                          key={opt.id}
                          className={`dropdown-option-item ${isSelected ? 'selected' : ''}`}
                          onClick={() => {
                            setPriority(opt.id);
                            setIsDropdownOpen(false);
                          }}
                        >
                          <div className="option-info-col">
                            <div className="option-title-row">
                              <span className="severity-dot" style={{ background: opt.dotColor }}></span>
                              <span className="option-name">{opt.label}</span>
                            </div>
                            <span className="option-desc">{opt.desc}</span>
                          </div>
                          {isSelected && <Check size={14} style={{ color: opt.dotColor }} />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Dynamic Trigger Notice (Minimalist) */}
            {computedTriggerTime && (
              <div className="trigger-pill-notice">
                <div className="trigger-pill-left">
                  <span className="trigger-pill-dot"></span>
                  <span>Dispatch: <strong className="trigger-pill-time">{computedTriggerTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}, {computedTriggerTime.toLocaleDateString([], { month: 'short', day: 'numeric' })}</strong></span>
                </div>
              </div>
            )}

            <div className="input-group">
              <label className="input-label">Emergency Instructions & Checklist</label>
              <textarea 
                rows="3"
                required
                placeholder="List required preparation steps, system rollback procedures, credentials, or meeting links..."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="textarea-field"
                id="emergency-details-input"
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-danger btn-block"
              disabled={isSubmitting}
              id="arm-emergency-btn"
            >
              <ShieldAlert size={15} />
              <span>{isSubmitting ? 'Arming Alert...' : 'Arm 1-Hour Advance Reminder'}</span>
            </button>
          </form>
        </div>

        {/* Right Column: Scheduled Alerts Queue Card */}
        <div className="clean-card emergency-queue-panel">
          <div className="emergency-queue-header">
            <div className="emergency-queue-title-wrap">
              <div className="emergency-icon-pill" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', borderColor: 'rgba(34, 197, 94, 0.25)' }}>
                <Clock size={16} />
              </div>
              <div>
                <h4>Scheduled Alerts Queue</h4>
                <p className="emergency-card-subtitle">{filteredReminders.length} of {reminders.length} reminders shown</p>
              </div>
            </div>

            <div className="filter-pill-group">
              <button 
                className={`filter-pill ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                All ({reminders.length})
              </button>
              <button 
                className={`filter-pill ${filter === 'armed' ? 'active' : ''}`}
                onClick={() => setFilter('armed')}
              >
                Armed ({activeReminders.length})
              </button>
              <button 
                className={`filter-pill ${filter === 'dispatched' ? 'active' : ''}`}
                onClick={() => setFilter('dispatched')}
              >
                Sent ({dispatchedReminders.length})
              </button>
            </div>
          </div>

          <div className="emergency-queue-scroll">
            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <span>Checking alert queue...</span>
              </div>
            ) : filteredReminders.length === 0 ? (
              <div className="empty-state">
                <AlertTriangle size={32} className="text-muted" />
                <h4>No active emergency alerts</h4>
                <p>Arm an alert using the form on the left to receive an automated notification 1 hour prior to scheduled events.</p>
              </div>
            ) : (
              filteredReminders.map((rem) => {
                const targetDate = new Date(rem.target_time);
                const triggerDate = new Date(rem.trigger_time);
                const isTriggered = rem.email_sent;
                const isDismissed = rem.is_dismissed;

                return (
                  <div 
                    key={rem.id} 
                    className={`emergency-alert-card ${isDismissed ? 'alert-dismissed' : ''}`}
                  >
                    <div className="alert-card-top">
                      <div className="alert-card-title-group">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className={`badge badge-${rem.priority || 'emergency'}`}>
                            {rem.priority || 'EMERGENCY'}
                          </span>
                          <h4 className="alert-item-title">{rem.title}</h4>
                        </div>
                      </div>

                      {/* Status Tag */}
                      {isTriggered ? (
                        <div className="email-status-tag tag-sent">
                          <Check size={12} />
                          <span>Email Dispatched</span>
                        </div>
                      ) : (
                        <div className="email-status-tag tag-scheduled">
                          <Clock size={12} />
                          <span>Armed (1h Prior)</span>
                        </div>
                      )}
                    </div>

                    <div className="alert-time-badges-grid">
                      <div className="time-sub-box">
                        <span className="time-sub-lbl">Dispatch Timestamp (1h prior):</span>
                        <span className="time-sub-val">
                          {triggerDate.toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </span>
                      </div>
                      <div className="time-sub-box">
                        <span className="time-sub-lbl">Target Event Deadline:</span>
                        <span className="time-sub-val text-danger">
                          {targetDate.toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="emergency-details-view">
                      <div className="details-header-label">Instructions & Checklist:</div>
                      <p className="details-text-content">{rem.details}</p>
                    </div>

                    <div className="alert-card-footer">
                      <span className="alert-user-email">Recipient: {rem.user_email}</span>

                      <div className="btn-group" style={{ display: 'flex', gap: '6px' }}>
                        <button 
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleTestEmail(rem)}
                          disabled={testSendingId === rem.id}
                          title="Send test email now"
                        >
                          <Send size={12} />
                          <span>{testSendingId === rem.id ? 'Sending...' : 'Test Email'}</span>
                        </button>

                        {!isDismissed && (
                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleDismiss(rem.id)}
                            title="Mark handled"
                          >
                            <Check size={12} />
                            <span>Dismiss</span>
                          </button>
                        )}

                        <button 
                          className="btn btn-secondary btn-icon btn-sm text-danger"
                          onClick={() => handleDelete(rem.id)}
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="emergency-queue-footer">
            <span>Automated dispatcher background worker active</span>
          </div>
        </div>
      </div>
    </div>
  );
}
