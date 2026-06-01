import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Plus,
  RefreshCw,
  Egg,
  Calendar,
  DollarSign,
} from 'lucide-react';
import { fetchSpoilageWithCost, recordSpoilage, fetchInventory, SPOILAGE_REASONS, formatPeso } from '../lib/api';
import { toast } from './Toast';
import { getUserFriendlyError } from '../lib/errors';
import ConfirmDialog from './ConfirmDialog';

export default function Spoilage() {
  const [spoilage, setSpoilage] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    eggSizeId: '',
    quantity: '',
    reason: 'Cracked',
    date: today,
  });
  const [confirmItem, setConfirmItem] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const [spoilageData, invData] = await Promise.all([
        fetchSpoilageWithCost({ limit: 200 }),
        fetchInventory(),
      ]);
      setSpoilage(spoilageData || []);
      setInventory(invData || []);
    } catch (err) {
      console.error('Spoilage load error:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.eggSizeId || !form.quantity) {
      toast('Please select egg size and enter quantity', 'error');
      return;
    }
    const qty = parseInt(form.quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      toast('Please enter a valid quantity', 'error');
      return;
    }
    setConfirmItem({ ...form, quantity: qty });
  }

  async function executeSpoilage(data) {
    setSubmitting(true);
    try {
      await recordSpoilage({
        eggSizeId: parseInt(data.eggSizeId, 10),
        quantity: data.quantity,
        reason: data.reason,
        spoilageDate: data.date,
      });
      toast('Spoilage recorded!');
      setForm({ eggSizeId: '', quantity: '', reason: 'Cracked', date: today });
      setShowForm(false);
      loadData();
    } catch (err) {
      console.error('Spoilage record error:', err);
      toast('Failed to record spoilage', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const totalSpoiled = spoilage.reduce((sum, s) => sum + s.quantity, 0);
  const todaySpoiled = spoilage
    .filter(s => s.spoilage_date === today)
    .reduce((sum, s) => sum + s.quantity, 0);

  const totalSpoilageCost = spoilage.reduce((sum, s) => sum + parseFloat(s.cost || 0), 0);
  const todaySpoilageCost = spoilage
    .filter(s => s.spoilage_date === today)
    .reduce((sum, s) => sum + parseFloat(s.cost || 0), 0);

  const reasonBreakdown = {};
  spoilage.forEach(s => {
    if (!reasonBreakdown[s.reason]) {
      reasonBreakdown[s.reason] = { eggs: 0, cost: 0 };
    }
    reasonBreakdown[s.reason].eggs += s.quantity;
    reasonBreakdown[s.reason].cost += parseFloat(s.cost || 0);
  });

  function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    if (dateStr === today) return 'Today';
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (dateStr === yesterday.toISOString().split('T')[0]) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return (
    <div className="fade-in">
      <div className="page-header-row">
        <div>
          <h1>Spoilage</h1>
          <p className="page-subtitle">Track cracked, broken, or expired eggs</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus size={18} />
          {showForm ? 'Cancel' : 'Record Spoilage'}
        </button>
      </div>

      {/* Stats */}
      <div className="spoilage-stats">
        <div className="spoilage-stat-card spoilage-stat-total">
          <Egg size={18} />
          <div>
            <span className="spoilage-stat-value">{totalSpoiled.toLocaleString()}</span>
            <span className="spoilage-stat-label">total eggs spoiled</span>
          </div>
        </div>
        <div className="spoilage-stat-card spoilage-stat-today">
          <Calendar size={18} />
          <div>
            <span className="spoilage-stat-value">{todaySpoiled.toLocaleString()}</span>
            <span className="spoilage-stat-label">spoiled today</span>
          </div>
        </div>
        <div className="spoilage-stat-card spoilage-stat-cost">
          <DollarSign size={18} />
          <div>
            <span className="spoilage-stat-value">{formatPeso(totalSpoilageCost)}</span>
            <span className="spoilage-stat-label">total cost lost</span>
          </div>
        </div>
        <div className="spoilage-stat-card spoilage-stat-cost-today">
          <DollarSign size={18} />
          <div>
            <span className="spoilage-stat-value">{formatPeso(todaySpoilageCost)}</span>
            <span className="spoilage-stat-label">cost lost today</span>
          </div>
        </div>
      </div>

      {/* Reason breakdown */}
      {Object.keys(reasonBreakdown).length > 0 && (
        <div className="spoilage-breakdown">
          {Object.entries(reasonBreakdown)
            .sort((a, b) => b[1].eggs - a[1].eggs)
            .map(([reason, data]) => (
              <div key={reason} className="spoilage-breakdown-item">
                <span className="spoilage-breakdown-reason">{reason}</span>
                <span className="spoilage-breakdown-qty">{data.eggs.toLocaleString()} eggs</span>
                <span className="spoilage-breakdown-cost">({formatPeso(data.cost)})</span>
              </div>
            ))}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="card spoilage-form-card">
          <h3 style={{ marginBottom: '1rem' }}>Record Egg Spoilage</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="input-group">
                <label>Egg Size</label>
                <select
                  id="spoilage-egg-size"
                  name="eggSizeId"
                  className="select"
                  value={form.eggSizeId}
                  onChange={e => setForm({ ...form, eggSizeId: e.target.value })}
                  required
                >
                  <option value="">Select size...</option>
                  {inventory
                    .sort((a, b) => (a.egg_sizes?.sort_order || 0) - (b.egg_sizes?.sort_order || 0))
                    .map(item => (
                      <option key={item.egg_size_id} value={item.egg_size_id}>
                        {item.egg_sizes?.name} (Stock: {item.quantity_on_hand})
                      </option>
                    ))}
                </select>
              </div>
              <div className="input-group">
                <label>Quantity</label>
                <input
                  id="spoilage-quantity"
                  name="quantity"
                  type="number"
                  className="input"
                  min="1"
                  placeholder="Number of eggs"
                  value={form.quantity}
                  onChange={e => setForm({ ...form, quantity: e.target.value })}
                  required
                />
              </div>
              <div className="input-group">
                <label>Reason</label>
                <select
                  id="spoilage-reason"
                  name="reason"
                  className="select"
                  value={form.reason}
                  onChange={e => setForm({ ...form, reason: e.target.value })}
                >
                  {SPOILAGE_REASONS.map(reason => (
                    <option key={reason} value={reason}>{reason}</option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label>Date</label>
                <input
                  id="spoilage-date"
                  name="date"
                  type="date"
                  className="input"
                  value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })}
                />
              </div>
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
            <strong>Failed to load spoilage data</strong>
            <p>{getUserFriendlyError(error)}</p>
          </div>
          <button className="btn btn-sm btn-secondary" onClick={loadData}>
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      )}

      {/* Spoilage list */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="spoilage-table-header">
          <span>Date</span>
          <span>Size</span>
          <span>Qty</span>
          <span>Reason</span>
        </div>
        {loading ? (
          <div className="loading-list">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 44, margin: '0.25rem 1rem', borderRadius: 4 }}>
                &nbsp;
              </div>
            ))}
          </div>
        ) : spoilage.length === 0 ? (
          <div className="empty-state">
            <Egg size={36} />
            <p>No spoilage recorded yet</p>
          </div>
        ) : (
          spoilage.map((entry, i) => (
            <div
              key={entry.id}
              className="spoilage-row"
              style={{ animationDelay: `${i * 0.025}s` }}
            >
              <span className="spoilage-date">{formatDate(entry.spoilage_date)}</span>
              <span className="spoilage-size">{entry.egg_sizes?.name || 'Unknown'}</span>
              <span className="spoilage-qty">{entry.quantity.toLocaleString()} eggs</span>
              <span className="spoilage-reason">
                <span className={`spoilage-reason-badge spoilage-reason-${entry.reason?.toLowerCase()}`}>
                  {entry.reason}
                </span>
              </span>
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={!!confirmItem}
        title="Record this spoilage?"
        message={confirmItem
          ? `Record ${confirmItem.quantity} egg${confirmItem.quantity > 1 ? 's' : ''} of ${inventory.find(i => i.egg_size_id === parseInt(confirmItem.eggSizeId, 10))?.egg_sizes?.name || 'Unknown'} as ${confirmItem.reason}?`
          : ''}
        confirmLabel="Record"
        variant="danger"
        icon={AlertTriangle}
        onConfirm={() => {
          const data = confirmItem;
          setConfirmItem(null);
          executeSpoilage(data);
        }}
        onCancel={() => setConfirmItem(null)}
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

        .spoilage-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
          margin-bottom: 1.25rem;
        }

        .spoilage-stat-card {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.875rem 1rem;
          background: var(--color-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-sm);
        }

        .spoilage-stat-card svg { flex-shrink: 0; }
        .spoilage-stat-total svg { color: var(--color-warning); }
        .spoilage-stat-today svg { color: var(--color-danger); }
        .spoilage-stat-cost svg { color: var(--color-accent); }
        .spoilage-stat-cost-today svg { color: var(--color-danger); }

        .spoilage-stat-value {
          display: block;
          font-weight: 700;
          font-size: 1.0625rem;
        }

        .spoilage-stat-label {
          display: block;
          font-size: 0.75rem;
          color: var(--color-text-muted);
        }

        .spoilage-breakdown {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .spoilage-breakdown-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: var(--color-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          font-size: 0.8125rem;
        }

        .spoilage-breakdown-reason {
          font-weight: 500;
          color: var(--color-text-secondary);
        }

        .spoilage-breakdown-qty {
          font-weight: 700;
          color: var(--color-warning);
        }

        .spoilage-breakdown-cost {
          font-weight: 600;
          color: var(--color-danger);
          font-size: 0.75rem;
        }

        .spoilage-form-card {
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

        .spoilage-table-header {
          display: grid;
          grid-template-columns: 70px 1fr 100px 1fr;
          padding: 0.625rem 1rem;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-muted);
          background: var(--color-bg);
          border-bottom: 1px solid var(--color-border);
        }

        .spoilage-row {
          display: grid;
          grid-template-columns: 70px 1fr 100px 1fr;
          align-items: center;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--color-border);
          animation: fadeIn 0.3s ease-out forwards;
          opacity: 0;
          transition: background 0.2s;
          font-size: 0.9375rem;
        }

        .spoilage-row:last-child { border-bottom: none; }
        .spoilage-row:hover { background: var(--color-bg); }

        .spoilage-date {
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
        }

        .spoilage-size {
          font-weight: 500;
        }

        .spoilage-qty {
          font-weight: 600;
          color: var(--color-warning);
          font-variant-numeric: tabular-nums;
        }

        .spoilage-reason-badge {
          display: inline-block;
          padding: 0.2rem 0.5rem;
          border-radius: 999px;
          font-size: 0.7rem;
          font-weight: 600;
        }

        .spoilage-reason-cracked { background: #FFF3E0; color: #E65100; }
        .spoilage-reason-broken { background: #FFEBEE; color: #C62828; }
        .spoilage-reason-expired { background: #F3E5F5; color: #7B1FA2; }
        .spoilage-reason-damaged { background: #E0F2F1; color: #00695C; }
        .spoilage-reason-other { background: #F5F5F5; color: #616161; }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          padding: 2.5rem;
          color: var(--color-text-muted);
          text-align: center;
        }

        @media (max-width: 640px) {
          .spoilage-table-header { display: none; }
          .spoilage-row {
            grid-template-columns: 1fr auto;
            gap: 0.1rem 0.5rem;
            padding: 0.625rem 0.75rem;
          }
          .spoilage-date {
            grid-column: 1; grid-row: 1;
            font-size: 0.6875rem;
            color: var(--color-text-muted);
          }
          .spoilage-size {
            grid-column: 1; grid-row: 2;
          }
          .spoilage-qty {
            grid-column: 2; grid-row: 1 / 3;
            align-self: center;
            text-align: right;
          }
          .spoilage-reason {
            grid-column: 1 / -1; grid-row: 3;
          }
          .spoilage-stats { grid-template-columns: 1fr; }
        }

        @media (min-width: 640px) {
          .spoilage-stats { grid-template-columns: 1fr 1fr; }
        }

        @media (min-width: 900px) {
          .spoilage-stats { grid-template-columns: 1fr 1fr 1fr 1fr; }
        }
      `}</style>
    </div>
  );
}
