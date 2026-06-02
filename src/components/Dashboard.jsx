import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  ShoppingCart,
  AlertTriangle,
  ArrowRight,
  DollarSign,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Clock,
  Truck,
} from 'lucide-react';
import { fetchInventory, fetchTodaySales, fetchTodayExpenses, fetchInventoryValue, fetchDeliveries, getEggCount, formatInventory, formatPeso, getLocalDate } from '../lib/api';
import { getUserFriendlyError } from '../lib/errors';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getGreetingEmoji() {
  const hour = new Date().getHours();
  if (hour < 12) return '🌅';
  if (hour < 17) return '☀️';
  return '🌙';
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [inventory, setInventory] = useState([]);
  const [todaySales, setTodaySales] = useState([]);
  const [todayExpenses, setTodayExpenses] = useState([]);
  const [inventoryValue, setInventoryValue] = useState(0);
  const [todayDeliveries, setTodayDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const today = getLocalDate();
      const [inv, sales, expenses, invValue, deliveries] = await Promise.all([
        fetchInventory(),
        fetchTodaySales(),
        fetchTodayExpenses(),
        fetchInventoryValue(),
        fetchDeliveries({ startDate: today, endDate: today }),
      ]);
      setInventory(inv || []);
      setTodaySales(sales || []);
      setTodayExpenses(expenses || []);
      setInventoryValue(invValue);
      setTodayDeliveries(deliveries || []);
    } catch (err) {
      console.error('Dashboard load error:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => loadData());
  }, []);

  const todayDeliveryCount = todayDeliveries.length;
  const todayDeliveryCost = todayDeliveries.reduce(
    (sum, d) => sum + parseFloat(d.total_cost || 0), 0
  );

  const totalEggsSoldToday = todaySales.reduce(
    (sum, s) => sum + getEggCount(s), 0
  );

  const todayRevenue = todaySales.reduce(
    (sum, s) => sum + parseFloat(s.total_amount || 0), 0
  );

  const todayExpenseTotal = todayExpenses.reduce(
    (sum, e) => sum + parseFloat(e.amount || 0), 0
  );

  const netProfit = todayRevenue - todayExpenseTotal;

  const totalStock = inventory.reduce(
    (sum, item) => sum + (item.quantity_on_hand || 0), 0
  );

  const lowStockItems = inventory.filter(
    item => item.quantity_on_hand <= 50 && item.quantity_on_hand > 0
  );

  const outOfStockItems = inventory.filter(
    item => item.quantity_on_hand === 0
  );

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="dashboard fade-in">
      {/* Welcome Header */}
      <div className="welcome-section">
        <div className="welcome-text">
          <h1 className="welcome-title">{getGreeting()} {getGreetingEmoji()}</h1>
          <p className="welcome-date">{dateStr}</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadData}>
          <RefreshCw size={15} />
          Refresh
        </button>
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

      {/* Primary Stats */}
      <div className="primary-stats">
        <div className="primary-stat primary-stat-revenue">
          <div className="primary-stat-icon">
            <DollarSign size={20} />
          </div>
          <div className="primary-stat-info">
            <span className="primary-stat-label">Today's Revenue</span>
            <span className="primary-stat-value">{loading ? <span className="skeleton" style={{ display: 'inline-block', width: 80, height: 28 }}>&nbsp;</span> : formatPeso(todayRevenue)}</span>
          </div>
        </div>
        <div className="primary-stat primary-stat-profit" data-positive={netProfit >= 0}>
          <div className="primary-stat-icon">
            {netProfit >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          </div>
          <div className="primary-stat-info">
            <span className="primary-stat-label">Net Profit</span>
            <span className="primary-stat-value">{loading ? <span className="skeleton" style={{ display: 'inline-block', width: 80, height: 28 }}>&nbsp;</span> : formatPeso(netProfit)}</span>
          </div>
        </div>
      </div>

      {/* Secondary Stats Grid */}
      <div className="stat-cards-grid">
        <div className="stat-card-item">
          <div className="stat-card-icon" style={{ background: '#E3F2FD', color: '#1565C0' }}>
            <Package size={18} />
          </div>
          <div className="stat-card-content">
            <span className="stat-card-value">
              {loading ? <span className="skeleton" style={{ display: 'inline-block', width: 50, height: 24 }}>&nbsp;</span> : totalStock.toLocaleString()}
            </span>
            <span className="stat-card-label">Total Stock</span>
          </div>
        </div>

        <div className="stat-card-item">
          <div className="stat-card-icon" style={{ background: '#E8F5E9', color: '#2E7D32' }}>
            <DollarSign size={18} />
          </div>
          <div className="stat-card-content">
            <span className="stat-card-value">
              {loading ? '—' : formatPeso(inventoryValue)}
            </span>
            <span className="stat-card-label">Stock Value</span>
          </div>
        </div>

        <div className="stat-card-item">
          <div className="stat-card-icon" style={{ background: '#F3E5F5', color: '#7B1FA2' }}>
            <ShoppingCart size={18} />
          </div>
          <div className="stat-card-content">
            <span className="stat-card-value">
              {loading ? '—' : totalEggsSoldToday.toLocaleString()}
            </span>
            <span className="stat-card-label">Eggs Sold</span>
          </div>
        </div>

        <div className="stat-card-item">
          <div className="stat-card-icon" style={{ background: todayExpenseTotal > 0 ? '#FFEBEE' : '#E8F5E9', color: todayExpenseTotal > 0 ? '#C62828' : '#2E7D32' }}>
            <TrendingDown size={18} />
          </div>
          <div className="stat-card-content">
            <span className="stat-card-value">
              {loading ? '—' : formatPeso(todayExpenseTotal)}
            </span>
            <span className="stat-card-label">Expenses</span>
          </div>
        </div>

        <div className="stat-card-item">
          <div className="stat-card-icon" style={{ background: '#E0F2F1', color: '#00695C' }}>
            <Truck size={18} />
          </div>
          <div className="stat-card-content">
            <span className="stat-card-value">
              {loading ? '—' : todayDeliveryCount}
            </span>
            <span className="stat-card-label">Deliveries</span>
          </div>
        </div>

        <div className="stat-card-item">
          <div className="stat-card-icon" style={{ background: '#FFF3E0', color: '#E65100' }}>
            <Truck size={18} />
          </div>
          <div className="stat-card-content">
            <span className="stat-card-value">
              {loading ? '—' : formatPeso(todayDeliveryCost)}
            </span>
            <span className="stat-card-label">Delivery Cost</span>
          </div>
        </div>
      </div>

      {/* Low Stock Alert */}
      {(lowStockItems.length > 0 || outOfStockItems.length > 0) && (
        <div className="alert-card">
          <div className="alert-icon">
            <AlertTriangle size={18} />
          </div>
          <div className="alert-content">
            <span className="alert-title">
              {outOfStockItems.length > 0
                ? `${outOfStockItems.length} size${outOfStockItems.length > 1 ? 's' : ''} out of stock`
                : `${lowStockItems.length} size${lowStockItems.length > 1 ? 's' : ''} running low`
              }
            </span>
            <span className="alert-subtitle">
              {outOfStockItems.length > 0 && lowStockItems.length > 0
                ? `Also ${lowStockItems.length} size${lowStockItems.length > 1 ? 's' : ''} low on stock`
                : outOfStockItems.length > 0
                  ? 'Restock immediately'
                  : 'Consider restocking soon'
              }
            </span>
          </div>
          <button className="btn btn-sm btn-secondary" onClick={() => navigate('/inventory')}>
            Manage
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Content Grid */}
      <div className="grid-2">
        {/* Stock Levels */}
        <div className="card">
          <div className="card-header">
            <h2>Stock Levels</h2>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigate('/inventory')}
            >
              Manage <ArrowRight size={14} />
            </button>
          </div>
          <div className="stock-list">
            {loading
              ? Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="stock-item">
                    <span className="skeleton" style={{ width: 80, height: 18 }}>&nbsp;</span>
                    <span className="skeleton" style={{ width: 60, height: 18 }}>&nbsp;</span>
                  </div>
                ))
              : inventory.map((item, i) => {
                  const qty = item.quantity_on_hand || 0;
                  let statusClass = 'badge-success';
                  let label = 'In Stock';
                  if (qty === 0) {
                    statusClass = 'badge-danger';
                    label = 'Out';
                  } else if (qty <= 50) {
                    statusClass = 'badge-warning';
                    label = 'Low';
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
                        <span className={`badge ${statusClass}`}>{label}</span>
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
              View All <ArrowRight size={14} />
            </button>
          </div>
          {loading ? (
            <div className="stock-list">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="stock-item">
                  <span className="skeleton" style={{ width: 70, height: 18 }}>&nbsp;</span>
                  <span className="skeleton" style={{ width: 50, height: 18 }}>&nbsp;</span>
                </div>
              ))}
            </div>              ) : todaySales.length === 0 ? (
            <div className="empty-state">
              <ShoppingCart size={32} />
              <p>No sales recorded today</p>
              <button
                className="btn btn-primary btn-sm"
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
                  <div className="sale-info">
                    <span className="stock-name">
                      {sale.egg_sizes?.name || 'Unknown'}
                    </span>
                    <span className="sale-qty-detail">
                      {sale.quantity}{' '}
                      {sale.unit === 'tray'
                        ? `tray${sale.quantity > 1 ? 's' : ''}`
                        : `egg${sale.quantity > 1 ? 's' : ''}`}
                    </span>
                  </div>
                  <div className="stock-right">
                    <span className="sale-amount-small">
                      {formatPeso(sale.total_amount)}
                    </span>
                    <span className="sale-time">
                      <Clock size={11} />
                      {sale.sale_time?.slice(0, 5)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Today's Deliveries */}
        <div className="card">
          <div className="card-header">
            <h2>Today's Deliveries</h2>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigate('/deliveries')}
            >
              View All <ArrowRight size={14} />
            </button>
          </div>
          {loading ? (
            <div className="stock-list">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="stock-item">
                  <span className="skeleton" style={{ width: 70, height: 18 }}>&nbsp;</span>
                  <span className="skeleton" style={{ width: 50, height: 18 }}>&nbsp;</span>
                </div>
              ))}
            </div>
          ) : todayDeliveries.length === 0 ? (
            <div className="empty-state">
              <Truck size={32} />
              <p>No deliveries today</p>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => navigate('/deliveries')}
              >
                Record a Delivery
              </button>
            </div>
          ) : (
            <div className="stock-list">
              {todayDeliveries.slice(0, 10).map((delivery, i) => (
                <div
                  key={delivery.id}
                  className="stock-item"
                  style={{ animationDelay: `${i * 0.03}s` }}
                >
                  <div className="sale-info">
                    <span className="stock-name">
                      {delivery.egg_sizes?.name || 'Unknown'}
                    </span>
                    <span className="sale-qty-detail">
                      {delivery.suppliers?.name || 'Unknown'}
                      {' · '}{delivery.quantity}{' '}
                      {delivery.unit === 'tray'
                        ? `tray${delivery.quantity > 1 ? 's' : ''}`
                        : `egg${delivery.quantity > 1 ? 's' : ''}`}
                    </span>
                  </div>
                  <div className="stock-right">
                    <span className="delivery-cost-small">
                      {formatPeso(delivery.total_cost)}
                    </span>
                    <span className="sale-time">
                      <span className="delivery-payment-status" style={{
                        display: 'inline-block',
                        padding: '0.1rem 0.35rem',
                        borderRadius: 999,
                        fontSize: '0.6rem',
                        fontWeight: 600,
                        background: delivery.payment_status === 'paid' ? '#E8F5E9' : delivery.payment_status === 'partial' ? '#FFF8E1' : '#FFF3E0',
                        color: delivery.payment_status === 'paid' ? '#2E7D32' : delivery.payment_status === 'partial' ? '#F57F17' : '#E65100',
                      }}>{delivery.payment_status}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .dashboard {
          max-width: 100%;
        }

        .welcome-section {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: var(--space-xl);
          gap: var(--space-lg);
        }

        .welcome-title {
          font-size: 1.625rem;
          font-weight: var(--font-weight-bold);
          letter-spacing: -0.02em;
          margin-bottom: 0.125rem;
        }

        .welcome-date {
          color: var(--color-text-muted);
          font-size: 0.9375rem;
        }

        /* Primary Stats */
        .primary-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
          margin-bottom: var(--space-lg);
        }

        .primary-stat {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1.125rem 1.25rem;
          background: var(--color-card);
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
          transition: all var(--transition-base);
          animation: fadeIn 0.35s ease-out forwards;
        }

        .primary-stat:hover {
          box-shadow: var(--shadow-md);
          transform: translateY(-1px);
        }

        .primary-stat-icon {
          width: 44px;
          height: 44px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .primary-stat-revenue .primary-stat-icon {
          background: var(--color-success-bg);
          color: var(--color-success);
        }

        .primary-stat-profit[data-positive="true"] .primary-stat-icon {
          background: var(--color-success-bg);
          color: var(--color-success);
        }

        .primary-stat-profit[data-positive="false"] .primary-stat-icon {
          background: var(--color-danger-bg);
          color: var(--color-danger);
        }

        .primary-stat-info {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
          min-width: 0;
        }

        .primary-stat-label {
          font-size: 0.75rem;
          font-weight: var(--font-weight-medium);
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .primary-stat-value {
          font-size: 1.5rem;
          font-weight: var(--font-weight-bold);
          line-height: 1.2;
          letter-spacing: -0.02em;
          font-variant-numeric: tabular-nums;
        }

        .primary-stat-profit[data-positive="false"] .primary-stat-value {
          color: var(--color-danger);
        }

        /* Secondary Stats Grid */
        .stat-cards-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.75rem;
          margin-bottom: var(--space-xl);
        }

        .stat-card-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.875rem 1rem;
          background: var(--color-card);
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-xs);
          transition: all var(--transition-base);
        }

        .stat-card-item:hover {
          box-shadow: var(--shadow-sm);
        }

        .stat-card-icon {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .stat-card-content {
          display: flex;
          flex-direction: column;
          gap: 0.0625rem;
          min-width: 0;
        }

        .stat-card-value {
          font-size: 1.125rem;
          font-weight: var(--font-weight-bold);
          line-height: 1.2;
          font-variant-numeric: tabular-nums;
        }

        .stat-card-label {
          font-size: 0.6875rem;
          font-weight: var(--font-weight-medium);
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        /* Alert Card */
        .alert-card {
          display: flex;
          align-items: center;
          gap: 0.875rem;
          padding: 0.875rem 1.125rem;
          background: var(--color-warning-bg);
          border: 1px solid var(--color-warning);
          border-radius: var(--radius-md);
          margin-bottom: var(--space-xl);
        }

        .alert-icon {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(230, 81, 0, 0.15);
          color: var(--color-warning);
          flex-shrink: 0;
        }

        .alert-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.0625rem;
        }

        .alert-title {
          font-weight: var(--font-weight-semibold);
          font-size: 0.875rem;
          color: var(--color-warning);
        }

        .alert-subtitle {
          font-size: 0.75rem;
          color: var(--color-text-secondary);
        }

        /* Stock List */
        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid var(--color-border-light);
        }

        .card-header h2 {
          font-size: 1rem;
        }

        .stock-list {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .stock-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem 0.75rem;
          border-radius: var(--radius-sm);
          background: var(--color-bg-subtle);
          animation: fadeIn 0.3s ease-out forwards;
          opacity: 0;
          transition: background var(--transition-fast);
        }

        .stock-item:hover {
          background: var(--color-primary-50);
        }

        .stock-name {
          font-weight: var(--font-weight-medium);
          font-size: 0.9375rem;
        }

        .stock-right {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .stock-breakdown {
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
          font-weight: var(--font-weight-semibold);
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }

        .sale-info {
          display: flex;
          flex-direction: column;
          gap: 0.0625rem;
        }

        .sale-qty-detail {
          font-size: 0.75rem;
          color: var(--color-text-muted);
        }

        .sale-amount-small {
          font-weight: var(--font-weight-semibold);
          font-size: 0.875rem;
          color: var(--color-success);
          font-variant-numeric: tabular-nums;
        }

        .sale-time {
          display: flex;
          align-items: center;
          gap: 0.2rem;
          font-size: 0.6875rem;
          color: var(--color-text-muted);
          font-variant-numeric: tabular-nums;
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

        @media (max-width: 640px) {
          .primary-stats {
            grid-template-columns: 1fr;
          }

          .primary-stat-value {
            font-size: 1.25rem;
          }

          .stat-cards-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 0.5rem;
          }

          .stat-card-item {
            padding: 0.75rem;
          }

          .stat-card-icon {
            width: 32px;
            height: 32px;
          }

          .stat-card-icon svg {
            width: 16px;
            height: 16px;
          }

          .stat-card-value {
            font-size: 0.9375rem;
          }

          .alert-card {
            flex-wrap: wrap;
          }

          .welcome-title {
            font-size: 1.35rem;
          }
        }
      `}</style>
    </div>
  );
}
