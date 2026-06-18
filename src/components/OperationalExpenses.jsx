import { useState, useEffect } from 'react';
import {
  Wallet,
  Plus,
  AlertTriangle,
  RefreshCw,
  DollarSign,
  TrendingDown,
  Trash2,
} from 'lucide-react';
import {
  fetchOperationalFunds,
  addOperationalFund,
  deleteOperationalFund,
  getOperationalBalance,
  formatPeso,
  getLocalDate,
} from '../lib/api';
import { toast } from './Toast';
import { getUserFriendlyError } from '../lib/errors';
import ConfirmDialog from './ConfirmDialog';

export default function OperationalExpenses() {
  const [funds, setFunds] = useState([]);
  const [balance, setBalance] = useState({ totalFunds: 0, totalExpenses: 0, balance: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const today = getLocalDate();
  const [form, setForm] = useState({
    amount: '',
    description: '',
    date: today,
  });
  const [confirmItem, setConfirmItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const [fundsData, balanceData] = await Promise.all([
        fetchOperationalFunds(),
        getOperationalBalance(),
      ]);
      setFunds(fundsData || []);
      setBalance(balanceData || { totalFunds: 0, totalExpenses: 0, balance: 0 });
    } catch (err) {
      console.error('Operational funds load error:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.amount) {
      toast('Please enter an amount', 'error');
      return;
    }
    const amt = parseFloat(form.amount);
    if (isNaN(amt) || amt <= 0) {
      toast('Please enter a valid amount', 'error');
      return;
    }
    setConfirmItem({ ...form, amount: amt });
  }

  async function executeAdd(data) {
    setSubmitting(true);
    try {
      await addOperationalFund({
        amount: data.amount,
        description: data.description.trim(),
        fundDate: data.date,
      });
      toast('Funds added!');
      setForm({ amount: '', description: '', date: today });
      setShowForm(false);
      loadData();
    } catch (err) {
      console.error('Add funds error:', err);
      toast('Failed to add funds', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteOperationalFund(id);
      toast('Entry removed');
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      console.error('Delete fund error:', err);
      toast('Failed to remove entry', 'error');
    }
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    if (dateStr === today) return 'Today';
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (dateStr === getLocalDate(yesterday)) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return (
    <div className="fade-in">
      <div className="page-header-row">
        <div>
          <h1>Operational Expenses</h1>
          <p className="page-subtitle">Track funds you add to the business</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus size={18} />
          {showForm ? 'Cancel' : 'Add Funds'}
        </button>
      </div>

      {/* Balance Cards */}
      <div className="opex-stats">
        <div className="opex-stat-card opex-stat-added">
          <Wallet size={18} />
          <div>
            <span className="opex-stat-value">{loading ? '—' : formatPeso(balance.totalFunds)}</span>
            <span className="opex-stat-label">total funds added</span>
          </div>
        </div>
        <div className="opex-stat-card opex-stat-spent">
          <TrendingDown size={18} />
          <div>
            <span className="opex-stat-value">{loading ? '—' : formatPeso(balance.totalExpenses)}</span>
            <span className="opex-stat-label">total expenses spent</span>
          </div>
        </div>
        <div className="opex-stat-card opex-stat-balance">
          <DollarSign size={18} />
          <div>
            <span className="opex-stat-value" style={{
              color: balance.balance >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
            }}>
              {loading ? '—' : formatPeso(balance.balance)}
            </span>
            <span className="opex-stat-label">available balance</span>
          </div>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card opex-form-card">
          <h3 style={{ marginBottom: '1rem' }}>Add Funds to Operations</h3>
          <form onSubmit={handleSubmit}>
            <div className="opex-form-grid">
              <div className="input-group">
                <label>Amount (₱)</label>
                <input
                  id="opex-amount"
                  name="amount"
                  type="number"
                  className="input"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                  required
                  autoFocus
                />
              </div>
              <div className="input-group">
                <label>Date</label>
                <input
                  id="opex-date"
                  type="date"
                  className="input"
                  value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                <label>Description (optional)</label>
                <input
                  id="opex-description"
                  name="description"
                  type="text"
                  className="input"
                  placeholder="e.g. Weekly operational budget"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                />
              </div>
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-block"
              style={{ marginTop: '1rem' }}
              disabled={submitting}
            >
              {submitting ? 'Adding...' : 'Add Funds'}
            </button>
          </form>
        </div>
      )}

      {error && !loading && (
        <div className="error-banner" style={{ marginBottom: '1rem' }}>
          <AlertTriangle size={20} />
          <div className="error-banner-content">
            <strong>Failed to load data</strong>
            <p>{getUserFriendlyError(error)}</p>
          </div>
          <button className="btn btn-sm btn-secondary" onClick={loadData}>
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      )}

      {/* Fund list */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="opex-table-header">
          <span>Date</span>
          <span>Description</span>
          <span className="num">Amount</span>
          <span className="num"></span>
        </div>
        {loading ? (
          <div className="loading-list">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 44, margin: '0.25rem 1rem', borderRadius: 4 }}>
                &nbsp;
              </div>
            ))}
          </div>
        ) : funds.length === 0 ? (
          <div className="empty-state">
            <Wallet size={36} />
            <p>No funds added yet</p>
            <p style={{ fontSize: '0.8125rem', marginTop: '-0.25rem' }}>
              Click "Add Funds" above to record money you put into the business
            </p>
          </div>
        ) : (
          funds.map((entry, i) => (
            <div
              key={entry.id}
              className="opex-row"
              style={{ animationDelay: `${i * 0.03}s` }}
            >
              <span className="opex-date">{formatDate(entry.fund_date)}</span>
              <span className="opex-desc">{entry.description || '—'}</span>
              <span className="opex-amount num">{formatPeso(entry.amount)}</span>
              <span className="num">
                <button
                  className="btn-icon btn-icon-danger"
                  onClick={() => setDeleteTarget(entry)}
                  title="Remove entry"
                >
                  <Trash2 size={16} />
                </button>
              </span>
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={!!confirmItem}
        title="Add these funds?"
        message={confirmItem
          ? `Add ${formatPeso(confirmItem.amount)} to operational expenses${confirmItem.description ? ` for "${confirmItem.description}"` : ''}?`
          : ''}
        confirmLabel="Add"
        variant="primary"
        icon={Wallet}
        onConfirm={() => {
          const data = confirmItem;
          setConfirmItem(null);
          executeAdd(data);
        }}
        onCancel={() => setConfirmItem(null)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove this entry?"
        message={`Remove this fund addition of ${deleteTarget ? formatPeso(deleteTarget.amount) : ''}? This cannot be undone.`}
        confirmLabel="Remove"
        variant="danger"
        icon={Trash2}
        onConfirm={() => handleDelete(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />

      <style>{`
        .opex-stats {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.75rem;
          margin-bottom: 1.25rem;
        }

        @media (min-width: 640px) {
          .opex-stats {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        .opex-stat-card {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.875rem 1rem;
          background: var(--color-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-sm);
        }

        .opex-stat-card svg { flex-shrink: 0; }
        .opex-stat-added svg { color: var(--color-primary); }
        .opex-stat-spent svg { color: var(--color-danger); }
        .opex-stat-balance svg { color: var(--color-success); }

        .opex-stat-value {
          display: block;
          font-weight: 700;
          font-size: 1.25rem;
          font-variant-numeric: tabular-nums;
        }

        .opex-stat-label {
          display: block;
          font-size: 0.75rem;
          color: var(--color-text-muted);
        }

        .opex-form-card {
          margin-bottom: 1.25rem;
          animation: fadeIn 0.3s ease-out;
        }

        .opex-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.875rem;
        }

        @media (max-width: 500px) {
          .opex-form-grid {
            grid-template-columns: 1fr;
          }
        }

        .opex-table-header {
          display: grid;
          grid-template-columns: 80px 1fr 120px 44px;
          padding: 0.625rem 1rem;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-muted);
          background: var(--color-bg);
          border-bottom: 1px solid var(--color-border);
        }

        .opex-row {
          display: grid;
          grid-template-columns: 80px 1fr 120px 44px;
          align-items: center;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--color-border);
          animation: fadeIn 0.3s ease-out forwards;
          opacity: 0;
          transition: background 0.2s;
          font-size: 0.9375rem;
        }

        .opex-row:last-child { border-bottom: none; }
        .opex-row:hover { background: var(--color-bg); }

        .opex-date {
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
        }

        .opex-desc {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .opex-amount {
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          color: var(--color-primary);
        }

        .num { text-align: right; }

        .btn-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border: none;
          border-radius: var(--radius-sm);
          background: transparent;
          color: var(--color-text-muted);
          transition: all 0.2s;
          cursor: pointer;
        }

        .btn-icon:hover {
          background: var(--color-primary-light);
          color: var(--color-primary);
        }

        .btn-icon-danger:hover {
          background: var(--color-danger-bg);
          color: var(--color-danger);
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

        @media (max-width: 640px) {
          .opex-table-header { display: none; }
          .opex-row {
            grid-template-columns: auto 1fr auto;
            gap: 0.1rem 0.5rem;
            padding: 0.625rem 0.75rem;
          }
          .opex-date {
            grid-column: 1; grid-row: 1;
            font-size: 0.6875rem;
            color: var(--color-text-muted);
          }
          .opex-desc {
            grid-column: 2; grid-row: 1;
            font-size: 0.8125rem;
          }
          .opex-amount {
            grid-column: 3; grid-row: 1;
          }
          .opex-row .num:last-child {
            grid-column: 3; grid-row: 2;
          }
        }
      `}</style>
    </div>
  );
}
