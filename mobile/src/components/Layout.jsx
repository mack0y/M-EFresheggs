import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  TrendingUp,
  DollarSign,
  TrendingDown,
  Users,
  AlertTriangle,
  Moon,
  Sun,
  Truck,
  Building,
  FileText,
  Menu,
  X,
  BarChart3,
  Settings,
} from 'lucide-react';

// All nav items for the full menu
const allNavItems = [
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
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/reports', icon: FileText, label: 'Reports' },
];

// Bottom nav items (5 most used)
const bottomNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/inventory', icon: Package, label: 'Stock' },
  { to: '/sales', icon: ShoppingCart, label: 'Sales' },
  { to: '/expenses', icon: TrendingDown, label: 'Costs' },
  { to: null, icon: Menu, label: 'More' },
];

export default function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem('mobile-theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('mobile-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const currentPath = location.pathname;

  return (
    <div className="app-shell">
      {/* Top Header */}
      <header className="app-header">
        <div className="app-header-left">
          <img
            src="/M-EFresheggs/mobile/logo.png"
            alt="M&E Fresh Eggs"
            className="app-logo"
          />
          <span className="app-header-title">M&E Fresh Eggs</span>
        </div>
        <button
          className="header-icon-btn"
          onClick={() => setDarkMode(prev => !prev)}
          aria-label={darkMode ? 'Light mode' : 'Dark mode'}
        >
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </header>

      {/* Main Content */}
      <main className="app-content">
        {children}
      </main>

      {/* Bottom Tab Bar */}
      <nav className="bottom-tab-bar">
        {bottomNavItems.map(item => {
          if (item.to === null) {
            return (
              <button
                key="more"
                className={`tab-item ${menuOpen ? 'active' : ''}`}
                onClick={() => setMenuOpen(true)}
              >
                <Menu size={22} />
                <span className="tab-label">More</span>
              </button>
            );
          }
          const isActive = item.to === '/' ? currentPath === '/' : currentPath.startsWith(item.to);
          return (
            <button
              key={item.to}
              className={`tab-item ${isActive ? 'active' : ''}`}
              onClick={() => navigate(item.to)}
            >
              <item.icon size={22} />
              <span className="tab-label">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Full-screen Menu Overlay */}
      {menuOpen && (
        <div className="menu-overlay" onClick={() => setMenuOpen(false)}>
          <div className="menu-sheet" onClick={e => e.stopPropagation()}>
            <div className="menu-header">
              <span className="menu-title">All Pages</span>
              <button className="menu-close-btn" onClick={() => setMenuOpen(false)}>
                <X size={22} />
              </button>
            </div>
            <div className="menu-grid">
              {allNavItems.map(item => {
                const isActive = item.to === '/' ? currentPath === '/' : currentPath.startsWith(item.to);
                return (
                  <button
                    key={item.to}
                    className={`menu-item ${isActive ? 'active' : ''}`}
                    onClick={() => navigate(item.to)}
                  >
                    <item.icon size={22} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .app-shell {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          min-height: -webkit-fill-available;
          padding-bottom: calc(3.5rem + var(--safe-area-bottom));
          padding-top: 3.25rem;
        }

        /* Header */
        .app-header {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem 1rem;
          padding-top: calc(0.5rem + var(--safe-area-top));
          background: rgba(255,255,255,0.94);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--color-border-light);
          min-height: 3.25rem;
        }

        [data-theme="dark"] .app-header {
          background: rgba(26,32,25,0.94);
        }

        .app-header-title {
          font-weight: 700;
          font-size: 1.0625rem;
          color: var(--color-primary);
          letter-spacing: -0.02em;
        }

        .app-logo {
          width: 1.5rem;
          height: 1.5rem;
          object-fit: contain;
          border-radius: var(--radius-xs);
          flex-shrink: 0;
        }

        .app-header-left {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .header-icon-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border: none;
          border-radius: var(--radius-sm);
          background: transparent;
          color: var(--color-text-secondary);
          transition: all var(--transition-fast);
          cursor: pointer;
        }

        .header-icon-btn:active {
          background: var(--color-primary-light);
          color: var(--color-primary);
        }

        /* Content */
        .app-content {
          flex: 1;
          padding: 0.75rem;
        }

        /* Bottom Tab Bar */
        .bottom-tab-bar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 100;
          display: flex;
          background: rgba(255,255,255,0.95);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-top: 1px solid var(--color-border-light);
          padding-bottom: var(--safe-area-bottom);
          box-shadow: 0 -2px 8px rgba(0,0,0,0.06);
        }

        [data-theme="dark"] .bottom-tab-bar {
          background: rgba(26,32,25,0.95);
          box-shadow: 0 -2px 8px rgba(0,0,0,0.3);
        }

        .tab-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.1rem;
          padding: 0.375rem 0;
          border: none;
          background: transparent;
          color: var(--color-text-muted);
          font-size: 0.6rem;
          font-weight: 500;
          transition: all var(--transition-fast);
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          position: relative;
        }

        .tab-item:hover {
          color: var(--color-primary);
        }

        .tab-item.active {
          color: var(--color-primary);
        }

        .tab-item.active::before {
          content: '';
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 20px;
          height: 2px;
          background: var(--color-primary);
          border-radius: 0 0 2px 2px;
        }

        .tab-item svg {
          transition: transform var(--transition-spring);
        }

        .tab-item.active svg {
          transform: scale(1.1);
        }

        .tab-label {
          line-height: 1;
        }

        /* Menu Overlay */
        .menu-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.45);
          backdrop-filter: blur(4px);
          z-index: 5000;
          display: flex;
          align-items: flex-end;
          animation: fadeIn 0.15s ease-out;
        }

        .menu-sheet {
          width: 100%;
          background: var(--color-card);
          border-radius: var(--radius-xl) var(--radius-xl) 0 0;
          padding: 1.25rem;
          padding-bottom: calc(1.25rem + var(--safe-area-bottom));
          box-shadow: var(--shadow-xl);
          animation: slideUp 0.25s ease-out;
          max-height: 80vh;
          overflow-y: auto;
        }

        .menu-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid var(--color-border-light);
        }

        .menu-title {
          font-size: 1.0625rem;
          font-weight: 700;
        }

        .menu-close-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border: none;
          border-radius: var(--radius-sm);
          background: transparent;
          color: var(--color-text-secondary);
          cursor: pointer;
        }

        .menu-close-btn:active {
          background: var(--color-primary-light);
          color: var(--color-primary);
        }

        .menu-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
        }

        .menu-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.375rem;
          padding: 0.875rem 0.5rem;
          border: none;
          border-radius: var(--radius-md);
          background: transparent;
          color: var(--color-text-secondary);
          font-size: 0.75rem;
          font-weight: 500;
          transition: all var(--transition-fast);
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }

        .menu-item:active {
          background: var(--color-primary-light);
          color: var(--color-primary);
        }

        .menu-item.active {
          background: var(--color-primary);
          color: white;
        }

        .menu-item svg {
          flex-shrink: 0;
        }

        @media (min-width: 480px) {
          .app-content {
            padding: 1rem;
            max-width: 600px;
            margin: 0 auto;
          }
        }
      `}</style>
    </div>
  );
}
