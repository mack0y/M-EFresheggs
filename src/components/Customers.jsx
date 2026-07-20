import { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Plus,
  AlertTriangle,
  RefreshCw,
  Phone,
  Trash2,
  UserPlus,
  Pencil,
  X,
  Search,
  ShoppingCart,
  Calendar,
  DollarSign,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { fetchCustomers, addCustomer, updateCustomer, deleteCustomer, fetchCustomerSales, formatPeso, getLocalDate } from '../lib/api';
import { toast } from '../lib/toastFn';
import { getUserFriendlyError } from '../lib/errors';
import ConfirmDialog from './ConfirmDialog';
import { useConfirmDialog } from '../hooks/useConfirmDialog';

const PAGE_SIZE = 50;

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const { target: deleteTarget, isOpen: isDeleteOpen, openConfirm, closeConfirm } = useConfirmDialog();

  const [form, setForm] = useState({ name: '', phone: '', notes: '' });

  // Search & sort
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(0);

  // Sales history modal
  const [historyTarget, setHistoryTarget] = useState(null);
  const [historySales, setHistorySales] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchCustomers();
      setCustomers(data || []);
    } catch (err) {
      console.error('Customers load error:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast('Please enter a customer name', 'error');
      return;
    }
    setSubmitting(true);
    try {
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, {
          name: form.name.trim(),
          phone: form.phone.trim(),
          notes: form.notes.trim(),
        });
        toast('Customer updated!');
      } else {
        await addCustomer({
          name: form.name.trim(),
          phone: form.phone.trim(),
          notes: form.notes.trim(),
        });
        toast('Customer added!');
      }
      setForm({ name: '', phone: '', notes: '' });
      setEditingCustomer(null);
      setShowForm(false);
      loadCustomers();
    } catch (err) {
      console.error('Save customer error:', err);
      toast(getUserFriendlyError(err), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(customer) {
    setEditingCustomer(customer);
    setForm({
      name: customer.name || '',
      phone: customer.phone || '',
      notes: customer.notes || '',
    });
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingCustomer(null);
    setForm({ name: '', phone: '', notes: '' });
  }

  async function handleDelete(id) {
    try {
      await deleteCustomer(id);
      toast('Customer removed');
      closeConfirm();
      loadCustomers();
    } catch (err) {
      console.error('Delete customer error:', err);
      toast('Failed to remove customer', 'error');
    }
  }

  async function openHistory(customer) {
    setHistoryTarget(customer);
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const data = await fetchCustomerSales(customer.id);
      setHistorySales(data || []);
    } catch (err) {
      console.error('Fetch customer sales error:', err);
      toast('Failed to load sales history', 'error');
      setHistorySales([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  function toggleSort(field) {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setPage(0);
  }

  function SortIcon(field) {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  }

  const filtered = useMemo(() => {
    let list = [...customers];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.notes?.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const aVal = (a[sortField] || '').toLowerCase();
      const bVal = (b[sortField] || '').toLowerCase();
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
    return list;
  }, [customers, search, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageCustomers = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="fade-in">
      <div className="page-header-row">
        <div>
          <h1>Customers</h1>
          <p className="page-subtitle">Manage your customer directory</p>
        </div>
        <button className="btn btn-primary" onClick={() => showForm ? cancelForm() : setShowForm(true)}>
          <Plus size={18} />
          {showForm ? 'Cancel' : 'Add Customer'}
        </button>
      </div>

      {/* Stats */}
      <div className="customers-stats">
        <div className="customers-stat-card">
          <Users size={18} />
          <div>
            <span className="customers-stat-value">{customers.length}</span>
            <span className="customers-stat-label">total customers</span>
          </div>
        </div>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="card customers-form-card">
          <h3 style={{ marginBottom: '1rem' }}>
            <UserPlus size={18} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
            {editingCustomer ? 'Edit Customer' : 'New Customer'}
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="input-group">
                <label>Name *</label>
                <input
                  id="customer-name"
                  name="name"
                  type="text"
                  className="input"
                  placeholder="e.g. Juan Dela Cruz"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                  autoFocus
                />
              </div>
              <div className="input-group">
                <label>Phone</label>
                <input
                  id="customer-phone"
                  name="phone"
                  type="tel"
                  className="input"
                  placeholder="e.g. 0917-123-4567"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                <label>Notes</label>
                <input
                  id="customer-notes"
                  name="notes"
                  type="text"
                  className="input"
                  placeholder="e.g. Regular bulk buyer, preferred size"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
                {submitting ? 'Saving...' : editingCustomer ? 'Update Customer' : 'Add Customer'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={cancelForm}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {error && !loading && (
        <div className="error-banner" style={{ marginBottom: '1rem' }}>
          <AlertTriangle size={20} />
          <div className="error-banner-content">
            <strong>Failed to load customers</strong>
            <p>{getUserFriendlyError(error)}</p>
          </div>
          <button className="btn btn-sm btn-secondary" onClick={loadCustomers}>
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      )}

      {/* Search */}
      {!loading && customers.length > 0 && (
        <div className="customers-search-bar">
          <Search size={16} />
          <input
            type="text"
            className="customers-search-input"
            placeholder="Search by name, phone, or notes..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
          />
          {search && (
            <button className="btn-icon" onClick={() => setSearch('')} title="Clear search">
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Customer list */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="customers-table-header">
          <button className="customers-sort-btn" onClick={() => toggleSort('name')}>
            Name {SortIcon('name')}
          </button>
          <button className="customers-sort-btn" onClick={() => toggleSort('phone')}>
            Phone {SortIcon('phone')}
          </button>
          <button className="customers-sort-btn" onClick={() => toggleSort('notes')}>
            Notes {SortIcon('notes')}
          </button>
          <span className="num"></span>
        </div>
        {loading ? (
          <div className="loading-list">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 52, margin: '0.25rem 1rem', borderRadius: 4 }}>&nbsp;</div>
            ))}
          </div>
        ) : pageCustomers.length === 0 ? (
          <div className="empty-state">
            <Users size={36} />
            <p>{search ? 'No customers match your search.' : 'No customers yet. Click "Add Customer" above to get started.'}</p>
          </div>
        ) : (
          pageCustomers.map((customer, i) => (
            <div
              key={customer.id}
              className="customers-row"
              style={{ animationDelay: `${i * 0.025}s` }}
              onClick={() => openHistory(customer)}
            >
              <div className="customers-name">
                <span className="customers-name-text">{customer.name}</span>
              </div>
              <span className="customers-phone">
                {customer.phone ? (
                  <><Phone size={12} />{customer.phone}</>
                ) : (
                  <span className="customers-muted">—</span>
                )}
              </span>
              <span className="customers-notes">{customer.notes || <span className="customers-muted">—</span>}</span>
              <span className="num" style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                <button
                  className="btn-icon"
                  onClick={e => { e.stopPropagation(); startEdit(customer); }}
                  title="Edit customer"
                >
                  <Pencil size={14} />
                </button>
                <button
                  className="btn-icon btn-icon-danger"
                  onClick={e => { e.stopPropagation(); openConfirm(customer); }}
                  title="Remove customer"
                >
                  <Trash2 size={14} />
                </button>
              </span>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && !loading && (
        <div className="customers-pagination">
          <button className="btn btn-sm btn-secondary" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>
            Previous
          </button>
          <span className="customers-page-info">
            Page {page + 1} of {totalPages} ({filtered.length} total)
          </span>
          <button className="btn btn-sm btn-secondary" disabled={page >= totalPages - 1} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}>
            Next
          </button>
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={isDeleteOpen}
        title="Remove this customer?"
        message={deleteTarget ? `Remove "${deleteTarget.name}" from your directory? This cannot be undone.` : ''}
        confirmLabel="Remove"
        variant="danger"
        icon={Trash2}
        onConfirm={() => handleDelete(deleteTarget.id)}
        onCancel={closeConfirm}
      />

      {/* Sales history modal */}
      {historyOpen && (
        <div className="cs-modal-overlay" onClick={() => setHistoryOpen(false)}>
          <div className="cs-modal" onClick={e => e.stopPropagation()}>
            <div className="cs-modal-header">
              <div className="cs-modal-title">
                <ShoppingCart size={18} />
                <span>{historyTarget?.name || 'Customer'}'s Sales</span>
              </div>
              <button className="btn-icon" onClick={() => setHistoryOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="cs-modal-body">
              {historyLoading ? (
                <div className="loading-list" style={{ padding: '1rem' }}>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="skeleton" style={{ height: 44, marginBottom: '0.5rem', borderRadius: 4 }}>&nbsp;</div>
                  ))}
                </div>
              ) : historySales.length === 0 ? (
                <div className="empty-state">
                  <ShoppingCart size={32} />
                  <p>No sales recorded for this customer yet.</p>
                </div>
              ) : (
                <div className="cs-sales-list">
                  <div className="cs-sales-header">
                    <span>Date</span>
                    <span>Amount</span>
                    <span>Time</span>
                  </div>
                  {historySales.map(sale => (
                    <div key={sale.id} className="cs-sale-row">
                      <span className="cs-sale-date">
                        <Calendar size={12} />
                        {sale.sale_date ? getLocalDate(new Date(sale.sale_date)) : '—'}
                      </span>
                      <span className="cs-sale-amount">
                        <DollarSign size={12} />
                        {formatPeso(sale.total_amount)}
                      </span>
                      <span className="cs-sale-time">{sale.sale_time?.slice(0, 5) || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .customers-stats {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.75rem;
          margin-bottom: 1.25rem;
        }

        .customers-stat-card {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.875rem 1rem;
          background: var(--color-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-sm);
        }

        .customers-stat-card svg { color: var(--color-primary); flex-shrink: 0; }
        .customers-stat-value { display: block; font-weight: 700; font-size: 1.0625rem; }
        .customers-stat-label { display: block; font-size: 0.75rem; color: var(--color-text-muted); }
        .customers-form-card { margin-bottom: 1.25rem; animation: fadeIn 0.3s ease-out; }

        .customers-search-bar {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: var(--color-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          margin-bottom: 0.75rem;
          color: var(--color-text-muted);
        }
        .customers-search-input {
          flex: 1;
          border: none;
          background: transparent;
          font-size: 0.875rem;
          color: var(--color-text);
          outline: none;
        }
        .customers-search-input::placeholder { color: var(--color-text-muted); }

        .customers-table-header {
          display: grid;
          grid-template-columns: 1fr 140px 1fr 80px;
          padding: 0.625rem 1rem;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-muted);
          background: var(--color-bg);
          border-bottom: 1px solid var(--color-border);
        }

        .customers-sort-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          border: none;
          background: transparent;
          color: inherit;
          font: inherit;
          text-transform: inherit;
          letter-spacing: inherit;
          cursor: pointer;
          padding: 0;
        }
        .customers-sort-btn:hover { color: var(--color-text); }

        .customers-row {
          display: grid;
          grid-template-columns: 1fr 140px 1fr 80px;
          align-items: center;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--color-border);
          animation: fadeIn 0.3s ease-out forwards;
          opacity: 0;
          transition: background 0.2s;
          font-size: 0.9375rem;
          cursor: pointer;
        }
        .customers-row:last-child { border-bottom: none; }
        .customers-row:hover { background: var(--color-bg); }
        .customers-name-text { font-weight: 600; }

        .customers-phone {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          font-variant-numeric: tabular-nums;
        }
        .customers-notes {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .customers-muted { color: var(--color-text-muted); }

        .customers-pagination {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          margin-top: 0.75rem;
          padding: 0.5rem;
        }
        .customers-page-info {
          font-size: 0.8125rem;
          color: var(--color-text-muted);
        }

        /* Sales history modal */
        .cs-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.45);
          backdrop-filter: blur(4px);
          z-index: 200;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          animation: fadeIn 0.2s;
        }
        .cs-modal {
          background: var(--color-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-xl);
          width: 100%;
          max-width: 480px;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          animation: scaleIn 0.2s ease-out;
        }
        .cs-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.25rem;
          border-bottom: 1px solid var(--color-border-light);
        }
        .cs-modal-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 700;
          font-size: 1rem;
        }
        .cs-modal-title svg { color: var(--color-primary); }
        .cs-modal-body {
          padding: 0.75rem;
          overflow-y: auto;
          flex: 1;
        }

        .cs-sales-list { display: flex; flex-direction: column; gap: 0.25rem; }
        .cs-sales-header {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          padding: 0.5rem 0.75rem;
          font-size: 0.6875rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-muted);
          background: var(--color-bg);
          border-radius: var(--radius-sm);
        }
        .cs-sale-row {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          align-items: center;
          padding: 0.5rem 0.75rem;
          border-bottom: 1px solid var(--color-border-light);
          font-size: 0.8125rem;
          transition: background 0.15s;
        }
        .cs-sale-row:last-child { border-bottom: none; }
        .cs-sale-row:hover { background: var(--color-bg); }
        .cs-sale-date { display: flex; align-items: center; gap: 0.3rem; }
        .cs-sale-amount { display: flex; align-items: center; gap: 0.3rem; font-weight: 600; font-variant-numeric: tabular-nums; }
        .cs-sale-time { color: var(--color-text-muted); }

        @media (max-width: 640px) {
          .customers-table-header { display: none; }
          .customers-row {
            grid-template-columns: 1fr auto;
            gap: 0.1rem 0.5rem;
            padding: 0.625rem 0.75rem;
          }
          .customers-name { grid-column: 1; grid-row: 1; }
          .customers-phone { grid-column: 2; grid-row: 1; justify-content: flex-end; font-size: 0.8125rem; }
          .customers-notes { grid-column: 1; grid-row: 2; font-size: 0.8125rem; }
          .customers-row .num { grid-column: 2; grid-row: 2; }
        }

        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
