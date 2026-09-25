import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import TodoManager from './components/TodoManager';
import WorkTracker from './components/WorkTracker';
import EmergencyReminders from './components/EmergencyReminders';
import MoneyDashboard from './components/MoneyDashboard';
import SettingsModal from './components/SettingsModal';
import AdminPanel from './components/AdminPanel';
import LoginPage from './components/LoginPage';
import { api } from './services/api';
import './App.css';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, Menu } from 'lucide-react';
import logoImg from './source/logo.png';

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('zelustep_user') || localStorage.getItem('omni_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState(() => {
    return user?.role === 'admin' ? 'admin' : 'todos';
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('zelustep_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [systemStatus, setSystemStatus] = useState(null);
  const [toasts, setToasts] = useState([]);

  function handleToggleSidebar(val) {
    setIsSidebarCollapsed(prev => {
      const next = typeof val === 'function' ? val(prev) : (val !== undefined ? val : !prev);
      try {
        localStorage.setItem('zelustep_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  }

  useEffect(() => {
    if (user) {
      refreshStatus();
      if (user.role === 'admin') {
        setActiveTab('admin');
      } else if (activeTab === 'admin') {
        setActiveTab('todos');
      }
    }
  }, [user]);

  async function refreshStatus() {
    try {
      const status = await api.settings.getStatus();
      setSystemStatus(status);
    } catch (err) {
      console.warn('API status check note:', err.message);
    }
  }

  function showToast(message, type = 'info') {
    const id = Date.now() + Math.random().toString();
    setToasts(prev => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  }

  function handleLogout() {
    localStorage.removeItem('zelustep_user');
    localStorage.removeItem('omni_user');
    setUser(null);
    showToast('Signed out of session', 'info');
  }

  function handleLoginSuccess(userData) {
    setUser(userData);
    setActiveTab(userData.role === 'admin' ? 'admin' : 'todos');
    showToast(`Signed in as ${userData.fullName || userData.email}`, 'success');
  }

  function handleSwitchUser(switchedUser) {
    setUser(switchedUser);
    localStorage.setItem('zelustep_user', JSON.stringify(switchedUser));
    localStorage.setItem('omni_user', JSON.stringify(switchedUser));
    setActiveTab('todos');
  }

  // If not logged in, render the dedicated Login Page
  if (!user) {
    return (
      <>
        <LoginPage onLoginSuccess={handleLoginSuccess} />
        <div className="toast-container">
          {toasts.map(t => (
            <div key={t.id} className={`toast-item toast-${t.type}`}>
              {t.type === 'success' && <CheckCircle2 size={15} className="text-success" />}
              {t.type === 'error' && <AlertCircle size={15} className="text-danger" />}
              {t.type === 'warning' && <AlertTriangle size={15} className="text-warning" />}
              {t.type === 'info' && <Info size={15} />}
              <span>{t.message}</span>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <div className={`app-root ${isSidebarCollapsed ? 'sidebar-is-collapsed' : 'sidebar-is-expanded'}`}>
      {/* Mobile Top Header (Visible only on mobile <= 768px) */}
      <header className="mobile-top-header">
        <div className="mobile-brand-wrap">
          <img src={logoImg} alt="Zelustep Logo" className="mobile-brand-logo" />
          <div className="mobile-brand-text">
            <span className="mobile-brand-title">Zelustep</span>
            <span className="mobile-brand-subtitle">
              {activeTab === 'todos' && 'Tasks'}
              {activeTab === 'work' && 'Work Log'}
              {activeTab === 'emergency' && 'Emergency Alerts'}
              {activeTab === 'money' && 'Finances'}
              {activeTab === 'admin' && 'Admin'}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(prev => !prev)}
          className="mobile-hamburger-btn"
          aria-label="Toggle navigation menu"
          id="mobile-menu-trigger"
        >
          <Menu size={20} />
        </button>
      </header>

      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="mobile-sidebar-backdrop" 
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Side Navigation Bar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onLogout={handleLogout}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={handleToggleSidebar}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Workspace Tabs */}
      <main className={`main-content ${isSidebarCollapsed ? 'main-collapsed' : 'main-expanded'}`}>
        {user?.role === 'admin' ? (
          <AdminPanel 
            currentUser={user} 
            onSwitchUser={handleSwitchUser} 
            onShowToast={showToast} 
          />
        ) : (
          <>
            {activeTab === 'todos' && (
              <TodoManager user={user} onShowToast={showToast} />
            )}

            {activeTab === 'work' && (
              <WorkTracker user={user} onShowToast={showToast} />
            )}

            {activeTab === 'emergency' && (
              <EmergencyReminders user={user} onShowToast={showToast} />
            )}

            {activeTab === 'money' && (
              <MoneyDashboard user={user} onShowToast={showToast} />
            )}
          </>
        )}
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onShowToast={showToast}
        onRefreshStatus={refreshStatus}
        systemStatus={systemStatus}
      />

      {/* Toast Notification Container */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast-item toast-${t.type}`}>
            {t.type === 'success' && <CheckCircle2 size={15} className="text-success" />}
            {t.type === 'error' && <AlertCircle size={15} className="text-danger" />}
            {t.type === 'warning' && <AlertTriangle size={15} className="text-warning" />}
            {t.type === 'info' && <Info size={15} />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
