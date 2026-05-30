import { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Plus,
  Clock,
  Calendar,
  ChevronDown,
  Filter,
} from 'lucide-react';
import { fetchSales, recordSale, fetchInventory, getEggCount, EGG_SIZES } from '../lib/api';
import { toast } from './Toast';

export default function SalesLog() {
  const [sales, setSales] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState('all');

  const [form, setForm] = useState({
    eggSizeId: '',
    quantity: '',
    unit: 'piece',
    traySize: 30,
  });

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [salesData, invData] = await Promise.all([
        fetchSales({ limit: 100 }),
        fetchInventory(),
      ]);
      setSales(salesData || []);
      setInventory(invData || []);
    } catch (err) {
      console.error('Sales load error:', err);
      toast('Failed to load sales data', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.eggSizeId || !form.quantity) {
      toast('Please fill in all fields', 'error');
      return;
    }
    const qty = parseInt(form.quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      toast('Please enter a valid quantity', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const sale = await recordSale({
        eggSizeId: parseInt(form.eggSizeId, 10),
        quantity: qty,
        unit: form.unit,
        traySize: form.unit === 'tray' ? parseInt(form.traySize, 10) : null,
      });
      toast('Sale recorded successfully!');
      setForm({ eggSizeId: '', quantity: '', unit: 'piece', traySize: 30 });
      setShowForm(false);
      loadData();
    } catch (err) {
      console.error('Sale record error:', err);
      toast('Failed to record sale', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const filteredSales =
    filter === 'today'
      ? sales.filter(s => s.sale_date === today)
      : filter === 'recent'
      ? sales.slice(0, 20)
      : sales;

  const todayTotal = sales
    .filter(s => s.sale_date === today)
    .reduce((sum, s) => sum + getEggCount(s), 0);

  return (
    <div className="fade-in">
      <div className="page-header-row">
        <div>
          <h1>Sales Log</h1>
          <p className="page-subtitle">
            Record and view your egg sales
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus size={18} />
          {showForm ? 'Cancel' : 'New Sale'}
        </button>
      </div>

      {/* Today's quick stats */}
      <div className="sales-stats">
        <div className="sales-stat-card">
          <ShoppingCart size={18} />
          <div>
            <span className="sales-stat-value">{todayTotal.toLocaleString()}</span>
            <span className="sales-stat-label">eggs sold today</span>
          </div>
        </div>
        <div className="sales-stat-card">
          <Calendar size={18} />
          <div>
            <span className="sales-stat-value">{new Date().toLocaleDateString('en-US', { weekday: 'long' })}</span>
            <span className="sales-stat-label">{today}</span>
          </div>
        </div>
      </div>

      {/* Sale form */}
      {showForm && (
        <div className="card sale-form-card">
          <h3 style={{ marginBottom: '1rem' }}>Record New Sale</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="input-group">
                <label>Egg Size</label>
                <select
                  className="select"
                  value={form.eggSizeId}
                  onChange={e =>
                    setForm({ ...form, eggSizeId: e.target.value })
                  }
                  required
                >
                  <option value="">Select size...</option>
                  {inventory
                    .sort(
                      (a, b) =>
                        (a.egg_sizes?.sort_order || 0) -
                        (b.egg_sizes?.sort_order || 0)
                    )
                    .map(item => (
                      <option key={item.egg_size_id} value={item.egg_size_id}>
                        {item.egg_sizes?.name} (Stock: {item.quantity_on_hand})
                      </option>
                    ))}
                </select>
              </div>

              <div className="input-group">
                <label>Unit</label>
                <div className="toggle-group">
                  <button
                    type="button"
                    className={`toggle-btn ${form.unit === 'piece' ? 'active' : ''}`}
                    onClick={() => setForm({ ...form, unit: 'piece' })}
                  >
                    By Piece
                  </button>
                  <button
                    type="button"
                    className={`toggle-btn ${form.unit === 'tray' ? 'active' : ''}`}
                    onClick={() => setForm({ ...form, unit: 'tray' })}
                  >
                    By Tray
                  </button>
                </div>
              </div>

              <div className="input-group">
                <label>Quantity</label>
                <input
                  type="number"
                  className="input"
                  min="1"
                  placeholder={form.unit === 'tray' ? 'Number of trays' : 'Number of eggs'}
                  value={form.quantity}
                  onChange={e => setForm({ ...form, quantity: e.target.value })}
                  required
                />
              </div>

              {form.unit === 'tray' && (
                <div className="input-group">
                  <label>Eggs per Tray</label>
                  <div className="toggle-group">
                    <button
                      type="button"
                      className={`toggle-btn ${form.traySize === 12 ? 'active' : ''}`}
                      onClick={() => setForm({ ...form, traySize: 12 })}
                    >
                      12 eggs
                    </button>
                    <button
                      type="button"
                      className={`toggle-btn ${form.traySize === 30 ? 'active' : ''}`}
                      onClick={() => setForm({ ...form, traySize: 30 })}
                    >
                      30 eggs
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block"
              style={{ marginTop: '1rem' }}
              disabled={submitting}
            >
              {submitting ? 'Recording...' : 'Record Sale'}
            </button>
          </form>
        </div>
      )}

      {/* Filter tabs */}
      <div className="filter-tabs">
        <button
          className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All Sales
        </button>
        <button
          className={`filter-tab ${filter === 'today' ? 'active' : ''}`}
          onClick={() => setFilter('today')}
        >
          Today
        </button>
        <button
          className={`filter-tab ${filter === 'recent' ? 'active' : ''}`}
          onClick={() => setFilter('recent')}
        >
          Recent 20
        </button>
      </div>

      {/* Sales list */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="sales-table-header">
          <span>Size</span>
          <span>Qty</span>
          <span>Date</span>
          <span>Time</span>
        </div>
        {loading ? (
          <div className="loading-list">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 44, margin: '0.25rem 1rem', borderRadius: 4 }}>
                &nbsp;
              </div>
            ))}
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="empty-state">
            <ShoppingCart size={36} />
            <p>No sales recorded yet</p>
          </div>
        ) : (
          filteredSales.map((sale, i) => (
            <div
              key={sale.id}
              className="sales-row"
              style={{ animationDelay: `${i * 0.025}s` }}
            >
              <span className="sale-size">
                {sale.egg_sizes?.name || 'Unknown'}
              </span>
              <span className="sale-qty">
                {sale.quantity}{' '}
                <span className="sale-unit-text">
                  {sale.unit === 'tray'
                    ? `tray${sale.quantity > 1 ? 's' : ''}`
                    : `egg${sale.quantity > 1 ? 's' : ''}`}
                </span>
              </span>
              <span className="sale-date-text">{sale.sale_date}</span>
              <span className="sale-time-text">
                <Clock size={12} />
                {sale.sale_time?.slice(0, 5)}
              </span>
            </div>
          ))
        )}
      </div>

      <style>{`
        .page-header-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 1.5rem;
          gap: 1rem;
        }

        .page-subtitle {
          color: var(--color-text-secondary);
          font-size: 0.9375rem;
          margin-top: 0.25rem;
        }

        .sales-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
          margin-bottom: 1.25rem;
        }

        .sales-stat-card {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.875rem 1rem;
          background: var(--color-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-sm);
        }

        .sales-stat-card svg {
          color: var(--color-primary);
          flex-shrink: 0;
        }

        .sales-stat-value {
          display: block;
          font-weight: 700;
          font-size: 1.0625rem;
        }

        .sales-stat-label {
          display: block;
          font-size: 0.75rem;
          color: var(--color-text-muted);
        }

        .sale-form-card {
          margin-bottom: 1.25rem;
          animation: fadeIn 0.3s ease-out;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.875rem;
        }

        @media (min-width: 640px) {
          .form-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        .toggle-group {
          display: flex;
          gap: 0.375rem;
        }

        .toggle-btn {
          flex: 1;
          padding: 0.5rem 0.75rem;
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-sm);
          background: var(--color-card);
          color: var(--color-text-secondary);
          font-size: 0.8125rem;
          font-weight: 500;
          transition: all 0.2s;
          cursor: pointer;
        }

        .toggle-btn:hover {
          border-color: var(--color-primary);
          color: var(--color-primary);
        }

        .toggle-btn.active {
          background: var(--color-primary);
          border-color: var(--color-primary);
          color: white;
        }

        .filter-tabs {
          display: flex;
          gap: 0.375rem;
          margin-bottom: 1rem;
        }

        .filter-tab {
          padding: 0.5rem 1rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          background: var(--color-card);
          color: var(--color-text-secondary);
          font-size: 0.8125rem;
          font-weight: 500;
          transition: all 0.2s;
          cursor: pointer;
        }

        .filter-tab:hover {
          border-color: var(--color-primary);
          color: var(--color-primary);
        }

        .filter-tab.active {
          background: var(--color-primary);
          border-color: var(--color-primary);
          color: white;
        }

        .sales-table-header {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr 1fr;
          padding: 0.625rem 1rem;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-muted);
          background: var(--color-bg);
          border-bottom: 1px solid var(--color-border);
        }

        .sales-row {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr 1fr;
          align-items: center;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--color-border);
          animation: fadeIn 0.3s ease-out forwards;
          opacity: 0;
          transition: background 0.2s;
          font-size: 0.9375rem;
        }

        .sales-row:last-child {
          border-bottom: none;
        }

        .sales-row:hover {
          background: var(--color-bg);
        }

        .sale-size {
          font-weight: 500;
        }

        .sale-qty {
          font-weight: 600;
        }

        .sale-unit-text {
          font-weight: 400;
          font-size: 0.8125rem;
          color: var(--color-text-muted);
        }

        .sale-date-text {
          color: var(--color-text-secondary);
          font-size: 0.875rem;
        }

        .sale-time-text {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          color: var(--color-text-muted);
          font-size: 0.875rem;
          font-variant-numeric: tabular-nums;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          padding: 2.5rem;
          color: var(--color-text-muted);
          text-align: center;
        }
      `}</style>
    </div>
  );
}
