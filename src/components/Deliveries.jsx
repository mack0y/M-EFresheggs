import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck,
  Plus,
  AlertTriangle,
  RefreshCw,
  Package,
  Calendar,
  DollarSign,
  CheckCircle,
  Clock,
  Trash2,
  Edit3,
} from 'lucide-react';
import {
  fetchDeliveries,
  recordDelivery,
  deleteDelivery,
  updateDeliveryPayment,
  fetchSuppliers,
  fetchInventory,
  PAYMENT_STATUSES,
  formatPeso,
  toTraysAndPieces,
  TRAY_SIZE,
  getLocalDate,
} from '../lib/api';
import { toast } from './Toast';
import { getUserFriendlyError } from '../lib/errors';
import ConfirmDialog from './ConfirmDialog';

export default function Deliveries() {
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);
  const [confirmItem, setConfirmItem] = useState(null);

  const today = getLocalDate();

  const [form, setForm] = useState({
    supplierId: '',
    eggSizeId: '',
    quantity: '',
    unit: 'tray',
    costPerEgg: '',
    paymentStatus: 'unpaid',
    notes: '',
    date: today,
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const [delData, suppData, invData] = await Promise.all([
        fetchDeliveries({ limit: 200 }),
        fetchSuppliers(),
        fetchInventory(),
      ]);
      setDeliveries(delData || []);
      setSuppliers(suppData || []);
      setInventory(invData || []);
    } catch (err) {
      console.error('Deliveries load error:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  function calculateTotalCost() {
    const qty = parseInt(form.quantity, 10);
    const costPerEgg = parseFloat(form.costPerEgg);
    if (isNaN(qty) || isNaN(costPerEgg) || qty <= 0 || costPerEgg < 0) return 0;
    const eggCount = form.unit === 'tray' ? qty * TRAY_SIZE : qty;
    return eggCount * costPerEgg;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.supplierId || !form.eggSizeId || !form.quantity) {
      toast('Please fill in supplier, egg size, and quantity', 'error');
      return;
    }
    const qty = parseInt(form.quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      toast('Please enter a valid quantity', 'error');
      return;
    }
    if (!form.costPerEgg || parseFloat(form.costPerEgg) < 0) {
      toast('Please enter a valid cost per egg', 'error');
      return;
    }
    setConfirmItem({ ...form, quantity: qty });
  }


  async function executeDelivery(data) {
    setSubmitting(true);
    try {
      const eggCount = data.unit === 'tray' ? data.quantity * TRAY_SIZE : data.quantity;
      await recordDelivery({
        supplierId: parseInt(data.supplierId, 10),
        eggSizeId: parseInt(data.eggSizeId, 10),
        quantity: data.quantity,
        unit: data.unit,
        traySize: TRAY_SIZE,
        costPerEgg: parseFloat(data.costPerEgg),
        totalCost: eggCount * parseFloat(data.costPerEgg),
        paymentStatus: data.paymentStatus,
        notes: data.notes.trim(),
        deliveryDate: data.date,
      });
      toast('Delivery recorded!');
      setForm({
        supplierId: '',
        eggSizeId: '',
        quantity: '',
        unit: 'tray',
        costPerEgg: '',
        paymentStatus: 'unpaid',
        notes: '',
        date: today,
      });
      setShowForm(false);
      loadData();
    } catch (err) {
      console.error('Delivery record error:', err);
      toast('Failed to record delivery', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteDelivery(id) {
    try {
      await deleteDelivery(id);
      toast('Delivery removed');
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      console.error('Delete delivery error:', err);
      toast('Failed to remove delivery', 'error');
    }
  }

  async function handlePaymentUpdate(id, status) {
    try {
      await updateDeliveryPayment(id, status);
      toast(`Payment marked as ${status}`);
      setEditingPayment(null);
      loadData();
    } catch (err) {
      console.error('Update payment error:', err);
      toast('Failed to update payment status', 'error');
    }
  }

  const totalCostAll = deliveries.reduce((sum, d) => sum + parseFloat(d.total_cost || 0), 0);
  const unpaidTotal = deliveries
    .filter(d => d.payment_status === 'unpaid')
    .reduce((sum, d) => sum + parseFloat(d.total_cost || 0), 0);
  const todayDeliveries = deliveries.filter(d => d.delivery_date === today);
  const todayCost = todayDeliveries.reduce((sum, d) => sum + parseFloat(d.total_cost || 0), 0);

  const paymentBreakdown = {};
  PAYMENT_STATUSES.forEach(status => {
    paymentBreakdown[status] = {
      count: deliveries.filter(d => d.payment_status === status).length,
      total: deliveries.filter(d => d.payment_status === status).reduce((sum, d) => sum + parseFloat(d.total_cost || 0), 0),
    };
  });

  function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    if (dateStr === today) return 'Today';
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (dateStr === getLocalDate(yesterday)) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function formatQuantity(delivery) {
    const totalEggs = delivery.unit === 'tray'
      ? delivery.quantity * (delivery.tray_size || TRAY_SIZE)
      : delivery.quantity;
    const { trays, pieces } = toTraysAndPieces(totalEggs);
    if (trays === 0) return `${pieces} pcs`;
    if (pieces === 0) return `${trays} tray${trays > 1 ? 's' : ''}`;
    return `${trays}t + ${pieces}p`;
  }

  const paymentColors = {
    unpaid: { bg: '#FFF3E0', color: '#E65100' },
    partial: { bg: '#FFF8E1', color: '#F57F17' },
    paid: { bg: '#E8F5E9', color: '#2E7D32' },
  };

  return (
    <div className="fade-in">
      <div className="page-header-row">
        <div>
          <h1>Deliveries</h1>
          <p className="page-subtitle">Track supplier egg deliveries</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowForm(!showForm)}
        >
          <Plus size={18} />
          {showForm ? 'Cancel' : 'Record Delivery'}
        </button>
      </div>

      {/* Stats */}
      <div className="delivery-stats">
        <div className="delivery-stat-card">
          <Truck size={18} />
          <div>
            <span className="delivery-stat-value">{deliveries.length}</span>
            <span className="delivery-stat-label">total deliveries</span>
          </div>
        </div>
        <div className="delivery-stat-card">
          <DollarSign size={18} />
          <div>
            <span className="delivery-stat-value">{formatPeso(totalCostAll)}</span>
            <span className="delivery-stat-label">total cost</span>
          </div>
        </div>
        <div className="delivery-stat-card">
          <Clock size={18} />
          <div>
            <span className="delivery-stat-value">{formatPeso(unpaidTotal)}</span>
            <span className="delivery-stat-label">unpaid</span>
          </div>
        </div>
        <div className="delivery-stat-card">
          <Calendar size={18} />
          <div>
            <span className="delivery-stat-value">{todayDeliveries.length}</span>
            <span className="delivery-stat-label">today · {formatPeso(todayCost)}</span>
          </div>
        </div>
      </div>

      {/* Payment breakdown */}
      {deliveries.length > 0 && (
        <div className="delivery-breakdown">
          {Object.entries(paymentBreakdown)
            .filter(([, data]) => data.count > 0)
            .map(([status, data]) => (
              <div key={status} className="delivery-breakdown-item">
                <span className="delivery-breakdown-badge" style={{ background: paymentColors[status].bg, color: paymentColors[status].color }}>
                  {status}
                </span>
                <span className="delivery-breakdown-count">{data.count}</span>
                <span className="delivery-breakdown-total">{formatPeso(data.total)}</span>
              </div>
            ))}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="card delivery-form-card">
          <h3 style={{ marginBottom: '1rem' }}>
            <Package size={18} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
            Record Delivery
          </h3>
          {suppliers.length === 0 ? (
            <div className="delivery-no-suppliers">
              <p>You need to add a supplier first.</p>
              <button className="btn btn-primary" onClick={() => navigate('/suppliers')}>
                Go to Suppliers
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="input-group">
                  <label htmlFor="delivery-supplier">Supplier</label>
                  <select
                    id="delivery-supplier"
                    name="supplierId"
                    className="select"
                    value={form.supplierId}
                    onChange={e => setForm({ ...form, supplierId: e.target.value })}
                    required
                  >
                    <option value="">Select supplier...</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div className="input-group">
                  <label htmlFor="delivery-egg-size">Egg Size</label>
                  <select
                    id="delivery-egg-size"
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
                          {item.egg_sizes?.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="input-group">
                  <label htmlFor="delivery-unit">Unit</label>
                  <select
                    id="delivery-unit"
                    name="unit"
                    className="select"
                    value={form.unit}
                    onChange={e => setForm({ ...form, unit: e.target.value })}
                  >
                    <option value="tray">Tray (30 eggs)</option>
                    <option value="piece">Piece</option>
                  </select>
                </div>
                <div className="input-group">
                  <label htmlFor="delivery-quantity">Quantity</label>
                  <input
                    id="delivery-quantity"
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
                <div className="input-group">
                  <label htmlFor="delivery-cost">Cost per Egg (₱)</label>
                  <input
                    id="delivery-cost"
                    name="costPerEgg"
                    type="number"
                    className="input"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.costPerEgg}
                    onChange={e => setForm({ ...form, costPerEgg: e.target.value })}
                    required
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="delivery-date">Date</label>
                  <input
                    id="delivery-date"
                    name="date"
                    type="date"
                    className="input"
                    value={form.date}
                    onChange={e => setForm({ ...form, date: e.target.value })}
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="delivery-payment">Payment Status</label>
                  <select
                    id="delivery-payment"
                    name="paymentStatus"
                    className="select"
                    value={form.paymentStatus}
                    onChange={e => setForm({ ...form, paymentStatus: e.target.value })}
                  >
                    {PAYMENT_STATUSES.map(status => (
                      <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="delivery-notes">Notes</label>
                  <input
                    id="delivery-notes"
                    name="notes"
                    type="text"
                    className="input"
                    placeholder="e.g. Good quality, some cracked eggs"
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
              </div>

              {/* Cost preview */}
              {form.quantity && form.costPerEgg && (
                <div className="delivery-cost-preview">
                  <span>Total Cost:</span>
                  <strong>{formatPeso(calculateTotalCost())}</strong>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-block"
                style={{ marginTop: '1rem' }}
                disabled={submitting}
              >
                {submitting ? 'Recording...' : 'Review & Record'}
              </button>
            </form>
          )}
        </div>
      )}

      {error && !loading && (
        <div className="error-banner" style={{ marginBottom: '1rem' }}>
          <AlertTriangle size={20} />
          <div className="error-banner-content">
            <strong>Failed to load deliveries</strong>
            <p>{getUserFriendlyError(error)}</p>
          </div>
          <button className="btn btn-sm btn-secondary" onClick={loadData}>
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      )}

      {/* Delivery list */}
      <div className="card" style={{ padding: 0 }}>
        <div className="delivery-table-header">
          <span>Date</span>
          <span>Supplier</span>
          <span>Size</span>
          <span>Qty</span>
          <span>Cost</span>
          <span>Payment</span>
          <span className="num"></span>
        </div>
        {loading ? (
          <div className="loading-list">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 44, margin: '0.25rem 1rem', borderRadius: 4 }}>
                &nbsp;
              </div>
            ))}
          </div>
        ) : deliveries.length === 0 ? (
          <div className="empty-state">
            <Truck size={36} />
            <p>No deliveries recorded yet</p>
          </div>
        ) : (
          deliveries.map((delivery, i) => (
            <div
              key={delivery.id}
              className="delivery-row"
              style={{ animationDelay: `${i * 0.025}s` }}
            >
              <span className="delivery-date">{formatDate(delivery.delivery_date)}</span>
              <span className="delivery-supplier">{delivery.suppliers?.name || 'Unknown'}</span>
              <span className="delivery-size">{delivery.egg_sizes?.name || 'Unknown'}</span>
              <span className="delivery-qty">{formatQuantity(delivery)}</span>
              <span className="delivery-cost">{formatPeso(delivery.total_cost)}</span>
              <span className="delivery-payment">
                <span
                  className="delivery-payment-badge"
                  style={{
                    background: paymentColors[delivery.payment_status]?.bg,
                    color: paymentColors[delivery.payment_status]?.color,
                  }}
                >
                  {delivery.payment_status}
                </span>
              </span>
              <span className="num">
                <div className="delivery-actions">
                  <button
                    className="btn-icon"
                    onClick={() => setEditingPayment(editingPayment === delivery.id ? null : delivery.id)}
                    title="Update payment"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    className="btn-icon btn-icon-danger"
                    onClick={() => setDeleteTarget(delivery)}
                    title="Delete delivery"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </span>

              {/* Payment update dropdown */}
              {editingPayment === delivery.id && (
                <div className="delivery-payment-dropdown">
                  {PAYMENT_STATUSES.map(status => (
                    <button
                      key={status}
                      className={`delivery-payment-option ${delivery.payment_status === status ? 'active' : ''}`}
                      onClick={() => handlePaymentUpdate(delivery.id, status)}
                    >
                      {status === 'paid' && <CheckCircle size={14} />}
                      {status === 'partial' && <Clock size={14} />}
                      {status === 'unpaid' && <AlertTriangle size={14} />}
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={!!confirmItem}
        title="Record this delivery?"
        message={confirmItem
          ? `Record ${confirmItem.quantity} ${confirmItem.unit === 'tray' ? 'tray(s)' : 'egg(s)'} of ${inventory.find(i => i.egg_size_id === parseInt(confirmItem.eggSizeId, 10))?.egg_sizes?.name || 'Unknown'} from ${suppliers.find(s => s.id === parseInt(confirmItem.supplierId, 10))?.name || 'Unknown'}?`
          : ''}
        confirmLabel="Record"
        variant="primary"
        icon={Truck}
        onConfirm={() => {
          const data = confirmItem;
          setConfirmItem(null);
          executeDelivery(data);
        }}
        onCancel={() => setConfirmItem(null)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this delivery?"
        message={deleteTarget
          ? `Delete the ${deleteTarget.suppliers?.name || 'Unknown'} delivery of ${deleteTarget.egg_sizes?.name || 'Unknown'} eggs? This cannot be undone.`
          : ''}
        confirmLabel="Delete"
        variant="danger"
        icon={Trash2}
        onConfirm={() => handleDeleteDelivery(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />

      <style>{`
        .delivery-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
          margin-bottom: 1.25rem;
        }

        .delivery-stat-card {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.875rem 1rem;
          background: var(--color-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-sm);
        }

        .delivery-stat-card svg { color: var(--color-primary); flex-shrink: 0; }

        .delivery-stat-value {
          display: block;
          font-weight: 700;
          font-size: 1.0625rem;
        }

        .delivery-stat-label {
          display: block;
          font-size: 0.75rem;
          color: var(--color-text-muted);
        }

        .delivery-breakdown {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .delivery-breakdown-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: var(--color-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          font-size: 0.8125rem;
        }

        .delivery-breakdown-badge {
          display: inline-block;
          padding: 0.2rem 0.5rem;
          border-radius: 999px;
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: capitalize;
        }

        .delivery-breakdown-count {
          font-weight: 600;
          color: var(--color-text-secondary);
        }

        .delivery-breakdown-total {
          font-weight: 700;
          color: var(--color-primary);
        }

        .delivery-form-card {
          margin-bottom: 1.25rem;
          animation: fadeIn 0.3s ease-out;
        }

        .delivery-no-suppliers {
          text-align: center;
          padding: 1.5rem;
          color: var(--color-text-muted);
        }

        .delivery-cost-preview {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          margin-top: 1rem;
          background: var(--color-primary-50);
          border-radius: var(--radius-md);
          font-size: 0.9375rem;
        }

        .delivery-cost-preview strong {
          color: var(--color-primary);
          font-size: 1.0625rem;
        }

        .delivery-table-header {
          display: grid;
          grid-template-columns: 70px 1fr 80px 80px 90px 80px 60px;
          padding: 0.625rem 1rem;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-muted);
          background: var(--color-bg);
          border-bottom: 1px solid var(--color-border);
        }

        .delivery-row {
          display: grid;
          grid-template-columns: 70px 1fr 80px 80px 90px 80px 60px;
          align-items: center;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--color-border);
          animation: fadeIn 0.3s ease-out forwards;
          opacity: 0;
          transition: background 0.2s;
          font-size: 0.9375rem;
          position: relative;
        }

        .delivery-row:last-child { border-bottom: none; }
        .delivery-row:hover { background: var(--color-bg); }

        .delivery-date {
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
        }

        .delivery-supplier {
          font-weight: 500;
        }

        .delivery-size {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
        }

        .delivery-qty {
          font-weight: 600;
          font-variant-numeric: tabular-nums;
        }

        .delivery-cost {
          font-weight: 600;
          color: var(--color-primary);
          font-variant-numeric: tabular-nums;
        }

        .delivery-payment-badge {
          display: inline-block;
          padding: 0.2rem 0.5rem;
          border-radius: 999px;
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: capitalize;
        }

        .delivery-actions {
          display: flex;
          gap: 0.25rem;
          justify-content: flex-end;
        }

        .delivery-payment-dropdown {
          position: absolute;
          right: 1rem;
          top: 100%;
          background: var(--color-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-lg);
          z-index: 10;
          padding: 0.375rem;
          animation: scaleIn 0.15s ease-out;
        }

        .delivery-payment-option {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: none;
          background: transparent;
          color: var(--color-text-secondary);
          font-size: 0.8125rem;
          font-weight: 500;
          border-radius: var(--radius-sm);
          cursor: pointer;
          text-transform: capitalize;
          transition: all 0.15s;
        }

        .delivery-payment-option:hover {
          background: var(--color-primary-50);
          color: var(--color-primary);
        }

        .delivery-payment-option.active {
          background: var(--color-primary);
          color: white;
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
          .delivery-table-header { display: none; }
          .delivery-row {
            grid-template-columns: 1fr auto;
            gap: 0.1rem 0.5rem;
            padding: 0.625rem 0.75rem;
          }
          .delivery-date {
            grid-column: 1; grid-row: 1;
            font-size: 0.6875rem;
            color: var(--color-text-muted);
          }
          .delivery-supplier {
            grid-column: 2; grid-row: 1;
          }
          .delivery-size {
            grid-column: 1; grid-row: 2;
            font-size: 0.8125rem;
          }
          .delivery-qty {
            grid-column: 2; grid-row: 2;
            text-align: right;
          }
          .delivery-cost {
            grid-column: 1; grid-row: 3;
            font-size: 0.875rem;
          }
          .delivery-payment {
            grid-column: 2; grid-row: 3;
            text-align: right;
          }
          .delivery-row .num {
            grid-column: 1 / -1; grid-row: 4;
            text-align: right;
          }
          .delivery-actions { justify-content: flex-end; }
          .delivery-stats { grid-template-columns: 1fr; }
        }

        @media (min-width: 640px) {
          .delivery-stats { grid-template-columns: 1fr 1fr; }
        }

        @media (min-width: 900px) {
          .delivery-stats { grid-template-columns: 1fr 1fr 1fr 1fr; }
        }
      `}</style>
    </div>
  );
}
