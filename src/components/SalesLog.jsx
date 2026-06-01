import { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Plus,
  DollarSign,
  AlertTriangle,
  RefreshCw,
  ClipboardCheck,
} from 'lucide-react';
import { fetchSales, recordSale, fetchInventory, getEggCount, formatPeso, formatInventory } from '../lib/api';
import { toast } from './Toast';
import { getUserFriendlyError } from '../lib/errors';
import ConfirmDialog from './ConfirmDialog';

export default function SalesLog() {
  const [sales, setSales] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  const [filter, setFilter] = useState('today');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);

  const [form, setForm] = useState({
    eggSizeId: '',
    quantity: '',
    unit: 'piece',
    traySize: 30,
  });
  const [confirmSale, setConfirmSale] = useState(null);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, filter]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const offset = 0;
      const limit = filter === 'today' || (startDate && endDate) ? 500 : 100;
      const [salesData, invData] = await Promise.all([
        fetchSales({ limit, offset, startDate, endDate }),
        fetchInventory(),
      ]);
      setSales(salesData || []);
      setInventory(invData || []);
    } catch (err) {
      console.error('Sales load error:', err);
      setError(err);
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

    // Show confirmation dialog instead of submitting directly
    setConfirmSale({
      eggSizeId: parseInt(form.eggSizeId, 10),
      quantity: qty,
      unit: form.unit,
      traySize: form.unit === 'tray' ? parseInt(form.traySize, 10) : null,
    });
  }

  async function executeSale(saleData) {
    setSubmitting(true);
    try {
      await recordSale(saleData);
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

  const filteredSales = sales;

  const periodTotalEggs = filteredSales.reduce((sum, s) => sum + getEggCount(s), 0);
  const periodRevenue = filteredSales.reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0);

  function formatShortDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const todayDate = new Date();
    const yesterday = new Date(todayDate);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateStr === today) return 'Today';
    if (dateStr === yesterday.toISOString().split('T')[0]) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

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

      {/* Period quick stats */}
      <div className="sales-stats">
        <div className="sales-stat-card">
          <ShoppingCart size={18} />
          <div>
            <span className="sales-stat-value">{periodTotalEggs.toLocaleString()}</span>
            <span className="sales-stat-label">
              {filter === 'today' ? 'eggs sold today' : 'eggs in period'}
            </span>
          </div>
        </div>
        <div className="sales-stat-card">
          <DollarSign size={18} />
          <div>
            <span className="sales-stat-value">{formatPeso(periodRevenue)}</span>
            <span className="sales-stat-label">
              {filter === 'today' ? 'revenue today' : 'revenue in period'}
            </span>
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
                  id="sale-egg-size"
                  name="eggSizeId"
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
                  id="sale-quantity"
                  name="quantity"
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
              {submitting ? 'Recording...' : 'Review & Record'}
            </button>
          </form>
        </div>
      )}

      {error && !loading && (
        <div className="error-banner" style={{ marginBottom: '1rem' }}>
          <AlertTriangle size={20} />
          <div className="error-banner-content">
            <strong>Failed to load sales data</strong>
            <p>{getUserFriendlyError(error)}</p>
          </div>
          <button className="btn btn-sm btn-secondary" onClick={loadData}>
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      )}

      {/* Date range & Filter controls */}
      <div className="filter-bar">
        <div className="filter-tabs">
          <button
            className={`filter-tab ${filter === 'today' ? 'active' : ''}`}
            onClick={() => { setFilter('today'); setStartDate(today); setEndDate(today); }}
          >
            Today
          </button>
          <button
            className={`filter-tab ${filter === 'week' ? 'active' : ''}`}
            onClick={() => {
              setFilter('week');
              const d = new Date();
              d.setDate(d.getDate() - 7);
              setStartDate(d.toISOString().split('T')[0]);
              setEndDate(today);
            }}
          >
            This Week
          </button>
          <button
            className={`filter-tab ${filter === 'custom' ? 'active' : ''}`}
            onClick={() => setFilter('custom')}
          >
            Custom Range
          </button>
        </div>
        {filter === 'custom' && (
          <div className="filter-date-inputs">
            <input
              id="sale-filter-start"
              name="startDate"
              type="date"
              className="input input-sm"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
            <span>→</span>
            <input
              id="sale-filter-end"
              name="endDate"
              type="date"
              className="input input-sm"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Sales list */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="sales-table-header">
          <span>Size</span>
          <span>Qty</span>
          <span>Eggs</span>
          <span>Amount</span>
          <span>When</span>
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
              <span className="sale-eggs">{formatInventory(getEggCount(sale))}</span>
              <span className="sale-amount">{formatPeso(sale.total_amount)}</span>
              <span className="sale-when">
                <span className="sale-when-date">{formatShortDate(sale.sale_date)}</span>
                <span className="sale-when-time">{sale.sale_time?.slice(0, 5)}</span>
              </span>
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={!!confirmSale}
        title="Record this sale?"
        message={confirmSale ? (() => {
          const sizeName = inventory.find(i => i.egg_size_id === confirmSale.eggSizeId)?.egg_sizes?.name || 'Unknown';
          const qtyLabel = confirmSale.unit === 'tray'
            ? `${confirmSale.quantity} tray${confirmSale.quantity > 1 ? 's' : ''} (${confirmSale.quantity * confirmSale.traySize} eggs)`
            : `${confirmSale.quantity} egg${confirmSale.quantity > 1 ? 's' : ''}`;
          return `Record sale of ${qtyLabel} of ${sizeName}? This will deduct the stock automatically.`;
        })() : ''}
        confirmLabel="Record Sale"
        variant="primary"
        icon={ClipboardCheck}
        onConfirm={() => {
          const data = confirmSale;
          setConfirmSale(null);
          executeSale(data);
        }}
        onCancel={() => setConfirmSale(null)}
      />

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

        .filter-bar {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1rem;
          flex-wrap: wrap;
        }

        .filter-date-inputs {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .input-sm {
          width: auto;
          min-width: 140px;
          padding: 0.4rem 0.625rem;
          font-size: 0.8125rem;
        }

        .sales-table-header {
          display: grid;
          grid-template-columns: 1fr 80px 100px 1fr 70px;
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
          grid-template-columns: 1fr 80px 100px 1fr 70px;
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

        .sale-eggs {
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
          font-variant-numeric: tabular-nums;
        }

        .sale-amount {
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          color: var(--color-primary);
        }

        .sale-when {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.1rem;
          line-height: 1.2;
        }

        .sale-when-date {
          font-size: 0.8125rem;
          font-weight: 500;
          color: var(--color-text-secondary);
        }

        .sale-when-time {
          font-size: 0.75rem;
          color: var(--color-text-muted);
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

        /* Mobile: compact card-style rows */
        @media (max-width: 640px) {
          .sales-table-header {
            display: none;
          }
          .sales-row {
            grid-template-columns: 1fr auto;
            gap: 0.1rem 0.625rem;
            padding: 0.625rem 0.75rem;
          }
          .sale-size {
            grid-column: 1;
            grid-row: 1;
            font-weight: 600;
            font-size: 0.9375rem;
          }
          .sale-amount {
            grid-column: 2;
            grid-row: 1;
            text-align: right;
            align-self: center;
            font-size: 0.9375rem;
          }
          .sale-qty {
            grid-column: 1;
            grid-row: 2;
            font-size: 0.8125rem;
            color: var(--color-text-secondary);
          }
          .sale-eggs {
            grid-column: 2;
            grid-row: 2;
            text-align: right;
            font-size: 0.75rem;
            color: var(--color-text-muted);
            align-self: center;
          }
          .sale-when {
            grid-column: 1 / -1;
            grid-row: 3;
            flex-direction: row;
            gap: 0.375rem;
            align-items: center;
          }
          .sale-when-date {
            font-size: 0.6875rem;
            color: var(--color-text-muted);
          }
          .sale-when-time {
            font-size: 0.6875rem;
            color: var(--color-text-muted);
          }
          .filter-bar {
            flex-direction: column;
            align-items: stretch;
          }
          .filter-date-inputs {
            flex-wrap: wrap;
          }
          .filter-date-inputs .input-sm {
            min-width: 120px;
            flex: 1;
          }
        }
      `}</style>
    </div>
  );
}
