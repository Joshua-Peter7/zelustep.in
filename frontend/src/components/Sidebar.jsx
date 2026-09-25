import React, { useState, useEffect } from 'react';
import logoImg from '../source/logo.png';
import { 
  CheckSquare, 
  Calendar, 
  AlertTriangle, 
  Wallet, 
  User, 
  LogOut, 
  Clock, 
  Users,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  X
} from 'lucide-react';

export default function Sidebar({ 
  activeTab, 
  setActiveTab, 
  user, 
  onLogout,
  isCollapsed,
  setIsCollapsed,
  isMobileOpen,
  onCloseMobile
}) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isAdmin = user?.role === 'admin' || user?.email?.toLowerCase().includes('admin');

  // Navigation Items
  const navItems = isAdmin
    ? [{ id: 'admin', label: 'Users & Credentials', icon: Users, badge: null }]
    : [
        { id: 'todos', label: 'Tasks', icon: CheckSquare, badge: null },
        { id: 'work', label: 'Work Log', icon: Calendar, badge: null },
        { id: 'emergency', label: 'Emergency Alerts', icon: AlertTriangle, badge: null },
        { id: 'money', label: 'Finances', icon: Wallet, badge: null },
      ];

  // Helper for initials
  const getInitials = (name, email) => {
    if (name) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return name.slice(0, 2).toUpperCase();
    }
    if (email) return email.slice(0, 2).toUpperCase();
    return 'U';
  };

  const displayName = user?.fullName || (user?.email ? user.email.split('@')[0] : 'User');
  const userInitials = getInitials(user?.fullName, user?.email);

  return (
    <aside className={`sidebar-container ${isCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'} ${isMobileOpen ? 'mobile-open' : ''}`}>
      
      {/* Top Brand & Collapse / Mobile Close Toggle */}
      <div className="sidebar-header">
        <div className="sidebar-brand-wrap">
          <img src={logoImg} alt="Zelustep Logo" className="sidebar-logo-img" />
          {(!isCollapsed || isMobileOpen) && (
            <div className="sidebar-brand-text">
              <div className="brand-title">
                <span>Zelustep</span>
              </div>
              <div className="brand-subtitle">Personal Tracker</div>
            </div>
          )}
        </div>

        <div className="sidebar-header-actions">
          {/* Mobile Close Button (shown on mobile when drawer is open) */}
          <button
            type="button"
            onClick={onCloseMobile}
            className="sidebar-mobile-close-btn"
            title="Close Menu"
            aria-label="Close navigation menu"
          >
            <X size={18} />
          </button>

          {/* Desktop Toggle Minimize/Maximize Button */}
          <button
            type="button"
            onClick={() => setIsCollapsed(prev => !prev)}
            className="sidebar-toggle-btn"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            id="sidebar-toggle-btn"
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </div>

      {/* Navigation List */}
      <div className="sidebar-nav-section">
        {(!isCollapsed || isMobileOpen) && <div className="sidebar-section-label">WORKSPACE</div>}

        <nav className="sidebar-nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                title={isCollapsed && !isMobileOpen ? `${item.label}${item.badge ? ` (${item.badge})` : ''}` : undefined}
                id={`sidebar-tab-${item.id}`}
              >
                <div className="nav-item-icon-wrap">
                  <Icon size={18} />
                  {isCollapsed && !isMobileOpen && item.badge && <span className="nav-icon-dot-badge"></span>}
                </div>

                {(!isCollapsed || isMobileOpen) && (
                  <span className="nav-item-label">{item.label}</span>
                )}

                {(!isCollapsed || isMobileOpen) && item.badge && (
                  <span className={`nav-pill ${item.id === 'emergency' ? 'pill-urgent' : ''}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Profile & Utilities Section */}
      <div className="sidebar-footer">
        
        {/* Live Clock (shown when expanded or mobile drawer open) */}
        {(!isCollapsed || isMobileOpen) && (
          <div className="sidebar-clock-row">
            <Clock size={12} className="text-muted" />
            <span className="clock-time">
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className="clock-date">
              {time.toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </span>
          </div>
        )}

        {/* User Profile Section */}
        <div className={`sidebar-profile-card ${isCollapsed && !isMobileOpen ? 'profile-collapsed' : ''}`}>
          <div className="profile-avatar-wrap">
            <div className="profile-avatar">
              {userInitials}
            </div>
            <span className="profile-status-dot" title="Active Session"></span>
          </div>

          {(!isCollapsed || isMobileOpen) && (
            <div className="profile-info-col">
              <div className="profile-name" title={displayName}>
                {displayName}
              </div>
              <div className="profile-role-tag">
                {isAdmin ? (
                  <span className="role-admin-badge">
                    <ShieldCheck size={10} /> Admin
                  </span>
                ) : (
                  <span className="role-user-badge">Workspace Member</span>
                )}
              </div>
            </div>
          )}

          {(!isCollapsed || isMobileOpen) && (
            <button
              type="button"
              onClick={() => {
                if (onCloseMobile) onCloseMobile();
                onLogout();
              }}
              className="sidebar-logout-btn"
              title="Sign out of session"
              id="sidebar-logout-btn"
            >
              <LogOut size={15} />
            </button>
          )}
        </div>

        {/* When collapsed on desktop: small logout icon at bottom */}
        {isCollapsed && !isMobileOpen && (
          <button
            type="button"
            onClick={() => {
              if (onCloseMobile) onCloseMobile();
              onLogout();
            }}
            className="sidebar-mini-logout-btn"
            title={`Sign out (${displayName})`}
            id="sidebar-mini-logout-btn"
          >
            <LogOut size={16} />
          </button>
        )}
      </div>
    </aside>
  );
}
