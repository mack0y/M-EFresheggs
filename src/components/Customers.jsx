import { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  AlertTriangle,
  RefreshCw,
  Phone,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { fetchCustomers, addCustomer, deleteCustomer } from '../lib/api';
import { toast } from './Toast';
import { getUserFriendlyError } from '../lib/errors';
import ConfirmDialog from './ConfirmDialog';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [form, setForm] = useState({
    name: '',
    phone: '',
    notes: '',
  });

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
      await addCustomer({
        name: form.name.trim(),
        phone: form.phone.trim(),
        notes: form.notes.trim(),
      });
      toast('Customer added!');
      setForm({ name: '', phone: '', notes: '' });
      setShowForm(false);
      loadCustomers();
    } catch (err) {
      console.error('Add customer error:', err);
      toast('Failed to add customer', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteCustomer(id);
      toast('Customer removed');
      setDeleteTarget(null);
      loadCustomers();
    } catch (err) {
      console.error('Delete customer error:', err);
      toast('Failed to remove customer', 'error');
    }
  }

  return (
    <div className="fade-in">
      <div className="page-header-row">
        <div>
          <h1>Customers</h1>
          <p className="page-subtitle">Manage your customer directory</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
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

      {/* Add form */}
      {showForm && (
        <div className="card customers-form-card">
          <h3 style={{ marginBottom: '1rem' }}>
            <UserPlus size={18} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
            New Customer
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
            <button
              type="submit"
              className="btn btn-primary btn-block"
              style={{ marginTop: '1rem' }}
              disabled={submitting}
            >
              {submitting ? 'Adding...' : 'Add Customer'}
            </button>
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

      {/* Customer list */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="customers-table-header">
          <span>Name</span>
          <span>Phone</span>
          <span>Notes</span>
          <span className="num"></span>
        </div>
        {loading ? (
          <div className="loading-list">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 52, margin: '0.25rem 1rem', borderRadius: 4 }}>
                &nbsp;
              </div>
            ))}
          </div>
        ) : customers.length === 0 ? (
          <div className="empty-state">
            <Users size={36} />
            <p>No customers yet. Click "Add Customer" above to get started.</p>
          </div>
        ) : (
          customers.map((customer, i) => (
            <div
              key={customer.id}
              className="customers-row"
              style={{ animationDelay: `${i * 0.025}s` }}
            >
              <div className="customers-name">
                <span className="customers-name-text">{customer.name}</span>
              </div>
              <span className="customers-phone">
                {customer.phone ? (
                  <>
                    <Phone size={12} />
                    {customer.phone}
                  </>
                ) : (
                  <span className="customers-muted">—</span>
                )}
              </span>
              <span className="customers-notes">{customer.notes || <span className="customers-muted">—</span>}</span>
              <span className="num">
                <button
                  className="btn-icon btn-icon-danger"
                  onClick={() => setDeleteTarget(customer)}
                  title="Remove customer"
                >
                  <Trash2 size={16} />
                </button>
              </span>
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove this customer?"
        message={deleteTarget ? `Remove "${deleteTarget.name}" from your directory? This cannot be undone.` : ''}
        confirmLabel="Remove"
        variant="danger"
        icon={Trash2}
        onConfirm={() => handleDelete(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
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

        .customers-stat-value {
          display: block;
          font-weight: 700;
          font-size: 1.0625rem;
        }

        .customers-stat-label {
          display: block;
          font-size: 0.75rem;
          color: var(--color-text-muted);
        }

        .customers-form-card {
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

        .customers-table-header {
          display: grid;
          grid-template-columns: 1fr 140px 1fr 40px;
          padding: 0.625rem 1rem;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-muted);
          background: var(--color-bg);
          border-bottom: 1px solid var(--color-border);
        }

        .customers-row {
          display: grid;
          grid-template-columns: 1fr 140px 1fr 40px;
          align-items: center;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--color-border);
          animation: fadeIn 0.3s ease-out forwards;
          opacity: 0;
          transition: background 0.2s;
          font-size: 0.9375rem;
        }

        .customers-row:last-child { border-bottom: none; }
        .customers-row:hover { background: var(--color-bg); }

        .customers-name-text {
          font-weight: 600;
        }

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

        .customers-muted {
          color: var(--color-text-muted);
        }

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

        .num { text-align: right; }

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
          .customers-table-header { display: none; }
          .customers-row {
            grid-template-columns: 1fr auto;
            gap: 0.1rem 0.5rem;
            padding: 0.625rem 0.75rem;
          }
          .customers-name {
            grid-column: 1; grid-row: 1;
          }
          .customers-phone {
            grid-column: 2; grid-row: 1;
            justify-content: flex-end;
            font-size: 0.8125rem;
          }
          .customers-notes {
            grid-column: 1; grid-row: 2;
            font-size: 0.8125rem;
          }
          .customers-row .num {
            grid-column: 2; grid-row: 2;
          }
        }
      `}</style>
    </div>
  );
}
