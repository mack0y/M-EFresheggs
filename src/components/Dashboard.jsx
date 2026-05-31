import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  ShoppingCart,
  AlertTriangle,
  ArrowRight,
  Egg,
  DollarSign,
  RefreshCw,
} from 'lucide-react';
import { fetchInventory, fetchTodaySales, fetchTodayExpenses, fetchInventoryValue, getEggCount, formatInventory, formatPeso } from '../lib/api';
import { getUserFriendlyError } from '../lib/errors';

export default function Dashboard() {
  const navigate = useNavigate();
  const [inventory, setInventory] = useState([]);
  const [todaySales, setTodaySales] = useState([]);
  const [todayExpenses, setTodayExpenses] = useState([]);
  const [inventoryValue, setInventoryValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const [inv, sales, expenses, invValue] = await Promise.all([
        fetchInventory(),
        fetchTodaySales(),
        fetchTodayExpenses(),
        fetchInventoryValue(),
      ]);
      setInventory(inv || []);
      setTodaySales(sales || []);
      setTodayExpenses(expenses || []);
      setInventoryValue(invValue);
    } catch (err) {
      console.error('Dashboard load error:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Defer to microtask to avoid cascading render warning from loadData setState calls
    Promise.resolve().then(() => loadData());
  }, []);

  const totalEggsSoldToday = todaySales.reduce(
    (sum, s) => sum + getEggCount(s),
    0
  );

  const todayRevenue = todaySales.reduce(
    (sum, s) => sum + parseFloat(s.total_amount || 0),
    0
  );

  const todayExpenseTotal = todayExpenses.reduce(
    (sum, e) => sum + parseFloat(e.amount || 0),
    0
  );

  const netProfit = todayRevenue - todayExpenseTotal;

  const totalStock = inventory.reduce(
    (sum, item) => sum + (item.quantity_on_hand || 0),
    0
  );

  const lowStockItems = inventory.filter(
    item => item.quantity_on_hand <= 50 && item.quantity_on_hand > 0
  );

  const outOfStockItems = inventory.filter(
    item => item.quantity_on_hand === 0
  );

  const statCards = [
    {
      label: 'Stock Value',
      value: formatPeso(inventoryValue),
      sub: `${totalStock.toLocaleString()} total eggs`,
      icon: DollarSign,
      color: '#1565C0',
      bg: '#E3F2FD',
    },
    {
      label: 'Total Stock',
      value: totalStock.toLocaleString(),
      sub: 'eggs in inventory',
      icon: Package,
      color: '#2E7D32',
      bg: '#E8F5E9',
    },
    {
      label: 'Sold Today',
      value: totalEggsSoldToday.toLocaleString(),
      sub: 'eggs sold',
      icon: ShoppingCart,
      color: '#1565C0',
      bg: '#E3F2FD',
    },
    {
      label: 'Low Stock Items',
      value: lowStockItems.length + outOfStockItems.length,
      sub: outOfStockItems.length > 0
        ? `${outOfStockItems.length} out of stock`
        : 'need restocking',
      icon: AlertTriangle,
      color: lowStockItems.length > 0 ? '#F57C00' : '#2E7D32',
      bg: lowStockItems.length > 0 ? '#FFF3E0' : '#E8F5E9',
    },
    {
      label: 'Revenue Today',
      value: formatPeso(todayRevenue),
      sub: `${totalEggsSoldToday.toLocaleString()} eggs sold`,
      icon: DollarSign,
      color: '#2E7D32',
      bg: '#E8F5E9',
    },
    {
      label: 'Expenses Today',
      value: formatPeso(todayExpenseTotal),
      sub: todayExpenseTotal > 0 ? `${todayExpenses.length} entries recorded` : 'no expenses yet',
      icon: Egg,
      color: '#C62828',
      bg: '#FFEBEE',
    },
    {
      label: 'Net Profit Today',
      value: formatPeso(netProfit),
      sub: netProfit >= 0 ? 'positive cash flow' : 'operating at a loss',
      icon: DollarSign,
      color: netProfit >= 0 ? '#2E7D32' : '#C62828',
      bg: netProfit >= 0 ? '#E8F5E9' : '#FFEBEE',
    },
  ];

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p className="page-subtitle">Overview of your egg store</p>
      </div>

      {error && (
        <div className="error-banner">
          <AlertTriangle size={20} />
          <div className="error-banner-content">
            <strong>Failed to load dashboard</strong>
            <p>{getUserFriendlyError(error)}</p>
          </div>
          <button className="btn btn-sm btn-secondary" onClick={loadData}>
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
        {statCards.map((card, i) => (
          <div key={i} className="stat-card" style={{ animationDelay: `${i * 0.05}s` }}>
            <div
              className="stat-icon"
              style={{ background: card.bg, color: card.color }}
            >
              <card.icon size={22} />
            </div>
            <div className="stat-info">
              <span className="stat-value">
                {loading ? <span className="skeleton" style={{ display: 'inline-block', width: 60, height: 28 }}>&nbsp;</span> : card.value}
              </span>
              <span className="stat-label">{card.label}</span>
              <span className="stat-sub">{card.sub}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        {/* Stock Levels */}
        <div className="card">
          <div className="card-header">
            <h2>Stock Levels</h2>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigate('/inventory')}
            >
              Manage <ArrowRight size={16} />
            </button>
          </div>
          <div className="stock-list">
            {loading
              ? Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="stock-item">
                    <span className="skeleton" style={{ width: 100, height: 20 }}>&nbsp;</span>
                    <span className="skeleton" style={{ width: 50, height: 20 }}>&nbsp;</span>
                  </div>
                ))
              : inventory.map((item, i) => {
                  const qty = item.quantity_on_hand || 0;
                  let badgeClass = 'badge-success';
                  let label = 'In Stock';
                  if (qty === 0) {
                    badgeClass = 'badge-danger';
                    label = 'Out of Stock';
                  } else if (qty <= 50) {
                    badgeClass = 'badge-warning';
                    label = 'Low Stock';
                  }
                  return (
                    <div
                      key={item.id || i}
                      className="stock-item"
                      style={{ animationDelay: `${i * 0.03}s` }}
                    >
                      <span className="stock-name">
                        {item.egg_sizes?.name || `Size ${i + 1}`}
                      </span>
                      <div className="stock-right">
                        <span className="stock-breakdown">
                          {formatInventory(qty)}
                        </span>
                        <span className={`badge ${badgeClass}`}>{label}</span>
                      </div>
                    </div>
                  );
                })}
          </div>
        </div>

        {/* Today's Sales */}
        <div className="card">
          <div className="card-header">
            <h2>Today's Sales</h2>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigate('/sales')}
            >
              View All <ArrowRight size={16} />
            </button>
          </div>
          {loading ? (
            <div className="stock-list">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="stock-item">
                  <span className="skeleton" style={{ width: 80, height: 20 }}>&nbsp;</span>
                  <span className="skeleton" style={{ width: 60, height: 20 }}>&nbsp;</span>
                </div>
              ))}
            </div>
          ) : todaySales.length === 0 ? (
            <div className="empty-state">
              <ShoppingCart size={36} />
              <p>No sales recorded today yet</p>
              <button
                className="btn btn-primary"
                onClick={() => navigate('/sales')}
              >
                Record a Sale
              </button>
            </div>
          ) : (
            <div className="stock-list">
              {todaySales.slice(0, 10).map((sale, i) => (
                <div
                  key={sale.id}
                  className="stock-item"
                  style={{ animationDelay: `${i * 0.03}s` }}
                >
                  <span className="stock-name">
                    {sale.egg_sizes?.name || 'Unknown'}
                  </span>
                  <div className="stock-right">
                    <span className="stock-qty">
                      {sale.quantity}{' '}
                      <span className="sale-unit">
                        {sale.unit === 'tray'
                          ? `tray${sale.quantity > 1 ? 's' : ''}`
                          : `egg${sale.quantity > 1 ? 's' : ''}`}
                      </span>
                    </span>
                    <span className="sale-time">
                      {sale.sale_time?.slice(0, 5)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .page-header {
          margin-bottom: 1.5rem;
        }

        .page-subtitle {
          color: var(--color-text-secondary);
          font-size: 0.9375rem;
          margin-top: 0.25rem;
        }

        .stat-card {
          background: var(--color-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 1.25rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          box-shadow: var(--shadow-sm);
          animation: fadeIn 0.3s ease-out forwards;
          opacity: 0;
          transition: box-shadow 0.2s, transform 0.2s;
        }

        .stat-card:hover {
          box-shadow: var(--shadow-md);
          transform: translateY(-2px);
        }

        .stat-icon {
          width: 48px;
          height: 48px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .stat-info {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          line-height: 1.1;
        }

        .stat-label {
          font-size: 0.8125rem;
          font-weight: 500;
          color: var(--color-text-secondary);
        }

        .stat-sub {
          font-size: 0.75rem;
          color: var(--color-text-muted);
        }

        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid var(--color-border);
        }

        .stock-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .stock-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.625rem 0.75rem;
          border-radius: var(--radius-sm);
          background: var(--color-bg);
          animation: fadeIn 0.3s ease-out forwards;
          opacity: 0;
          transition: background 0.2s;
        }

        .stock-item:hover {
          background: var(--color-primary-light);
        }

        .stock-name {
          font-weight: 500;
          font-size: 0.9375rem;
        }

        .stock-right {
          display: flex;
          align-items: center;
          gap: 0.625rem;
        }

        .stock-qty {
          font-weight: 600;
          font-size: 0.9375rem;
          font-variant-numeric: tabular-nums;
        }

        .sale-unit {
          font-weight: 400;
          font-size: 0.8125rem;
          color: var(--color-text-muted);
        }

        .sale-time {
          font-size: 0.8125rem;
          color: var(--color-text-muted);
          font-variant-numeric: tabular-nums;
        }

        .stock-breakdown {
          font-size: 0.9375rem;
          color: var(--color-text);
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          padding: 2rem;
          color: var(--color-text-muted);
          text-align: center;
        }

        .error-banner {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 1rem;
          background: var(--color-danger-bg);
          border: 1px solid var(--color-danger);
          border-radius: var(--radius-md);
          margin-bottom: 1.5rem;
          color: var(--color-danger);
          align-items: center;
        }

        .error-banner {
          background: var(--color-danger-bg);
          border-color: var(--color-danger);
          color: var(--color-danger);
          align-items: center;
        }

        .error-banner-content {
          flex: 1;
        }

        .error-banner-content p {
          font-size: 0.8125rem;
          margin-top: 0.25rem;
          color: var(--color-text-secondary);
        }

        @media (max-width: 640px) {
          .stat-card {
            padding: 0.875rem;
          }
          .stat-icon {
            width: 40px;
            height: 40px;
          }
          .stat-icon svg {
            width: 18px;
            height: 18px;
          }
          .stat-value {
            font-size: 1.25rem;
          }
        }
      `}</style>
    </div>
  );
}

