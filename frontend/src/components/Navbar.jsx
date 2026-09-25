import React, { useState, useEffect } from 'react';
import logoImg from '../source/logo.png';
import { 
  CheckSquare, 
  Calendar, 
  AlertTriangle, 
  Wallet, 
  User, 
  LogOut, 
  LogIn, 
  Clock, 
  Users
} from 'lucide-react';

export default function Navbar({ 
  activeTab, 
  setActiveTab, 
  user, 
  onOpenAuth, 
  onLogout, 
  onOpenSettings,
  systemStatus 
}) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isAdmin = user?.role === 'admin' || user?.email?.toLowerCase().includes('admin');

  // Admin gets ONLY the admin portal; standard users get their personal suite
  const navItems = isAdmin
    ? [{ id: 'admin', label: 'Users & Credentials', icon: Users, badge: null }]
    : [
        { id: 'todos', label: 'Tasks', icon: CheckSquare, badge: null },
        { id: 'work', label: 'Work Log', icon: Calendar, badge: null },
        { id: 'emergency', label: 'Emergency Alerts', icon: AlertTriangle, badge: null },
        { id: 'money', label: 'Finances', icon: Wallet, badge: null },
      ];

  return (
    <header className="navbar-container">
      <div className="navbar-inner">
        {/* Brand */}
        <div className="brand-group">
          <img src={logoImg} alt="Zelustep Logo" className="brand-logo-img" />
          <div>
            <div className="brand-title">Zelustep</div>
            <div className="brand-subtitle">Personal Tracker</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="nav-tabs">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`nav-tab-btn ${isActive ? 'active' : ''}`}
                id={`tab-${item.id}`}
              >
                <Icon size={15} />
                <span>{item.label}</span>
                {item.badge && (
                  <span className={`nav-pill ${item.id === 'emergency' ? 'pill-urgent' : ''}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Info & Actions */}
        <div className="nav-actions">
          {/* Clock */}
          <div className="live-clock">
            <Clock size={12} />
            <span>
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>



          {/* User Auth */}
          {user ? (
            <div className="user-profile-menu">
              <div className="user-avatar-badge" title={user.email}>
                <User size={13} />
                <span className="user-email-text">{user.fullName || user.email.split('@')[0]}</span>
              </div>
              <button 
                className="btn btn-secondary btn-icon" 
                onClick={onLogout} 
                title="Log out"
                id="logout-btn"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button 
              className="btn btn-primary btn-sm" 
              onClick={onOpenAuth}
              id="login-btn"
            >
              <LogIn size={13} />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
