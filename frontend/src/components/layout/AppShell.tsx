import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import {
  LayoutDashboard,
  BrainCircuit,
  Pill,
  HeartHandshake,
  Siren,
  User as UserIcon,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Activity,
  ShieldCheck,
  ChevronDown,
  Bot,
  ArrowLeft,
} from 'lucide-react';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useUnsavedChangesContext } from '../../providers/UnsavedChangesProvider';
import { BrandLogo } from '../shared/BrandLogo';
import './AppShell.css';

/* ────────────────────────────────────────────────────
   AppShell — Modern Medical Spatial Layout
   - Patients get full clinical navigation sidebar
   - Admins, Doctors & Caregivers get full-width dedicated console
   - Top Header Bar with Safety Status, SOS Button & Profile Dropdown
   ──────────────────────────────────────────────────── */

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

const patientNavItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={19} /> },
  { to: '/eeg', label: 'EEG Diagnostics', icon: <BrainCircuit size={19} /> },
  { to: '/medications', label: 'Medications', icon: <Pill size={19} /> },
  { to: '/lifestyle', label: 'Lifestyle & Logs', icon: <Activity size={19} /> },
  { to: '/network', label: 'Care Network', icon: <HeartHandshake size={19} /> },
  { to: '/emergency', label: 'Emergency Protocol', icon: <Siren size={19} /> },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { safeNavigate, isDirty, confirmNavigation } = useUnsavedChangesContext();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Only Patients have multi-tab navigation modules; Admins, Doctors, Caretakers get dedicated full-width consoles
  const userRole = user?.role?.toUpperCase();
  const hasSidebar = userRole === 'PATIENT';

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    if (userDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [userDropdownOpen]);

  const handleConfirmLogout = () => {
    logout();
    navigate('/auth');
  };

  const getRoleLabel = () => {
    switch (userRole) {
      case 'DOCTOR':
        return 'Physician Specialist';
      case 'CARETAKER':
        return 'Authorized Caregiver';
      case 'ADMIN':
        return 'Platform Administrator';
      default:
        return 'Epilepsy Patient';
    }
  };

  // Comprehensive page title mapping for elegant breadcrumbs
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/dashboard':
        return userRole === 'ADMIN'
          ? 'Platform Administration'
          : userRole === 'DOCTOR'
          ? 'Neurology Clinical Console'
          : userRole === 'CARETAKER'
          ? 'Caregiver Care Console'
          : 'Overview Dashboard';
      case '/eeg':
        return 'EEG ML Diagnostics';
      case '/medications':
        return 'Prescriptions & Adherence';
      case '/lifestyle':
        return 'Lifestyle & Health Logs';
      case '/network':
        return 'Care Network';
      case '/emergency':
        return 'Emergency Protocol';
      case '/chat':
        return 'AI Clinical Assistant';
      case '/profile':
        return 'Account & Clinical Profile';
      case '/admin':
        return 'Platform Governance Hub';
      default:
        return 'Clinical Workspace';
    }
  };

  return (
    <div
      className={`app-shell ${
        !hasSidebar ? 'no-sidebar' : sidebarCollapsed ? 'sidebar-collapsed' : ''
      }`}
    >
      {/* ── Desktop Sidebar (Patients Only) ── */}
      {hasSidebar && (
        <aside className="app-sidebar glass-sidebar" aria-label="Main navigation">
          {/* ── Brand Header ── */}
          <div className={`sidebar-header ${sidebarCollapsed ? 'header-collapsed' : ''}`}>
            <div className="sidebar-logo">
              <BrandLogo
                size="md"
                showText={!sidebarCollapsed}
                subtitle="Neurology AI"
                to="/dashboard"
              />
            </div>

            <button
              className="sidebar-toggle"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>
          </div>

          {/* ── Navigation Links ── */}
          <nav className="sidebar-nav">
            <div className="nav-section-label">
              {!sidebarCollapsed && <span>Navigation</span>}
            </div>

            {patientNavItems.map((item) => {
              const isActive = location.pathname === item.to;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={(e) => {
                    if (isDirty && location.pathname !== item.to) {
                      e.preventDefault();
                      safeNavigate(item.to);
                    }
                  }}
                  className={`sidebar-link ${isActive ? 'active' : ''}`}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  {isActive && (
                    <motion.div
                      className="sidebar-active-pill"
                      layoutId="activeNavPill"
                      transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                    />
                  )}
                  <span className="sidebar-link-icon">{item.icon}</span>
                  {!sidebarCollapsed && (
                    <span className="sidebar-link-label">{item.label}</span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </aside>
      )}

      {/* ── Main Workspace + Persistent 3D Floating Pipe Dock ── */}
      <div className="app-workspace-wrap">
        {/* ── 3D Floating Pipe Header Bar ── */}
        <div className="app-topbar-floating-dock">
          <header className="app-topbar glass-dock-pipe">
            <div className="topbar-left">
            {/* Topbar Brand for Single-Console Layouts (Admin / Doctor / Caretaker) */}
            {!hasSidebar && (
              <BrandLogo
                size="sm"
                to="/dashboard"
                subtitle={user?.role === 'ADMIN' ? 'Platform Governance' : 'Clinical System'}
                className="topbar-brand-logo"
              />
            )}

            {hasSidebar && (
              <button
                className="mobile-menu-toggle"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            )}

              {/* On Dashboard: Action Cluster (Safety Monitor + AI Assistant + SOS) is docked at the start of the Topbar */}
              {location.pathname === '/dashboard' ? (
                <div className="topbar-actions-cluster">
                  {/* Live Epilepsy Safety Pulse Widget */}
                  <div
                    className="topbar-safety-pill"
                    title="Live System Health & AI Telemetry"
                  >
                    <div className="safety-pulse-dot-wrap">
                      <span className="safety-pulse-ring" />
                      <div className="safety-pulse-dot" />
                    </div>
                    <span className="safety-pill-text">
                      {user?.role === 'PATIENT'
                        ? 'Safety: Active · AI Monitor Online'
                        : user?.role === 'DOCTOR'
                        ? 'Clinical Sync: Active'
                        : user?.role === 'CARETAKER'
                        ? 'Caregiver Relay: Active'
                        : 'System Status: All Systems Operational'}
                    </span>
                    <svg className="live-telemetry-wave" viewBox="0 0 36 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M0 6H8L11 1L15 11L18 4L21 8L24 6H36" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>

                  {/* AI Assistant Button */}
                  <button
                    className="topbar-ai-btn"
                    onClick={() => safeNavigate('/chat')}
                    title="Open AI Medical Assistant"
                  >
                    <Bot size={15} className="ai-sparkle-icon" />
                    <span className="ai-btn-text">AI Assistant</span>
                  </button>

                  {/* Quick Emergency SOS Button (Patients & Caretakers) */}
                  {(user?.role === 'PATIENT' || user?.role === 'CARETAKER') && (
                    <button
                      className="topbar-sos-btn"
                      onClick={() => safeNavigate('/emergency')}
                      title="Immediate Emergency Protocol"
                    >
                      <Siren size={16} className="sos-icon-pulse" />
                      <span className="sos-btn-text">Emergency SOS</span>
                    </button>
                  )}
                </div>
              ) : (
                /* Contextual Workspace Badge & Back Navigation (Sub-pages only) */
                <div className="topbar-context-badge">
                  <button
                    className="topbar-back-pill"
                    onClick={() => safeNavigate('/dashboard')}
                    title="Return to Main Workspace"
                  >
                    <ArrowLeft size={14} />
                    <span>Dashboard</span>
                  </button>
                  <span className="topbar-page-label">{getPageTitle()}</span>
                </div>
              )}
            </div>

            {/* Top Bar Right Items: Safety Status, SOS Button, User Profile */}
            <div className="topbar-right">
              {/* On sub-pages: Action Cluster smoothly sits on the right */}
              {location.pathname !== '/dashboard' && (
                <div className="topbar-actions-cluster">
                  {/* Live Epilepsy Safety Pulse Widget */}
                  <div
                    className="topbar-safety-pill"
                    title="Live System Health & AI Telemetry"
                  >
                    <div className="safety-pulse-dot-wrap">
                      <span className="safety-pulse-ring" />
                      <div className="safety-pulse-dot" />
                    </div>
                    <span className="safety-pill-text">
                      {user?.role === 'PATIENT'
                        ? 'Safety: Active · AI Monitor Online'
                        : user?.role === 'DOCTOR'
                        ? 'Clinical Sync: Active'
                        : user?.role === 'CARETAKER'
                        ? 'Caregiver Relay: Active'
                        : 'System Status: All Systems Operational'}
                    </span>
                    <svg className="live-telemetry-wave" viewBox="0 0 36 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M0 6H8L11 1L15 11L18 4L21 8L24 6H36" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>

                  {/* AI Assistant Button */}
                  {location.pathname === '/chat' ? (
                    <button
                      className="topbar-ai-btn active-back"
                      onClick={() => safeNavigate('/dashboard')}
                      title="Return to Main Dashboard"
                    >
                      <LayoutDashboard size={14} />
                      <span className="ai-btn-text">Exit to Dashboard</span>
                    </button>
                  ) : (
                    <button
                      className="topbar-ai-btn"
                      onClick={() => safeNavigate('/chat')}
                      title="Open AI Medical Assistant"
                    >
                      <Bot size={15} className="ai-sparkle-icon" />
                      <span className="ai-btn-text">AI Assistant</span>
                    </button>
                  )}

                  {/* Quick Emergency SOS Button (Patients & Caretakers) */}
                  {(user?.role === 'PATIENT' || user?.role === 'CARETAKER') && (
                    <button
                      className="topbar-sos-btn"
                      onClick={() => safeNavigate('/emergency')}
                      title="Immediate Emergency Protocol"
                    >
                      <Siren size={16} className="sos-icon-pulse" />
                      <span className="sos-btn-text">Emergency SOS</span>
                    </button>
                  )}
                </div>
              )}

            {/* User Profile Pill & Dropdown */}
            {user && (
              <div className="topbar-profile-container" ref={dropdownRef}>
                <button
                  className={`topbar-user-pill ${userDropdownOpen ? 'active' : ''}`}
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  aria-expanded={userDropdownOpen}
                  aria-haspopup="true"
                  title="Account & Profile Menu"
                >
                  <div className="topbar-user-avatar">
                    {user.full_name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="topbar-user-info">
                    <span className="topbar-user-name">{user.full_name}</span>
                    <span className="topbar-user-role">{getRoleLabel()}</span>
                  </div>
                  <ChevronDown size={14} className={`topbar-chevron ${userDropdownOpen ? 'rotated' : ''}`} />
                </button>

                {/* Dropdown Menu */}
                <AnimatePresence>
                  {userDropdownOpen && (
                    <motion.div
                      className="user-dropdown-menu"
                      initial={{ opacity: 0, y: 4, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.98 }}
                      transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <div className="dropdown-user-header">
                        <div className="dropdown-avatar-circle">
                          {user.full_name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="dropdown-user-meta">
                          <div className="dropdown-name">{user.full_name}</div>
                          <div className="dropdown-email">{user.email}</div>
                          <div className="dropdown-badge-row">
                            <span className="glass-badge role-badge">
                              <ShieldCheck size={11} /> {getRoleLabel()}
                            </span>
                            <span className="glass-badge verified-badge">
                              ✓ {user.is_email_verified ? 'Email Verified' : 'Active'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="dropdown-divider" />

                      <div className="dropdown-items-list">
                        {location.pathname !== '/dashboard' && (
                          <button
                            className="dropdown-item-btn"
                            onClick={() => {
                              setUserDropdownOpen(false);
                              safeNavigate('/dashboard');
                            }}
                          >
                            <LayoutDashboard size={16} />
                            <span>Return to Dashboard</span>
                          </button>
                        )}

                        <button
                          className="dropdown-item-btn"
                          onClick={() => {
                            setUserDropdownOpen(false);
                            safeNavigate('/profile');
                          }}
                        >
                          <UserIcon size={16} />
                          <span>Account & Clinical Profile</span>
                        </button>

                        <div className="dropdown-divider" />

                        <button
                          className="dropdown-item-btn logout-item-btn"
                          onClick={() => {
                            setUserDropdownOpen(false);
                            confirmNavigation(() => setLogoutDialogOpen(true));
                          }}
                        >
                          <LogOut size={16} />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </header>
      </div>

        {/* ── Mobile Slide-down Menu (Patients) ── */}
        <AnimatePresence>
          {mobileMenuOpen && hasSidebar && (
            <>
              <motion.div
                className="mobile-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileMenuOpen(false)}
              />
              <motion.nav
                className="mobile-menu glass-panel"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                aria-label="Mobile navigation"
              >
                {patientNavItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `mobile-link ${isActive ? 'active' : ''}`
                    }
                    onClick={(e) => {
                      setMobileMenuOpen(false);
                      if (isDirty && location.pathname !== item.to) {
                        e.preventDefault();
                        safeNavigate(item.to);
                      }
                    }}
                  >
                    <span className="mobile-link-icon">{item.icon}</span>
                    <span>{item.label}</span>
                  </NavLink>
                ))}

                <button
                  className="mobile-link logout-action"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    confirmNavigation(() => setLogoutDialogOpen(true));
                  }}
                >
                  <span className="mobile-link-icon"><LogOut size={20} /></span>
                  <span>Sign Out</span>
                </button>
              </motion.nav>
            </>
          )}
        </AnimatePresence>

        {/* ── Main Workspace Content with Instant Smooth Page Transitions ── */}
        <main className="app-main">
          <div className="app-content-container">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: 0.12,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="page-transition-wrap"
            >
              <Outlet />
            </motion.div>
          </div>
        </main>
      </div>

      {/* ── Sign Out Confirmation Dialog ── */}
      <ConfirmDialog
        isOpen={logoutDialogOpen}
        title="Sign Out of EpiCare?"
        description="Are you sure you want to end your session? You will need your email and password to log in again."
        confirmText="Yes, Sign Out"
        cancelText="Stay Signed In"
        variant="warning"
        onConfirm={handleConfirmLogout}
        onClose={() => setLogoutDialogOpen(false)}
      />
    </div>
  );
}
