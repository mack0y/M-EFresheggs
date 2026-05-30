import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  TrendingUp,
  Menu,
  X,
  DollarSign,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/inventory', icon: Package, label: 'Inventory' },
  { to: '/prices', icon: DollarSign, label: 'Pricing' },
  { to: '/sales', icon: ShoppingCart, label: 'Sales Log' },
  { to: '/analytics', icon: TrendingUp, label: 'Analytics' },
];

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="layout">
      {/* Mobile header */}
      <header className="mobile-header">
        <button
          className="menu-btn"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={24} />
        </button>
        <div className="logo">
          <span className="logo-icon">🥚</span>
          <span>M&E Fresh Eggs</span>
        </div>
        <div style={{ width: 40 }} />
      </header>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">
            <span className="logo-icon">🥚</span>
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
              onClick={() => setSidebarOpen(false)}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="main-content">
        {children}
      </main>

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
          padding: 0.75rem 1rem;
          background: var(--color-card);
          border-bottom: 1px solid var(--color-border);
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 90;
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
          border-radius: var(--radius-sm);
          transition: background 0.2s;
        }

        .menu-btn:hover, .close-btn:hover {
          background: var(--color-primary-light);
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 700;
          font-size: 1.125rem;
          color: var(--color-primary);
        }

        .logo-icon {
          font-size: 1.5rem;
          line-height: 1;
        }

        /* Overlay */
        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.4);
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
          border-right: 1px solid var(--color-border);
          z-index: 100;
          transform: translateX(-100%);
          transition: transform 0.3s ease;
          display: flex;
          flex-direction: column;
        }

        .sidebar.open {
          transform: translateX(0);
        }

        .sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.25rem;
          border-bottom: 1px solid var(--color-border);
        }

        .sidebar-nav {
          padding: 0.75rem;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .nav-link {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          border-radius: var(--radius-sm);
          font-size: 0.9375rem;
          font-weight: 500;
          color: var(--color-text-secondary);
          transition: all 0.2s;
        }

        .nav-link:hover {
          background: var(--color-primary-light);
          color: var(--color-primary);
        }

        .nav-link.active {
          background: var(--color-primary);
          color: white;
        }

        /* Main content */
        .main-content {
          flex: 1;
          padding: 1rem;
          padding-top: 4.5rem;
          min-height: 100vh;
        }

        /* Desktop styles */
        @media (min-width: 768px) {
          .mobile-header {
            display: none;
          }

          .sidebar {
            transform: translateX(0);
            position: sticky;
            top: 0;
            height: 100vh;
          }

          .sidebar-header .close-btn {
            display: none;
          }

          .main-content {
            padding: 1.5rem;
            padding-top: 1.5rem;
          }
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
