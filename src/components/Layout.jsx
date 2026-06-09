import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { APP_VERSION } from '../lib/api';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  TrendingUp,
  Menu,
  X,
  DollarSign,
  FileText,
  TrendingDown,
  Users,
  AlertTriangle,
  Moon,
  Sun,
  Truck,
  Building,
  Tag,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/profits', icon: TrendingUp, label: 'Profits' },
  { to: '/inventory', icon: Package, label: 'Inventory' },
  { to: '/prices', icon: DollarSign, label: 'Pricing' },
  { to: '/sales', icon: ShoppingCart, label: 'Sales' },
  { to: '/spoilage', icon: AlertTriangle, label: 'Spoilage' },
  { to: '/customers', icon: Users, label: 'Customers' },
  { to: '/suppliers', icon: Building, label: 'Suppliers' },
  { to: '/deliveries', icon: Truck, label: 'Deliveries' },
  { to: '/expenses', icon: TrendingDown, label: 'Expenses' },
  { to: '/analytics', icon: TrendingUp, label: 'Analytics' },
  { to: '/reports', icon: FileText, label: 'Reports' },
];

// Bottom nav items (most frequently used - 5 max)
const bottomNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/inventory', icon: Package, label: 'Stock' },
  { to: '/sales', icon: ShoppingCart, label: 'Sales' },
  { to: '/expenses', icon: TrendingDown, label: 'Costs' },
  { to: '/analytics', icon: TrendingUp, label: 'Stats' },
];

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem('theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Close sidebar on route change
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e) {
      // Ctrl+N: click primary action button (Record / Add)
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        const btn = document.querySelector('.page-header-row .btn-primary');
        if (btn) btn.click();
      }
      // Escape: close modals or dismiss forms
      if (e.key === 'Escape') {
        // Close sale modal (SalesLog)
        const modalOverlay = document.querySelector('.sl-modal-overlay');
        if (modalOverlay) {
          const closeBtn = modalOverlay.querySelector('.sl-modal-close');
          if (closeBtn) { closeBtn.click(); return; }
        }
        // Close confirm dialog (ConfirmDialog — overlay click triggers onCancel)
        const confirmOverlay = document.querySelector('.confirm-overlay');
        if (confirmOverlay) {
          confirmOverlay.click();
          return;
        }
        // Fallback: click page header Cancel button (e.g. Expenses, Spoilage, Customers, Suppliers)
        const headerBtn = document.querySelector('.page-header-row .btn-primary');
        if (headerBtn && headerBtn.textContent.includes('Cancel')) {
          headerBtn.click();
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="layout">
      {/* Mobile header */}
      <header className="mobile-header">
        <button
          className="menu-btn"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        <div className="logo">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="logo-img" />
          <span>M&E Fresh Eggs</span>
        </div>
        <button
          className="dark-mode-btn-mobile"
          onClick={() => setDarkMode(prev => !prev)}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">
            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" className="logo-img" />
            <span>M&E Fresh Eggs</span>
          </div>
          <button
            className="close-btn"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `nav-link ${isActive ? 'active' : ''}`
              }
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Dark mode toggle */}
        <div className="sidebar-footer">
          <button
            className="dark-mode-toggle"
            onClick={() => setDarkMode(prev => !prev)}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <div className="dark-mode-icon-wrap">
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            </div>
            <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          <div className="sidebar-version">
            <Tag size={12} />
            <span>v{APP_VERSION}</span>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-content">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="bottom-nav">
        {bottomNavItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `bottom-nav-item ${isActive ? 'active' : ''}`
            }
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </NavLink>
        ))}
        <button
          className="bottom-nav-item bottom-nav-more"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu size={20} />
          <span>More</span>
        </button>
      </nav>

      <style>{`
        .layout {
          display: flex;
          min-height: 100vh;
        }

        /* Mobile header */
        .mobile-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.625rem 1rem;
          background: var(--color-card);
          border-bottom: 1px solid var(--color-border-light);
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 90;
          backdrop-filter: blur(12px);
          background: rgba(255,255,255,0.92);
        }

        [data-theme="dark"] .mobile-header {
          background: rgba(26,32,25,0.92);
        }

        .menu-btn, .close-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border: none;
          background: transparent;
          color: var(--color-text);
          border-radius: var(--radius-md);
          transition: all var(--transition-fast);
        }

        .menu-btn:hover, .close-btn:hover {
          background: var(--color-primary-light);
          color: var(--color-primary);
        }

        .dark-mode-btn-mobile {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border: none;
          background: transparent;
          color: var(--color-text-secondary);
          border-radius: var(--radius-md);
          transition: all var(--transition-fast);
        }

        .dark-mode-btn-mobile:hover {
          background: var(--color-primary-light);
          color: var(--color-primary);
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          font-weight: var(--font-weight-bold);
          font-size: 1.0625rem;
          color: var(--color-primary);
          letter-spacing: -0.02em;
        }

        .logo-img {
          width: 1.75rem;
          height: 1.75rem;
          object-fit: contain;
          border-radius: var(--radius-xs);
        }

        /* Overlay */
        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.45);
          backdrop-filter: blur(4px);
          z-index: 95;
          animation: fadeIn 0.2s;
        }

        /* Sidebar */
        .sidebar {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          width: 260px;
          background: var(--color-card);
          border-right: 1px solid var(--color-border-light);
          z-index: 100;
          transform: translateX(-100%);
          transition: transform var(--transition-slow);
          display: flex;
          flex-direction: column;
          box-shadow: var(--shadow-xl);
        }

        .sidebar.open {
          transform: translateX(0);
        }

        .sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem;
          border-bottom: 1px solid var(--color-border-light);
        }

        .sidebar-nav {
          padding: 0.75rem;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          overflow-y: auto;
        }

        .sidebar-footer {
          padding: 0.75rem;
          border-top: 1px solid var(--color-border-light);
        }

        .dark-mode-toggle {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          width: 100%;
          padding: 0.625rem 0.875rem;
          border: none;
          border-radius: var(--radius-md);
          background: transparent;
          color: var(--color-text-secondary);
          font-size: 0.875rem;
          font-weight: var(--font-weight-medium);
          transition: all var(--transition-fast);
          cursor: pointer;
        }

        .dark-mode-toggle:hover {
          background: var(--color-primary-light);
          color: var(--color-primary);
        }

        .dark-mode-icon-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: var(--radius-sm);
          background: var(--color-bg-subtle);
          transition: all var(--transition-fast);
        }

        .dark-mode-toggle:hover .dark-mode-icon-wrap {
          background: var(--color-primary-200);
          color: var(--color-primary);
        }

        .sidebar-version {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.5rem 0.875rem;
          font-size: 0.6875rem;
          color: var(--color-text-muted);
          opacity: 0.6;
        }

        .sidebar-version svg {
          opacity: 0.5;
        }

        .nav-link {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.625rem 0.875rem;
          border-radius: var(--radius-md);
          font-size: 0.9375rem;
          font-weight: var(--font-weight-medium);
          color: var(--color-text-secondary);
          transition: all var(--transition-fast);
        }

        .nav-link:hover {
          background: var(--color-primary-50);
          color: var(--color-primary);
        }

        .nav-link.active {
          background: var(--color-primary);
          color: white;
          box-shadow: var(--shadow-sm);
        }

        /* Bottom Navigation */
        .bottom-nav {
          display: flex;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background: var(--color-card);
          border-top: 1px solid var(--color-border-light);
          z-index: 90;
          padding: 0.375rem 0;
          padding-bottom: calc(0.375rem + env(safe-area-inset-bottom, 0px));
          backdrop-filter: blur(12px);
          box-shadow: 0 -2px 8px rgba(0,0,0,0.06);
        }

        [data-theme="dark"] .bottom-nav {
          background: rgba(26,32,25,0.95);
          box-shadow: 0 -2px 8px rgba(0,0,0,0.3);
        }

        .bottom-nav-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.15rem;
          padding: 0.375rem 0;
          border: none;
          background: transparent;
          color: var(--color-text-muted);
          font-size: 0.625rem;
          font-weight: var(--font-weight-medium);
          transition: all var(--transition-fast);
          cursor: pointer;
          text-decoration: none;
          position: relative;
          -webkit-tap-highlight-color: transparent;
        }

        .bottom-nav-item:hover {
          color: var(--color-primary);
        }

        .bottom-nav-item.active {
          color: var(--color-primary);
        }

        .bottom-nav-item.active::before {
          content: '';
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 24px;
          height: 2px;
          background: var(--color-primary);
          border-radius: 0 0 2px 2px;
        }

        .bottom-nav-item svg {
          transition: transform var(--transition-spring);
        }

        .bottom-nav-item.active svg {
          transform: scale(1.1);
        }

        .bottom-nav-more {
          text-decoration: none;
        }

        /* Main content */
        .main-content {
          flex: 1;
          padding: 1rem;
          padding-top: 4.25rem;
          padding-bottom: 4.5rem;
          min-height: 100vh;
        }

        /* Desktop styles */
        @media (min-width: 768px) {
          .mobile-header {
            display: none;
          }

          .bottom-nav {
            display: none;
          }

          .sidebar {
            transform: translateX(0);
            position: sticky;
            top: 0;
            height: 100vh;
            box-shadow: none;
          }

          .sidebar-header .close-btn {
            display: none;
          }

          .main-content {
            padding: 1.5rem 2rem;
            padding-top: 1.5rem;
            padding-bottom: 1.5rem;
          }
        }

        kbd {
          display: inline-block;
          padding: 0.1rem 0.35rem;
          font-size: 0.7rem;
          font-family: inherit;
          background: var(--color-bg-subtle, #f0f0f0);
          border: 1px solid var(--color-border, #ddd);
          border-radius: 3px;
          box-shadow: 0 1px 0 rgba(0,0,0,0.1);
        }

        @media (max-width: 767px) {
          .layout {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}
