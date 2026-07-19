import { useState, useEffect, useMemo } from 'react';
import {
  DollarSign,
  Plus,
  AlertTriangle,
  RefreshCw,
  TrendingDown,
  Receipt,
  Trash2,
  Search,
  Wallet,
  CreditCard,
  Percent,
  CheckCircle,
} from 'lucide-react';
import {
  fetchExpenses,
  recordExpense,
  deleteExpense,
  deleteExpenses,
  fetchOperationalFunds,
  addOperationalFund,
  deleteOperationalFund,
  getOperationalBalance,
  getDailyRevenueCutPreview,
  recordDailyRevenueCut,
  deleteDailyRevenueCut,
  formatPeso,
  EXPENSE_CATEGORIES,
  getLocalDate,
} from '../lib/api';
import { formatDate, formatTime } from '../lib/formatters';
import { useTableState } from '../hooks/useTableState';
import { toast } from '../lib/toastFn';
import { getUserFriendlyError } from '../lib/errors';
import ConfirmDialog from './ConfirmDialog';

export default function ExpensesFunds() {
  // ===== Balance state =====
  const [balance, setBalance] = useState({ totalFunds: 0, totalExpenses: 0, balance: 0 });
  const [funds, setFunds] = useState([]);

  // ===== Expenses state =====
  const [expenses, setExpenses] = useState([]);
  const [filterCategory, setFilterCategory] = useState('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [dateStart, setDateStart] = useState(getLocalDate());
  const [dateEnd, setDateEnd] = useState(getLocalDate());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // ===== Daily Cut state =====
  const [cutPreview, setCutPreview] = useState(null);
  const [recordingCut, setRecordingCut] = useState(false);

  // ===== Shared state =====
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showFundForm, setShowFundForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ===== Expense form =====
  const [expenseForm, setExpenseForm] = useState({ category: '', description: '', amount: '' });
  const [confirmExpense, setConfirmExpense] = useState(null);

  // ===== Fund form =====
  const today = getLocalDate();
  const [fundForm, setFundForm] = useState({ amount: '', description: '', date: today });
  const [confirmFund, setConfirmFund] = useState(null);
  const [deleteFundTarget, setDeleteFundTarget] = useState(null);

  const PAGE_SIZE = 50;

  // ===== Table state (search, sort, selection) =====
  const filteredByCategory = useMemo(() => {
    if (filterCategory === 'all') return expenses;
    return expenses.filter(e => e.category === filterCategory);
  }, [expenses, filterCategory]);

  const todayTotal = expenses
    .filter(e => e.expense_date === today)
    .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);

  // Wrap searchFn in useCallback to prevent unnecessary re-renders in useTableState
  const tableSearchFn = useMemo(() => (item, q) => 
    item.category?.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q), 
  []);

  const {
    searchQuery, setSearchQuery,
    sortField, sortDir, handleSort,
    selectedIds, clearSelection, handleToggleSelect, handleToggleSelectAll,
    processedData,
  } = useTableState({
    data: filteredByCategory,
    searchFn: tableSearchFn,
    defaultSortField: 'expense_date',
    defaultSortDir: 'desc',
  });

  // ===== Data loading =====
  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadExpenses(startDate, endDate) {
    try {
      setPage(0);
      const expData = await fetchExpenses({ startDate, endDate, limit: PAGE_SIZE, offset: 0 });
      setExpenses(expData || []);
      setHasMore(expData && expData.length >= PAGE_SIZE);
    } catch (err) {
      console.error('Expenses load error:', err);
      toast('Failed to load expenses', 'error');
    }
  }

  async function loadAll() {
    try {
      setLoading(true);
      setError(null);
      setPage(0);
      const [balData, fundsData, cutData] = await Promise.all([
        getOperationalBalance(),
        fetchOperationalFunds(),
        getDailyRevenueCutPreview().catch(() => null),
      ]);
      // Load expenses separately so we can pass date filters
      const expData = await fetchExpenses({ startDate: dateStart, endDate: dateEnd, limit: PAGE_SIZE, offset: 0 });
      setExpenses(expData || []);
      setHasMore(expData && expData.length >= PAGE_SIZE);
      setBalance(balData || { totalFunds: 0, totalExpenses: 0, balance: 0 });
      setFunds(fundsData || []);
      setCutPreview(cutData);
    } catch (err) {
      console.error('Expenses & Funds load error:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  function applyDateFilter(start, end) {
    setDateStart(start);
    setDateEnd(end);
    setShowDatePicker(false);
    setSearchQuery('');
    clearSelection();
    loadExpenses(start, end);
  }

  // ===== Expenses =====
  async function loadMoreExpenses() {
    try {
      const nextOffset = (page + 1) * PAGE_SIZE;
      const data = await fetchExpenses({ startDate: dateStart, endDate: dateEnd, limit: PAGE_SIZE, offset: nextOffset });
      if (data && data.length > 0) {
        setExpenses(prev => [...prev, ...data]);
        setPage(prev => prev + 1);
        setHasMore(data.length >= PAGE_SIZE);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Load more expenses error:', err);
      toast('Failed to load more expenses', 'error');
    }
  }

  async function handleDeleteSelected() {
    if (selectedIds.length === 0) return;
    const expensesToDelete = expenses.filter(e => selectedIds.includes(e.id));
    try {
      await deleteExpenses(selectedIds);
      toast(`Deleted ${selectedIds.length} expense(s)`, 'success', {
        label: 'Undo',
        onClick: async () => {
          try {
            for (const exp of expensesToDelete) {
              await recordExpense({ category: exp.category, description: exp.description, amount: exp.amount });
            }
            toast('Expenses restored');
            loadAll();
          } catch (err) {
            console.error('Undo expenses error:', err);
            toast('Failed to restore expenses', 'error');
          }
        },
      });
      clearSelection();
      loadAll();
    } catch (err) {
      console.error('Bulk delete error:', err);
      toast('Failed to delete expenses', 'error');
    }
  }

  function handleExpenseSubmit(e) {
    e.preventDefault();
    if (!expenseForm.category || !expenseForm.amount) {
      toast('Please fill in category and amount', 'error');
      return;
    }
    const amt = parseFloat(expenseForm.amount);
    if (isNaN(amt) || amt <= 0) {
      toast('Please enter a valid amount', 'error');
      return;
    }
    setConfirmExpense({ category: expenseForm.category, description: expenseForm.description, amount: amt });
  }

  async function executeExpense(data) {
    setSubmitting(true);
    try {
      const result = await recordExpense(data);
      toast('Expense recorded!', 'success', {
        label: 'Undo',
        onClick: async () => {
          try {
            await deleteExpense(result.id);
            toast('Expense undone', 'success');
            loadAll();
          } catch (err) {
            console.error('Undo delete error:', err);
            toast('Failed to undo', 'error');
          }
        },
      });
      setExpenseForm({ category: '', description: '', amount: '' });
      setShowExpenseForm(false);
      loadAll();
    } catch (err) {
      console.error('Expense record error:', err);
      toast('Failed to record expense', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const categoryTotals = {};
  expenses.forEach(e => {
    const cat = e.category;
    categoryTotals[cat] = (categoryTotals[cat] || 0) + parseFloat(e.amount || 0);
  });

  // ===== Funds =====
  function handleFundSubmit(e) {
    e.preventDefault();
    if (!fundForm.amount) {
      toast('Please enter an amount', 'error');
      return;
    }
    const amt = parseFloat(fundForm.amount);
    if (isNaN(amt) || amt <= 0) {
      toast('Please enter a valid amount', 'error');
      return;
    }
    setConfirmFund({ ...fundForm, amount: amt });
  }

  async function executeAddFund(data) {
    setSubmitting(true);
    try {
      await addOperationalFund({
        amount: data.amount,
        description: data.description.trim(),
        fundDate: data.date,
      });
      toast('Funds added!');
      setFundForm({ amount: '', description: '', date: today });
      setShowFundForm(false);
      loadAll();
    } catch (err) {
      console.error('Add funds error:', err);
      toast('Failed to add funds', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteFund(id) {
    try {
      await deleteOperationalFund(id);
      toast('Entry removed');
      setDeleteFundTarget(null);
      loadAll();
    } catch (err) {
      console.error('Delete fund error:', err);
      toast('Failed to remove entry', 'error');
    }
  }

  async function handleRecordDailyCut() {
    setRecordingCut(true);
    try {
      await recordDailyRevenueCut();
      toast(`Daily revenue cut recorded!`, 'success', {
        label: 'Undo',
        onClick: async () => {
          try {
            const today = getLocalDate();
            await deleteDailyRevenueCut(today);
            toast('Daily cut undone', 'success');
            loadAll();
          } catch (err) {
            console.error('Undo daily cut error:', err);
            toast('Failed to undo', 'error');
          }
        },
      });
      loadAll();
    } catch (err) {
      console.error('Record daily cut error:', err);
      toast(err.message || 'Failed to record daily cut', 'error');
    } finally {
      setRecordingCut(false);
    }
  }



  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header-row">
        <div>
          <h1>Expenses & Funds</h1>
          <p className="page-subtitle">Track operational costs and business funds</p>
        </div>
        <div className="ef-header-actions">
          <button className="btn btn-secondary btn-sm" onClick={loadAll} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Balance Summary Cards */}
      <div className="ef-balance-grid">
        <div className="ef-balance-card ef-balance-funds">
          <div className="ef-balance-icon" style={{ background: '#E8F5E9', color: '#2E7D32' }}>
            <Wallet size={18} />
          </div>
          <div className="ef-balance-info">
            <span className="ef-balance-label">Funds Added</span>
            <span className="ef-balance-value">{loading ? '—' : formatPeso(balance.totalFunds)}</span>
          </div>
        </div>
        <div className="ef-balance-card ef-balance-expenses">
          <div className="ef-balance-icon" style={{ background: '#FFEBEE', color: '#C62828' }}>
            <TrendingDown size={18} />
          </div>
          <div className="ef-balance-info">
            <span className="ef-balance-label">Expenses Spent</span>
            <span className="ef-balance-value">{loading ? '—' : formatPeso(balance.totalExpenses)}</span>
          </div>
        </div>
        <div className="ef-balance-card ef-balance-available">
          <div className="ef-balance-icon" style={{
            background: balance.balance >= 0 ? '#E8F5E9' : '#FFEBEE',
            color: balance.balance >= 0 ? '#2E7D32' : '#C62828',
          }}>
            <DollarSign size={18} />
          </div>
          <div className="ef-balance-info">
            <span className="ef-balance-label">Available Balance</span>
            <span className="ef-balance-value" style={{
              color: balance.balance >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
            }}>
              {loading ? '—' : formatPeso(balance.balance)}
            </span>
            {balance.totalFunds > 0 && !loading && (
              <div className="ef-opex-bar-wrap">
                <div className="ef-opex-bar">
                  <div
                    className="ef-opex-bar-fill"
                    style={{
                      width: `${Math.max(0, Math.min(100, (balance.balance / balance.totalFunds) * 100))}%`,
                      background: balance.balance >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expense Stats */}
      <div className="ef-expense-stats">
        <div className="ef-stat-card">
          <TrendingDown size={16} />
          <div>
            <span className="ef-stat-value">{formatPeso(todayTotal)}</span>
            <span className="ef-stat-label">expenses today</span>
          </div>
        </div>
        <div className="ef-stat-card">
          <Receipt size={16} />
          <div>
            <span className="ef-stat-value">{expenses.length}</span>
            <span className="ef-stat-label">total entries</span>
          </div>
        </div>
      </div>

      {/* ===== EXPENSES SECTION ===== */}
      <div className="ef-section">
        <div className="ef-section-header">
          <h2 className="ef-section-title">
            <CreditCard size={18} />
            Expenses
          </h2>
          <button className="btn btn-primary btn-sm" onClick={() => { setShowExpenseForm(!showExpenseForm); setShowFundForm(false); }}>
            <Plus size={16} />
            {showExpenseForm ? 'Cancel' : 'Add Expense'}
          </button>
        </div>

        {/* Expense Form */}
        {showExpenseForm && (
          <div className="card ef-form-card">
            <h3 style={{ marginBottom: '1rem' }}>Record New Expense</h3>
            <form onSubmit={handleExpenseSubmit}>
              <div className="form-grid">
                <div className="input-group">
                  <label>Category</label>
                  <select
                    id="ef-expense-category"
                    name="category"
                    className="select"
                    value={expenseForm.category}
                    onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}
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
                    id="ef-expense-amount"
                    name="amount"
                    type="number"
                    className="input"
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    value={expenseForm.amount}
                    onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    required
                  />
                </div>
                <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Description (optional)</label>
                  <input
                    id="ef-expense-description"
                    name="description"
                    type="text"
                    className="input"
                    placeholder="e.g. 10 bags of layer feed"
                    value={expenseForm.description}
                    onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
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
            <button className="btn btn-sm btn-secondary" onClick={loadAll}>
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        )}

        {/* Date filter */}
        <div className="ef-date-filter">
          <div className="ef-date-filter-row">
            <button
              className={`ef-date-btn ${dateStart === today && dateEnd === today ? 'active' : ''}`}
              onClick={() => {
                setDateStart(today);
                setDateEnd(today);
                setShowDatePicker(false);
                setSearchQuery('');
                clearSelection();
                loadExpenses(today, today);
              }}
            >
              Today
            </button>
            <button
              className={`ef-date-btn ${showDatePicker ? 'active' : ''}`}
              onClick={() => setShowDatePicker(!showDatePicker)}
            >
              {dateStart === today && dateEnd === today ? 'Custom Date' : `${formatDate(dateStart)} — ${formatDate(dateEnd)}`}
            </button>
          </div>
          {showDatePicker && (
            <div className="ef-date-picker-row">
              <input
                type="date"
                className="input ef-date-input"
                value={dateStart}
                onChange={e => setDateStart(e.target.value)}
              />
              <span className="ef-date-sep">—</span>
              <input
                type="date"
                className="input ef-date-input"
                value={dateEnd}
                onChange={e => setDateEnd(e.target.value)}
              />
              <button className="btn btn-primary btn-sm" onClick={() => applyDateFilter(dateStart, dateEnd)}>Go</button>
            </div>
          )}
        </div>

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
          <div className="ef-category-breakdown">
            {Object.entries(categoryTotals)
              .filter(([cat]) => filterCategory === 'all' || cat === filterCategory)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, total]) => (
                <div key={cat} className="ef-cat-item">
                  <span className="ef-cat-name">{cat}</span>
                  <span className="ef-cat-total">{formatPeso(total)}</span>
                </div>
              ))}
          </div>
        )}

        {/* Search and toolbar */}
        <div className="ef-toolbar">
          <div className="ef-search">
            <Search size={16} />
            <input
              type="text"
              className="input"
              placeholder="Search by category or description..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="ef-record-count">
            Showing {processedData.length} of {expenses.length} expenses
          </div>
        </div>

        {selectedIds.length > 0 && (
          <div className="bulk-actions">
            <button className="btn btn-sm btn-danger" onClick={handleDeleteSelected}>
              <Trash2 size={14} /> Delete Selected ({selectedIds.length})
            </button>
          </div>
        )}

        {/* Expense list */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="ef-table-header">
            <span className="ef-check-col">
              <input
                type="checkbox"
                checked={processedData.length > 0 && selectedIds.length === processedData.length}
                onChange={handleToggleSelectAll}
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
          ) : processedData.length === 0 ? (
            <div className="empty-state">
              <DollarSign size={36} />
              <p>No expenses recorded yet</p>
              <p style={{ fontSize: '0.8125rem', marginTop: '-0.25rem' }}>Track operational costs like labor, feed, and utilities</p>
            </div>
          ) : (
            processedData.map((exp, i) => (
              <div
                key={exp.id}
                className="ef-row"
                style={{ animationDelay: `${i * 0.025}s` }}
              >
                <span className="ef-check-col">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(exp.id)}
                    onChange={() => handleToggleSelect(exp.id)}
                    title={`Select ${exp.category} expense`}
                  />
                </span>
                <span className="ef-date">{formatDate(exp.expense_date)}</span>
                <span className="ef-category">
                  <span className={`ef-cat-badge ef-cat-badge-${exp.category?.toLowerCase()}`}>
                    {exp.category}
                  </span>
                </span>
                <span className="ef-desc">{exp.description || '\u2014'}</span>
                <span className="ef-amount num">{formatPeso(exp.amount)}</span>
              </div>
            ))
          )}
        </div>

        {hasMore && (
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <button className="btn btn-secondary" onClick={loadMoreExpenses}>Load More</button>
          </div>
        )}
      </div>

      {/* ===== FUNDS SECTION ===== */}
      <div className="ef-section" style={{ marginTop: '1.5rem' }}>
        <div className="ef-section-header">
          <h2 className="ef-section-title">
            <Wallet size={18} />
            Operational Funds
          </h2>
          <div className="ef-fund-actions">
            {!cutPreview?.alreadyRecorded && cutPreview && cutPreview.cutAmount > 0 && (
              <button
                className="btn btn-primary btn-sm ef-cut-btn"
                onClick={handleRecordDailyCut}
                disabled={recordingCut}
                title="Record 1% of today's revenue as a fund entry"
              >
                <Percent size={15} />
                {recordingCut ? 'Recording...' : `Daily Cut (${formatPeso(cutPreview.cutAmount)})`}
              </button>
            )}
            {cutPreview?.alreadyRecorded && (
              <span className="ef-cut-recorded-badge">
                <CheckCircle size={14} />
                Cut recorded today
              </span>
            )}
            <button className="btn btn-primary btn-sm" onClick={() => { setShowFundForm(!showFundForm); setShowExpenseForm(false); }}>
              <Plus size={16} />
              {showFundForm ? 'Cancel' : 'Add Funds'}
            </button>
          </div>
        </div>

        {/* Fund Form */}
        {showFundForm && (
          <div className="card ef-form-card">
            <h3 style={{ marginBottom: '1rem' }}>Add Funds to Operations</h3>
            <form onSubmit={handleFundSubmit}>
              <div className="form-grid">
                <div className="input-group">
                  <label>Amount (₱)</label>
                  <input
                    id="ef-fund-amount"
                    name="amount"
                    type="number"
                    className="input"
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    value={fundForm.amount}
                    onChange={e => setFundForm({ ...fundForm, amount: e.target.value })}
                    required
                    autoFocus
                  />
                </div>
                <div className="input-group">
                  <label>Date</label>
                  <input
                    id="ef-fund-date"
                    type="date"
                    className="input"
                    value={fundForm.date}
                    onChange={e => setFundForm({ ...fundForm, date: e.target.value })}
                  />
                </div>
                <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Description (optional)</label>
                  <input
                    id="ef-fund-description"
                    name="description"
                    type="text"
                    className="input"
                    placeholder="e.g. Weekly operational budget"
                    value={fundForm.description}
                    onChange={e => setFundForm({ ...fundForm, description: e.target.value })}
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

        {/* Fund list */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="ef-fund-header">
            <span>Date / Time</span>
            <span>Description</span>
            <span className="num">Amount</span>
            <span className="num"></span>
          </div>
          {loading ? (
            <div className="loading-list">
              {Array.from({ length: 3 }).map((_, i) => (
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
                Click "Add Funds" to record money you put into the business
              </p>
            </div>
          ) : (
            funds.map((entry, i) => (
              <div
                key={entry.id}
                className="ef-fund-row"
                style={{ animationDelay: `${i * 0.03}s` }}
              >
                <span className="ef-date">
                  {formatDate(entry.fund_date)}
                  {entry.created_at && (
                    <span className="ef-time">{formatTime(entry.created_at)}</span>
                  )}
                </span>
                <span className="ef-desc">{entry.description || '\u2014'}</span>
                <span className="ef-fund-amount num">{formatPeso(entry.amount)}</span>
                <span className="num">
                  <button
                    className="btn-icon btn-icon-danger"
                    onClick={() => setDeleteFundTarget(entry)}
                    title="Remove entry"
                  >
                    <Trash2 size={16} />
                  </button>
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ===== Confirm Dialogs ===== */}
      <ConfirmDialog
        open={!!confirmExpense}
        title="Record this expense?"
        message={confirmExpense
          ? `Record ${confirmExpense.category} expense of ${formatPeso(confirmExpense.amount)}${confirmExpense.description ? ` for "${confirmExpense.description}"` : ''}?`
          : ''}
        confirmLabel="Record Expense"
        variant="primary"
        icon={Receipt}
        onConfirm={() => {
          const data = confirmExpense;
          setConfirmExpense(null);
          executeExpense(data);
        }}
        onCancel={() => setConfirmExpense(null)}
      />

      <ConfirmDialog
        open={!!confirmFund}
        title="Add these funds?"
        message={confirmFund
          ? `Add ${formatPeso(confirmFund.amount)} to operational funds${confirmFund.description ? ` for "${confirmFund.description}"` : ''}?`
          : ''}
        confirmLabel="Add"
        variant="primary"
        icon={Wallet}
        onConfirm={() => {
          const data = confirmFund;
          setConfirmFund(null);
          executeAddFund(data);
        }}
        onCancel={() => setConfirmFund(null)}
      />

      <ConfirmDialog
        open={!!deleteFundTarget}
        title="Remove this entry?"
        message={`Remove this fund addition of ${deleteFundTarget ? formatPeso(deleteFundTarget.amount) : ''}? This cannot be undone.`}
        confirmLabel="Remove"
        variant="danger"
        icon={Trash2}
        onConfirm={() => handleDeleteFund(deleteFundTarget.id)}
        onCancel={() => setDeleteFundTarget(null)}
      />

      <style>{`
        .ef-header-actions { display: flex; gap: 0.5rem; align-items: center; }

        .ef-balance-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }
        @media (min-width: 640px) { .ef-balance-grid { grid-template-columns: repeat(3, 1fr); } }

        .ef-balance-card {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.875rem 1rem;
          background: var(--color-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-sm);
          transition: all var(--transition-base);
        }
        .ef-balance-card:hover { box-shadow: var(--shadow-md); }

        .ef-balance-icon {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .ef-balance-info { display: flex; flex-direction: column; gap: 0.0625rem; min-width: 0; }
        .ef-balance-label { font-size: 0.6875rem; font-weight: var(--font-weight-medium); color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
        .ef-balance-value { font-size: 1.25rem; font-weight: var(--font-weight-bold); font-variant-numeric: tabular-nums; }

        .ef-opex-bar-wrap { margin-top: 0.375rem; }
        .ef-opex-bar { height: 4px; background: var(--color-border); border-radius: var(--radius-full); overflow: hidden; }
        .ef-opex-bar-fill { height: 100%; border-radius: var(--radius-full); transition: width 0.5s ease; }

        .ef-expense-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1.25rem; }
        @media (min-width: 640px) { .ef-expense-stats { grid-template-columns: repeat(2, 1fr); } }

        .ef-stat-card {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.875rem 1rem;
          background: var(--color-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-sm);
        }
        .ef-stat-card svg { flex-shrink: 0; color: var(--color-danger); }
        .ef-stat-card:nth-child(2) svg { color: var(--color-primary); }
        .ef-stat-value { display: block; font-weight: 700; font-size: 1.0625rem; }
        .ef-stat-label { display: block; font-size: 0.75rem; color: var(--color-text-muted); }

        .ef-section { margin-bottom: 0; }
        .ef-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.75rem;
          padding-bottom: 0.5rem;
          border-bottom: 2px solid var(--color-border);
        }
        .ef-section-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 1.125rem;
          font-weight: var(--font-weight-bold);
        }
        .ef-section-title svg { color: var(--color-primary); }

        .ef-fund-actions { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
        .ef-cut-btn { background: var(--color-success) !important; border-color: var(--color-success) !important; white-space: nowrap; }
        .ef-cut-btn:hover { background: #2E7D32 !important; }
        .ef-cut-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .ef-cut-recorded-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.375rem 0.75rem;
          background: var(--color-success-bg);
          color: var(--color-success);
          border-radius: var(--radius-sm);
          font-size: 0.75rem;
          font-weight: 600;
          white-space: nowrap;
        }

        .ef-form-card { margin-bottom: 1rem; animation: fadeIn 0.3s ease-out; }

        .ef-category-breakdown { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; }
        .ef-cat-item {
          display: flex; align-items: center; gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: var(--color-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          font-size: 0.8125rem;
        }
        .ef-cat-name { font-weight: 500; color: var(--color-text-secondary); }
        .ef-cat-total { font-weight: 700; color: var(--color-danger); }

        .ef-toolbar { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem; flex-wrap: wrap; }
        .ef-search { flex: 1; display: flex; align-items: center; gap: 0.5rem; min-width: 200px; }
        .ef-search svg { flex-shrink: 0; color: var(--color-text-muted); }
        .ef-search .input { flex: 1; }
        .ef-record-count { font-size: 0.8125rem; color: var(--color-text-muted); white-space: nowrap; }

        .ef-date-filter { margin-bottom: 0.75rem; }
        .ef-date-filter-row { display: flex; gap: 0.375rem; flex-wrap: wrap; }
        .ef-date-btn {
          padding: 0.4rem 0.875rem;
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-sm);
          background: var(--color-card);
          color: var(--color-text-secondary);
          font-size: 0.8125rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .ef-date-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
        .ef-date-btn.active { background: var(--color-primary); border-color: var(--color-primary); color: white; }
        .ef-date-picker-row { display: flex; align-items: center; gap: 0.375rem; margin-top: 0.5rem; flex-wrap: wrap; }
        .ef-date-input { max-width: 160px; padding: 0.35rem 0.5rem; border: 1.5px solid var(--color-border); border-radius: var(--radius-sm); font-size: 0.75rem; color: var(--color-text); background: var(--color-card); }
        .ef-date-input:focus { border-color: var(--color-primary); outline: none; }
        .ef-date-sep { color: var(--color-text-muted); font-size: 0.8125rem; }

        .btn-danger { background: var(--color-danger); color: white; border: none; }
        .btn-danger:hover { background: #c0392b; }

        .ef-table-header {
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

        .ef-row {
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
        .ef-row:last-child { border-bottom: none; }
        .ef-row:hover { background: var(--color-bg); }

        .ef-date { font-size: 0.8125rem; color: var(--color-text-secondary); display: flex; flex-direction: column; gap: 0.0625rem; }
        .ef-time { font-size: 0.6875rem; color: var(--color-text-muted); font-variant-numeric: tabular-nums; }

        .ef-cat-badge {
          display: inline-block;
          padding: 0.2rem 0.5rem;
          border-radius: 999px;
          font-size: 0.7rem;
          font-weight: 600;
          background: var(--color-primary-light);
          color: var(--color-primary);
        }
        .ef-cat-badge-feed { background: #E8F5E9; color: #2E7D32; }
        .ef-cat-badge-labor { background: #E3F2FD; color: #1565C0; }
        .ef-cat-badge-utilities { background: #FFF3E0; color: #E65100; }
        .ef-cat-badge-transport { background: #F3E5F5; color: #7B1FA2; }
        .ef-cat-badge-packaging { background: #FCE4EC; color: #C62828; }
        .ef-cat-badge-maintenance { background: #E0F2F1; color: #00695C; }
        .ef-cat-badge-misc { background: #F5F5F5; color: #616161; }

        .ef-desc { font-size: 0.875rem; color: var(--color-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ef-amount { font-weight: 600; font-variant-numeric: tabular-nums; color: var(--color-danger); }

        .ef-check-col { display: flex; align-items: center; }

        /* Fund list */
        .ef-fund-header {
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

        .ef-fund-row {
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
        .ef-fund-row:last-child { border-bottom: none; }
        .ef-fund-row:hover { background: var(--color-bg); }

        .ef-fund-amount { font-weight: 600; font-variant-numeric: tabular-nums; color: var(--color-primary); }

        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        /* Mobile */
        @media (max-width: 640px) {
          .ef-table-header, .ef-fund-header { display: none; }

          .ef-row {
            grid-template-columns: auto 1fr auto;
            gap: 0.1rem 0.5rem;
            padding: 0.625rem 0.75rem;
          }
          .ef-check-col { grid-column: 1; grid-row: 1 / 3; align-self: center; }
          .ef-date { grid-column: 2; grid-row: 1; font-size: 0.6875rem; color: var(--color-text-muted); }
          .ef-category { grid-column: 2; grid-row: 2; }
          .ef-amount { grid-column: 3; grid-row: 1 / 3; align-self: center; font-size: 0.9375rem; }
          .ef-desc { grid-column: 2 / -1; grid-row: 3; font-size: 0.8125rem; }

          .ef-fund-row {
            grid-template-columns: auto 1fr auto;
            gap: 0.1rem 0.5rem;
            padding: 0.625rem 0.75rem;
          }
          .ef-fund-row .ef-date { grid-column: 1; grid-row: 1; font-size: 0.6875rem; color: var(--color-text-muted); display: flex; flex-direction: column; gap: 0; }
          .ef-fund-row .ef-desc { grid-column: 2; grid-row: 1; }
          .ef-fund-row .ef-fund-amount { grid-column: 3; grid-row: 1; }
          .ef-fund-row .num { grid-column: 3; grid-row: 2; }

          .ef-expense-stats { grid-template-columns: 1fr; }
          .ef-balance-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
