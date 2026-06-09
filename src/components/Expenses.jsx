import { useState, useEffect } from 'react';
import {
  DollarSign,
  Plus,
  AlertTriangle,
  RefreshCw,
  TrendingDown,
  Receipt,
  Trash2,
  Search,
} from 'lucide-react';
import { fetchExpenses, recordExpense, formatPeso, EXPENSE_CATEGORIES, getLocalDate } from '../lib/api';
import { supabase } from '../lib/supabaseClient';
import { toast } from './Toast';
import { getUserFriendlyError } from '../lib/errors';
import ConfirmDialog from './ConfirmDialog';

export default function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filterCategory, setFilterCategory] = useState('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('expense_date');
  const [sortDir, setSortDir] = useState('desc');
  const [selectedIds, setSelectedIds] = useState([]);
  const [lastRecordedId, setLastRecordedId] = useState(null);

  const [form, setForm] = useState({
    category: '',
    description: '',
    amount: '',
  });
  const [confirmItem, setConfirmItem] = useState(null);

  const PAGE_SIZE = 50;

  const today = getLocalDate();

  useEffect(() => {
    loadExpenses();
  }, []);

  async function loadExpenses() {
    try {
      setLoading(true);
      setError(null);
      setPage(0);
      const data = await fetchExpenses({ limit: PAGE_SIZE, offset: 0 });
      setExpenses(data || []);
      setHasMore(data && data.length >= PAGE_SIZE);
    } catch (err) {
      console.error('Expenses load error:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    try {
      const nextOffset = (page + 1) * PAGE_SIZE;
      const data = await fetchExpenses({ limit: PAGE_SIZE, offset: nextOffset });
      if (data && data.length > 0) {
        setExpenses(prev => [...prev, ...data]);
        setPage(prev => prev + 1);
        setHasMore(data.length >= PAGE_SIZE);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Expenses load more error:', err);
      toast('Failed to load more expenses', 'error');
    }
  }

  function handleSort(field) {
    if (sortField === field) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function handleSelectAll() {
    if (selectedIds.length === filteredExpenses.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredExpenses.map(e => e.id));
    }
  }

  function handleSelectOne(id) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  async function handleDeleteSelected() {
    if (selectedIds.length === 0) return;
    try {
      const { error } = await supabase.from('expenses').delete().in('id', selectedIds);
      if (error) throw error;
      toast(`Deleted ${selectedIds.length} expense(s)`, 'success');
      setSelectedIds([]);
      loadExpenses();
    } catch (err) {
      console.error('Bulk delete error:', err);
      toast('Failed to delete expenses', 'error');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.category || !form.amount) {
      toast('Please fill in category and amount', 'error');
      return;
    }
    const amt = parseFloat(form.amount);
    if (isNaN(amt) || amt <= 0) {
      toast('Please enter a valid amount', 'error');
      return;
    }

    setConfirmItem({ category: form.category, description: form.description, amount: amt });
  }

  async function executeExpense(data) {
    setSubmitting(true);
    try {
      const result = await recordExpense(data);
      setLastRecordedId(result.id);
      toast('Expense recorded!', 'success', {
        label: 'Undo',
        onClick: async () => {
          try {
            const { error } = await supabase.from('expenses').delete().eq('id', result.id);
            if (error) throw error;
            toast('Expense undone', 'success');
            loadExpenses();
          } catch (err) {
            console.error('Undo delete error:', err);
            toast('Failed to undo', 'error');
          }
        },
      });
      setForm({ category: '', description: '', amount: '' });
      setShowForm(false);
      loadExpenses();
    } catch (err) {
      console.error('Expense record error:', err);
      toast('Failed to record expense', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const filteredExpenses = (() => {
    let list =
      filterCategory === 'all'
        ? expenses
        : expenses.filter(e => e.category === filterCategory);

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        e =>
          e.category?.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      let aVal, bVal;
      if (sortField === 'category') {
        aVal = (a.category || '').toLowerCase();
        bVal = (b.category || '').toLowerCase();
      } else if (sortField === 'amount') {
        aVal = parseFloat(a.amount || 0);
        bVal = parseFloat(b.amount || 0);
      } else {
        aVal = a.expense_date || '';
        bVal = b.expense_date || '';
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  })();

  const todayTotal = expenses
    .filter(e => e.expense_date === today)
    .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

  const categoryTotals = {};
  expenses.forEach(e => {
    const cat = e.category;
    categoryTotals[cat] = (categoryTotals[cat] || 0) + parseFloat(e.amount || 0);
  });

  function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const todayDate = new Date();
    const yesterday = new Date(todayDate);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateStr === today) return 'Today';
    if (dateStr === getLocalDate(yesterday)) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return (
    <div className="fade-in">
      <div className="page-header-row">
        <div>
          <h1>Expenses</h1>
          <p className="page-subtitle">Track feed, labor, and other costs</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus size={18} />
          {showForm ? 'Cancel' : 'Add Expense'}
        </button>
      </div>

      {/* Today's stats */}
      <div className="expense-stats">
        <div className="expense-stat-card expense-stat-today">
          <TrendingDown size={18} />
          <div>
            <span className="expense-stat-value">{formatPeso(todayTotal)}</span>
            <span className="expense-stat-label">expenses today</span>
          </div>
        </div>
        <div className="expense-stat-card expense-stat-total">
          <Receipt size={18} />
          <div>
            <span className="expense-stat-value">{expenses.length}</span>
            <span className="expense-stat-label">total entries</span>
          </div>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card expense-form-card">
          <h3 style={{ marginBottom: '1rem' }}>Record New Expense</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="input-group">
                <label>Category</label>
                <select
                  id="expense-category"
                  name="category"
                  className="select"
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  required
                >
                  <option value="">Select category...</option>
                  {EXPENSE_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label>Amount (₱)</label>
                <input
                  id="expense-amount"
                  name="amount"
                  type="number"
                  className="input"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })}
                  required
                />
              </div>
              <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                <label>Description (optional)</label>
                <input
                  id="expense-description"
                  name="description"
                  type="text"
                  className="input"
                  placeholder="e.g. 10 bags of layer feed"
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
              {submitting ? 'Recording...' : 'Review & Record'}
            </button>
          </form>
        </div>
      )}

      {error && !loading && (
        <div className="error-banner" style={{ marginBottom: '1rem' }}>
          <AlertTriangle size={20} />
          <div className="error-banner-content">
            <strong>Failed to load expenses</strong>
            <p>{getUserFriendlyError(error)}</p>
          </div>
          <button className="btn btn-sm btn-secondary" onClick={loadExpenses}>
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      )}

      {/* Category filters */}
      <div className="filter-tabs">
        <button
          className={`filter-tab ${filterCategory === 'all' ? 'active' : ''}`}
          onClick={() => setFilterCategory('all')}
        >
          All
        </button>
        {EXPENSE_CATEGORIES.map(cat => (
          <button
            key={cat}
            className={`filter-tab ${filterCategory === cat ? 'active' : ''}`}
            onClick={() => setFilterCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Category summary */}
      {Object.keys(categoryTotals).length > 0 && (
        <div className="expense-category-breakdown">
          {Object.entries(categoryTotals)
            .filter(([cat]) => filterCategory === 'all' || cat === filterCategory)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, total]) => (
              <div key={cat} className="expense-cat-item">
                <span className="expense-cat-name">{cat}</span>
                <span className="expense-cat-total">{formatPeso(total)}</span>
              </div>
            ))}
        </div>
      )}

      {/* Search and toolbar */}
      <div className="expense-toolbar">
        <div className="expense-search">
          <Search size={16} />
          <input
            type="text"
            className="input"
            placeholder="Search by category or description..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="expense-record-count">
          Showing {filteredExpenses.length} of {expenses.length} expenses
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="bulk-actions">
          <button
            className="btn btn-sm btn-danger"
            onClick={handleDeleteSelected}
            title="Delete selected expenses"
          >
            <Trash2 size={14} />
            Delete Selected ({selectedIds.length})
          </button>
        </div>
      )}

      {/* Expense list */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="expense-table-header">
          <span className="expense-check-col">
            <input
              type="checkbox"
              checked={filteredExpenses.length > 0 && selectedIds.length === filteredExpenses.length}
              onChange={handleSelectAll}
              title="Select all"
            />
          </span>
          <span className="sortable" onClick={() => handleSort('expense_date')} title="Sort by date">
            Date {sortField === 'expense_date' ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : ''}
          </span>
          <span className="sortable" onClick={() => handleSort('category')} title="Sort by category">
            Category {sortField === 'category' ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : ''}
          </span>
          <span>Description</span>
          <span className="num sortable" onClick={() => handleSort('amount')} title="Sort by amount">
            Amount {sortField === 'amount' ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : ''}
          </span>
        </div>
        {loading ? (
          <div className="loading-list">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 44, margin: '0.25rem 1rem', borderRadius: 4 }}>
                &nbsp;
              </div>
            ))}
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="empty-state">
            <DollarSign size={36} />
            <p>No expenses recorded yet</p>
            <p style={{ fontSize: '0.8125rem', marginTop: '-0.25rem' }}>Track operational costs like labor, feed, and utilities</p>
          </div>
        ) : (
          filteredExpenses.map((exp, i) => (
            <div
              key={exp.id}
              className="expense-row"
              style={{ animationDelay: `${i * 0.025}s` }}
            >
              <span className="expense-check-col">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(exp.id)}
                  onChange={() => handleSelectOne(exp.id)}
                  title={`Select ${exp.category} expense`}
                />
              </span>
              <span className="expense-date">{formatDate(exp.expense_date)}</span>
              <span className="expense-category">
                <span className={`expense-cat-badge expense-cat-${exp.category?.toLowerCase()}`}>
                  {exp.category}
                </span>
              </span>
              <span className="expense-desc">{exp.description || '\u2014'}</span>
              <span className="expense-amount num">{formatPeso(exp.amount)}</span>
            </div>
          ))
        )}
      </div>

      {hasMore && (
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button className="btn btn-secondary" onClick={loadMore}>
            Load More
          </button>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmItem}
        title="Record this expense?"
        message={confirmItem
          ? `Record ${confirmItem.category} expense of ${formatPeso(confirmItem.amount)}${confirmItem.description ? ` for "${confirmItem.description}"` : ''}?`
          : ''}
        confirmLabel="Record Expense"
        variant="primary"
        icon={Receipt}
        onConfirm={() => {
          const data = confirmItem;
          setConfirmItem(null);
          executeExpense(data);
        }}
        onCancel={() => setConfirmItem(null)}
      />

      <style>{`
        .expense-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
          margin-bottom: 1.25rem;
        }

        .expense-stat-card {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.875rem 1rem;
          background: var(--color-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-sm);
        }

        .expense-stat-card svg {
          flex-shrink: 0;
        }

        .expense-stat-today svg { color: var(--color-danger); }
        .expense-stat-total svg { color: var(--color-primary); }

        .expense-stat-value {
          display: block;
          font-weight: 700;
          font-size: 1.0625rem;
        }

        .expense-stat-label {
          display: block;
          font-size: 0.75rem;
          color: var(--color-text-muted);
        }

        .expense-form-card {
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

        .filter-tabs {
          display: flex;
          gap: 0.375rem;
          margin-bottom: 0.75rem;
          flex-wrap: wrap;
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

        .expense-category-breakdown {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .expense-cat-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: var(--color-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          font-size: 0.8125rem;
        }

        .expense-cat-name {
          font-weight: 500;
          color: var(--color-text-secondary);
        }

        .expense-cat-total {
          font-weight: 700;
          color: var(--color-danger);
        }

        .expense-table-header {
          display: grid;
          grid-template-columns: 36px 70px 90px 1fr 100px;
          padding: 0.625rem 1rem;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-muted);
          background: var(--color-bg);
          border-bottom: 1px solid var(--color-border);
        }

        .expense-row {
          display: grid;
          grid-template-columns: 36px 70px 90px 1fr 100px;
          align-items: center;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--color-border);
          animation: fadeIn 0.3s ease-out forwards;
          opacity: 0;
          transition: background 0.2s;
          font-size: 0.9375rem;
        }

        .expense-row:last-child { border-bottom: none; }
        .expense-row:hover { background: var(--color-bg); }

        .expense-date {
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
        }

        .expense-cat-badge {
          display: inline-block;
          padding: 0.2rem 0.5rem;
          border-radius: 999px;
          font-size: 0.7rem;
          font-weight: 600;
          background: var(--color-primary-light);
          color: var(--color-primary);
        }

        .expense-cat-feed { background: #E8F5E9; color: #2E7D32; }
        .expense-cat-labor { background: #E3F2FD; color: #1565C0; }
        .expense-cat-utilities { background: #FFF3E0; color: #E65100; }
        .expense-cat-transport { background: #F3E5F5; color: #7B1FA2; }
        .expense-cat-packaging { background: #FCE4EC; color: #C62828; }
        .expense-cat-maintenance { background: #E0F2F1; color: #00695C; }
        .expense-cat-misc { background: #F5F5F5; color: #616161; }

        .expense-desc {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .expense-amount {
          font-weight: 600;
          font-variant-numeric: tabular-nums;
          color: var(--color-danger);
        }

        .num { text-align: right; }

        .expense-check-col {
          display: flex;
          align-items: center;
        }

        .sortable {
          cursor: pointer;
          user-select: none;
        }

        .sortable:hover {
          color: var(--color-primary);
        }

        .expense-toolbar {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 0.75rem;
          flex-wrap: wrap;
        }

        .expense-search {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          min-width: 200px;
        }

        .expense-search svg {
          flex-shrink: 0;
          color: var(--color-text-muted);
        }

        .expense-search .input {
          flex: 1;
        }

        .expense-record-count {
          font-size: 0.8125rem;
          color: var(--color-text-muted);
          white-space: nowrap;
        }

        .bulk-actions {
          margin-bottom: 0.75rem;
        }

        .btn-danger {
          background: var(--color-danger);
          color: white;
          border: none;
        }

        .btn-danger:hover {
          background: #c0392b;
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

        /* Mobile: compact rows */
        @media (max-width: 640px) {
          .expense-table-header {
            display: none;
          }
          .expense-row {
            grid-template-columns: auto 1fr auto;
            gap: 0.1rem 0.5rem;
            padding: 0.625rem 0.75rem;
          }
          .expense-check-col {
            grid-column: 1;
            grid-row: 1 / 3;
            align-self: center;
          }
          .expense-date {
            grid-column: 2;
            grid-row: 1;
            font-size: 0.6875rem;
            color: var(--color-text-muted);
          }
          .expense-category {
            grid-column: 2;
            grid-row: 2;
          }
          .expense-amount {
            grid-column: 3;
            grid-row: 1 / 3;
            align-self: center;
            font-size: 0.9375rem;
          }
          .expense-desc {
            grid-column: 2 / -1;
            grid-row: 3;
            font-size: 0.8125rem;
          }
          .expense-stats {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
