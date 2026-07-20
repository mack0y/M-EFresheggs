import { useState, useEffect, useMemo } from 'react';
import {
  Truck,
  Plus,
  AlertTriangle,
  RefreshCw,
  Phone,
  Trash2,
  Pencil,
  X,
  Search,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { fetchSuppliers, addSupplier, updateSupplier, deleteSupplier } from '../lib/api';
import { toast } from '../lib/toastFn';
import { getUserFriendlyError } from '../lib/errors';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import ConfirmDialog from './ConfirmDialog';

const PAGE_SIZE = 50;

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const { isOpen, target: deleteTarget, openConfirm, closeConfirm } = useConfirmDialog();

  const [form, setForm] = useState({ name: '', phone: '', notes: '' });

  // Search & sort
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(0);

  useEffect(() => {
    loadSuppliers();
  }, []);

  async function loadSuppliers() {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchSuppliers();
      setSuppliers(data || []);
    } catch (err) {
      console.error('Suppliers load error:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast('Please enter a supplier name', 'error');
      return;
    }
    setSubmitting(true);
    try {
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, {
          name: form.name.trim(),
          phone: form.phone.trim(),
          notes: form.notes.trim(),
        });
        toast('Supplier updated!');
      } else {
        await addSupplier({
          name: form.name.trim(),
          phone: form.phone.trim(),
          notes: form.notes.trim(),
        });
        toast('Supplier added!');
      }
      setForm({ name: '', phone: '', notes: '' });
      setEditingSupplier(null);
      setShowForm(false);
      loadSuppliers();
    } catch (err) {
      console.error('Save supplier error:', err);
      toast(getUserFriendlyError(err), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(supplier) {
    setEditingSupplier(supplier);
    setForm({
      name: supplier.name || '',
      phone: supplier.phone || '',
      notes: supplier.notes || '',
    });
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingSupplier(null);
    setForm({ name: '', phone: '', notes: '' });
  }

  async function handleDelete(id) {
    try {
      await deleteSupplier(id);
      toast('Supplier removed');
      closeConfirm();
      loadSuppliers();
    } catch (err) {
      console.error('Delete supplier error:', err);
      toast('Failed to remove supplier', 'error');
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
    let list = [...suppliers];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.name?.toLowerCase().includes(q) ||
        s.phone?.toLowerCase().includes(q) ||
        s.notes?.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const aVal = (a[sortField] || '').toLowerCase();
      const bVal = (b[sortField] || '').toLowerCase();
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
    return list;
  }, [suppliers, search, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSuppliers = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="fade-in">
      <div className="page-header-row">
        <div>
          <h1>Suppliers</h1>
          <p className="page-subtitle">Manage your supplier directory</p>
        </div>
        <button className="btn btn-primary" onClick={() => showForm ? cancelForm() : setShowForm(true)}>
          <Plus size={18} />
          {showForm ? 'Cancel' : 'Add Supplier'}
        </button>
      </div>

      {/* Stats */}
      <div className="suppliers-stats">
        <div className="suppliers-stat-card">
          <Truck size={18} />
          <div>
            <span className="suppliers-stat-value">{suppliers.length}</span>
            <span className="suppliers-stat-label">total suppliers</span>
          </div>
        </div>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="card suppliers-form-card">
          <h3 style={{ marginBottom: '1rem' }}>
            {editingSupplier ? 'Edit Supplier' : 'New Supplier'}
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="input-group">
                <label htmlFor="supplier-name">Name *</label>
                <input
                  id="supplier-name"
                  name="name"
                  type="text"
                  className="input"
                  placeholder="e.g. Don Manuel Farms"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                  autoFocus
                />
              </div>
              <div className="input-group">
                <label htmlFor="supplier-phone">Phone</label>
                <input
                  id="supplier-phone"
                  name="phone"
                  type="tel"
                  className="input"
                  placeholder="e.g. 0917-123-4567"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="supplier-notes">Notes</label>
                <input
                  id="supplier-notes"
                  name="notes"
                  type="text"
                  className="input"
                  placeholder="e.g. Bulk supplier, delivers Mon/Wed/Fri"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
                {submitting ? 'Saving...' : editingSupplier ? 'Update Supplier' : 'Add Supplier'}
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
            <strong>Failed to load suppliers</strong>
            <p>{getUserFriendlyError(error)}</p>
          </div>
          <button className="btn btn-sm btn-secondary" onClick={loadSuppliers}>
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      )}

      {/* Search */}
      {!loading && suppliers.length > 0 && (
        <div className="suppliers-search-bar">
          <Search size={16} />
          <input
            type="text"
            className="suppliers-search-input"
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

      {/* Supplier list */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="suppliers-table-header">
          <button className="suppliers-sort-btn" onClick={() => toggleSort('name')}>
            Name {SortIcon('name')}
          </button>
          <button className="suppliers-sort-btn" onClick={() => toggleSort('phone')}>
            Phone {SortIcon('phone')}
          </button>
          <button className="suppliers-sort-btn" onClick={() => toggleSort('notes')}>
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
        ) : pageSuppliers.length === 0 ? (
          <div className="empty-state">
            <Truck size={36} />
            <p>{search ? 'No suppliers match your search.' : 'No suppliers yet. Click "Add Supplier" above to get started.'}</p>
          </div>
        ) : (
          pageSuppliers.map((supplier, i) => (
            <div
              key={supplier.id}
              className="suppliers-row"
              style={{ animationDelay: `${i * 0.025}s` }}
            >
              <div className="suppliers-name">
                <span className="suppliers-name-text">{supplier.name}</span>
              </div>
              <span className="suppliers-phone">
                {supplier.phone ? (
                  <><Phone size={12} />{supplier.phone}</>
                ) : (
                  <span className="suppliers-muted">—</span>
                )}
              </span>
              <span className="suppliers-notes">{supplier.notes || <span className="suppliers-muted">—</span>}</span>
              <span className="num" style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                <button
                  className="btn-icon"
                  onClick={() => startEdit(supplier)}
                  title="Edit supplier"
                >
                  <Pencil size={14} />
                </button>
                <button
                  className="btn-icon btn-icon-danger"
                  onClick={() => openConfirm(supplier)}
                  title="Remove supplier"
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
        <div className="suppliers-pagination">
          <button className="btn btn-sm btn-secondary" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>
            Previous
          </button>
          <span className="suppliers-page-info">
            Page {page + 1} of {totalPages} ({filtered.length} total)
          </span>
          <button className="btn btn-sm btn-secondary" disabled={page >= totalPages - 1} onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}>
            Next
          </button>
        </div>
      )}

      <ConfirmDialog
        open={isOpen}
        title="Remove this supplier?"
        message={deleteTarget ? `Remove "${deleteTarget.name}" from your directory? This cannot be undone.` : ''}
        confirmLabel="Remove"
        variant="danger"
        icon={Trash2}
        onConfirm={() => handleDelete(deleteTarget.id)}
        onCancel={closeConfirm}
      />

      <style>{`
        .suppliers-stats {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.75rem;
          margin-bottom: 1.25rem;
        }

        .suppliers-stat-card {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.875rem 1rem;
          background: var(--color-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-sm);
        }

        .suppliers-stat-card svg { color: var(--color-primary); flex-shrink: 0; }
        .suppliers-stat-value { display: block; font-weight: 700; font-size: 1.0625rem; }
        .suppliers-stat-label { display: block; font-size: 0.75rem; color: var(--color-text-muted); }
        .suppliers-form-card { margin-bottom: 1.25rem; animation: fadeIn 0.3s ease-out; }

        .suppliers-search-bar {
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
        .suppliers-search-input {
          flex: 1;
          border: none;
          background: transparent;
          font-size: 0.875rem;
          color: var(--color-text);
          outline: none;
        }
        .suppliers-search-input::placeholder { color: var(--color-text-muted); }

        .suppliers-table-header {
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

        .suppliers-sort-btn {
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
        .suppliers-sort-btn:hover { color: var(--color-text); }

        .suppliers-row {
          display: grid;
          grid-template-columns: 1fr 140px 1fr 80px;
          align-items: center;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--color-border);
          animation: fadeIn 0.3s ease-out forwards;
          opacity: 0;
          transition: background 0.2s;
          font-size: 0.9375rem;
        }
        .suppliers-row:last-child { border-bottom: none; }
        .suppliers-row:hover { background: var(--color-bg); }
        .suppliers-name-text { font-weight: 600; }

        .suppliers-phone {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          font-variant-numeric: tabular-nums;
        }
        .suppliers-notes {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .suppliers-muted { color: var(--color-text-muted); }

        .suppliers-pagination {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          margin-top: 0.75rem;
          padding: 0.5rem;
        }
        .suppliers-page-info {
          font-size: 0.8125rem;
          color: var(--color-text-muted);
        }

        @media (max-width: 640px) {
          .suppliers-table-header { display: none; }
          .suppliers-row {
            grid-template-columns: 1fr auto;
            gap: 0.1rem 0.5rem;
            padding: 0.625rem 0.75rem;
          }
          .suppliers-name { grid-column: 1; grid-row: 1; }
          .suppliers-phone { grid-column: 2; grid-row: 1; justify-content: flex-end; font-size: 0.8125rem; }
          .suppliers-notes { grid-column: 1; grid-row: 2; font-size: 0.8125rem; }
          .suppliers-row .num { grid-column: 2; grid-row: 2; }
        }
      `}</style>
    </div>
  );
}
