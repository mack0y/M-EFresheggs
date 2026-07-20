import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck,
  Plus,
  AlertTriangle,
  RefreshCw,
  DollarSign,
  Calendar,
  CheckCircle,
  Clock,
  Trash2,
  Edit3,
  Search,
} from 'lucide-react';
import { fetchProductDeliveries, recordProductDelivery, updateProductDeliveryPayment, deleteProductDelivery, fetchProducts, fetchSuppliers, formatPeso, PAYMENT_STATUSES, getLocalDate } from '../lib/api';
import { toast } from '../lib/toastFn';
import { getUserFriendlyError } from '../lib/errors';
import ConfirmDialog from './ConfirmDialog';

const paymentColors = {
  unpaid: { bg: '#FFF3E0', color: '#E65100' },
  partial: { bg: '#FFF8E1', color: '#F57F17' },
  paid: { bg: '#E8F5E9', color: '#2E7D32' },
};

export default function ProductDeliveries() {
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);
  const [paymentStatusInput, setPaymentStatusInput] = useState('unpaid');
  const [partialAmountInput, setPartialAmountInput] = useState("0");
  const [searchQuery, setSearchQuery] = useState('');
  const today = getLocalDate();

  const [form, setForm] = useState({
    supplierId: '',
    items: [],
    paymentStatus: 'unpaid',
    notes: '',
    date: today,
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [delData, prodData, suppData] = await Promise.all([
        fetchProductDeliveries({ limit: 500, offset: 0 }),
        fetchProducts(),
        fetchSuppliers(),
      ]);
      setDeliveries(delData || []);
      setSuppliers(suppData || []);

      // Initialize form items when products load
      if (prodData && prodData.length > 0) {
        setForm(prev => ({
          ...prev,
          items: prodData.map(p => ({
            productId: p.id,
            name: p.name,
            unit: p.purchase_unit || 'units',
            quantity: '',
            costPerUnit: '',
          })),
        }));
      }
    } catch (err) {
      console.error('Product deliveries load error:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => loadData(), 0);
    return () => clearTimeout(id);
  }, [loadData]);

  function updateItem(index, field, value) {
    setForm(prev => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  }

  function activeItems() {
    return form.items.filter(i => parseFloat(i.quantity) > 0);
  }

  function calculateBatchTotal() {
    return form.items.reduce((sum, i) => {
      const qty = parseFloat(i.quantity) || 0;
      const cost = parseFloat(i.costPerUnit) || 0;
      return sum + (qty * cost);
    }, 0);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.supplierId) { toast('Please select a supplier', 'error'); return; }
    const active = activeItems();
    if (active.length === 0) { toast('Enter quantity for at least one product', 'error'); return; }
    for (const item of active) {
      if (!item.costPerUnit || parseFloat(item.costPerUnit) < 0) {
        toast(`Enter cost per unit for ${item.name}`, 'error');
        return;
      }
    }

    setSubmitting(true);
    const createdIds = [];
    try {
      for (const item of active) {
        const newDelivery = await recordProductDelivery({
          supplierId: parseInt(form.supplierId, 10),
          productId: parseInt(item.productId, 10),
          purchaseQuantity: parseFloat(item.quantity),
          costPerPurchaseUnit: parseFloat(item.costPerUnit),
          deliveryDate: form.date,
          notes: form.notes.trim(),
          paymentStatus: form.paymentStatus,
        });
        if (newDelivery?.id) createdIds.push(newDelivery.id);
      }
      toast(`Delivery recorded (${active.length} product${active.length > 1 ? 's' : ''})`, 'success', {
        label: 'Undo',
        onClick: async () => {
          try {
            const results = await Promise.allSettled(createdIds.map(id => deleteProductDelivery(id)));
            const succeeded = results.filter(r => r.status === 'fulfilled').length;
            toast(succeeded > 0 ? `Undone ${succeeded} delivery(ies)` : 'Failed to undo', succeeded > 0 ? 'success' : 'error');
            loadData();
          } catch {
            toast('Failed to undo', 'error');
          }
        },
      });
      setForm(prev => ({
        ...prev,
        supplierId: '',
        items: prev.items.map(i => ({ ...i, quantity: '', costPerUnit: '' })),
        paymentStatus: 'unpaid',
        notes: '',
        date: today,
      }));
      setShowForm(false);
      loadData();
    } catch (err) {
      console.error('Product delivery error:', err);
      toast('Failed to record delivery', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteProductDelivery(id);
      toast('Delivery removed');
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      console.error('Delete error:', err);
      toast('Failed to delete delivery', 'error');
    }
  }

  async function handlePaymentUpdate(delivery, amount) {
    try {
      const totalCost = parseFloat(delivery.total_cost || 0);
      const paid = Math.min(parseFloat(amount || 0), totalCost);
      // Derive status from the actual amount paid
      const status = paid >= totalCost ? 'paid' : (paid > 0 ? 'partial' : 'unpaid');

      let finalAmount;
      if (status === 'paid') {
        finalAmount = totalCost;
      } else if (status === 'unpaid') {
        finalAmount = 0;
      } else {
        finalAmount = paid;
      }

      await updateProductDeliveryPayment(delivery.id, status, finalAmount);
      toast(`Payment updated: ${formatPeso(finalAmount)} paid (${status})`);
      setEditingPayment(null);
      setPartialAmountInput("0");
      loadData();
    } catch (err) {
      console.error('Payment update error:', err);
      toast('Failed to update payment', 'error');
    }
  }

  const filtered = deliveries.filter(d => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (d.suppliers?.name || '').toLowerCase().includes(q) || (d.products?.name || '').toLowerCase().includes(q);
  });

  const totalCostAll = deliveries.reduce((sum, d) => sum + parseFloat(d.total_cost || 0), 0);
  const amountPaidTotal = deliveries.reduce((sum, d) => sum + parseFloat(d.amount_paid || 0), 0);
  const todayDeliveries = deliveries.filter(d => d.delivery_date === today);
  const todayCost = todayDeliveries.reduce((sum, d) => sum + parseFloat(d.total_cost || 0), 0);

  const paymentBreakdown = {};
  PAYMENT_STATUSES.forEach(status => {
    paymentBreakdown[status] = {
      count: deliveries.filter(d => d.payment_status === status).length,
      total: deliveries.filter(d => d.payment_status === status).reduce((sum, d) => sum + parseFloat(d.total_cost || 0), 0),
      paid: deliveries.filter(d => d.payment_status === status).reduce((sum, d) => sum + parseFloat(d.amount_paid || 0), 0),
    };
  });

  return (
    <div className="fade-in">
      <div className="page-header-row">
        <div>
          <h1>Product Deliveries</h1>
          <p className="page-subtitle">Track supplier product orders</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={18} />
          {showForm ? 'Cancel' : 'Record Delivery'}
        </button>
      </div>

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
          <CheckCircle size={18} />
          <div>
            <span className="delivery-stat-value">{formatPeso(amountPaidTotal)}</span>
            <span className="delivery-stat-label">amount paid</span>
          </div>
        </div>
        <div className="delivery-stat-card">
          <Clock size={18} />
          <div>
            <span className="delivery-stat-value">{formatPeso(totalCostAll - amountPaidTotal)}</span>
            <span className="delivery-stat-label">remaining unpaid</span>
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

      {deliveries.length > 0 && (
        <div className="delivery-breakdown">
          {Object.entries(paymentBreakdown)
            .filter(([, data]) => data.count > 0)
            .map(([status, data]) => (
              <div key={status} className="delivery-breakdown-item">
                <span className="delivery-breakdown-badge" style={{ background: paymentColors[status].bg, color: paymentColors[status].color }}>{status}</span>
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
            <Truck size={18} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
            Record Product Delivery
          </h3>
          {suppliers.length === 0 ? (
            <div className="delivery-no-suppliers">
              <p>Add a supplier first.</p>
              <button className="btn btn-primary" onClick={() => navigate('/suppliers')}>Go to Suppliers</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="input-group">
                  <label htmlFor="pdel-supplier">Supplier</label>
                  <select id="pdel-supplier" className="select" value={form.supplierId} onChange={e => setForm({ ...form, supplierId: e.target.value })} required>
                    <option value="">Select supplier...</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label htmlFor="pdel-date">Date</label>
                  <input id="pdel-date" type="date" className="input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                </div>
                <div className="input-group">
                  <label htmlFor="pdel-payment">Payment Status</label>
                  <select id="pdel-payment" className="select" value={form.paymentStatus} onChange={e => setForm({ ...form, paymentStatus: e.target.value })}>
                    {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
              </div>

              {/* Product grid */}
              <div className="delivery-sizes-grid">
                <div className="delivery-sizes-header" style={{ gridTemplateColumns: '1fr 90px 110px 100px' }}>
                  <span className="delivery-sizes-label">Product</span>
                  <span className="delivery-sizes-label">Qty</span>
                  <span className="delivery-sizes-label">Cost/Unit</span>
                  <span className="delivery-sizes-label num">Subtotal</span>
                </div>
                {form.items.length === 0 ? (
                  <div className="delivery-size-row" style={{ gridTemplateColumns: '1fr', textAlign: 'center', color: 'var(--color-text-muted)', padding: '1rem' }}>
                    No products in catalog. Add products first.
                  </div>
                ) : (
                  form.items.map((item, i) => {
                    const subtotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.costPerUnit) || 0);
                    return (
                      <div key={item.productId} className="delivery-size-row" style={{ gridTemplateColumns: '1fr 90px 110px 100px' }}>
                        <span className="delivery-size-name">
                          {item.name}
                          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginLeft: '0.25rem' }}>
                            ({item.unit})
                          </span>
                        </span>
                        <input
                          type="number"
                          className="input delivery-size-input"
                          min="0"
                          step="any"
                          placeholder="0"
                          value={item.quantity}
                          onChange={e => updateItem(i, 'quantity', e.target.value)}
                        />
                        <input
                          type="number"
                          className="input delivery-size-input"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={item.costPerUnit}
                          onChange={e => updateItem(i, 'costPerUnit', e.target.value)}
                        />
                        <span className="delivery-size-subtotal num">
                          {subtotal > 0 ? formatPeso(subtotal) : '—'}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="input-group" style={{ marginTop: '0.75rem' }}>
                <label htmlFor="pdel-notes">Notes</label>
                <input id="pdel-notes" type="text" className="input" placeholder="Optional notes..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
              </div>

              {activeItems().length > 0 && (
                <div className="delivery-cost-preview">
                  <span>Total Cost ({activeItems().length} product{activeItems().length > 1 ? 's' : ''}):</span>
                  <strong>{formatPeso(calculateBatchTotal())}</strong>
                </div>
              )}

              <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: '1rem' }} disabled={submitting}>
                {submitting ? 'Recording...' : activeItems().length > 0 ? `Record ${activeItems().length} Product${activeItems().length > 1 ? 's' : ''}` : 'Review & Record'}
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
          <button className="btn btn-sm btn-secondary" onClick={loadData}><RefreshCw size={14} /> Retry</button>
        </div>
      )}

      <div className="delivery-controls">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input type="text" className="input" placeholder="Search supplier or product..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <span className="delivery-count">Showing {filtered.length} delivery{filtered.length !== 1 ? 'ies' : ''}</span>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="delivery-table-header" style={{ gridTemplateColumns: '70px 1fr 1fr 80px 90px 80px 60px' }}>
          <span>Date</span>
          <span>Supplier</span>
          <span>Product</span>
          <span>Qty</span>
          <span>Cost</span>
          <span>Payment</span>
          <span className="num"></span>
        </div>

        {loading ? (
          <div className="loading-list">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 44, margin: '0.25rem 1rem', borderRadius: 4 }}>&nbsp;</div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Truck size={36} />
            <p>No product deliveries yet</p>
            <p style={{ fontSize: '0.8125rem', marginTop: '-0.25rem' }}>Click "Record Delivery" to get started</p>
          </div>
        ) : (
          filtered.map((d, i) => {
            const bpStyle = paymentColors[d.payment_status] || paymentColors.unpaid;
            return (
              <div key={d.id} className="delivery-batch" style={{ animationDelay: `${i * 0.03}s` }}>
                <div className="delivery-row" style={{ gridTemplateColumns: '70px 1fr 1fr 80px 90px 80px 60px' }}>
                  <span className="delivery-date">{d.delivery_date?.slice(5) || d.delivery_date}</span>
                  <span className="delivery-supplier">{d.suppliers?.name || 'Unknown'}</span>
                  <span className="delivery-sizes-summary">{d.products?.name || 'Unknown'}</span>
                  <span className="delivery-qty">{parseFloat(d.purchase_quantity || 0).toLocaleString()} {d.products?.purchase_unit || ''}</span>
                  <span className="delivery-cost">{formatPeso(d.total_cost)}</span>
                  <span className="delivery-payment">
                    <span className="delivery-payment-badge" style={{ background: bpStyle.bg, color: bpStyle.color }}>
                      {d.payment_status}
                    </span>
                    <span className="delivery-payment-amount" style={{ fontSize: '0.7rem', color: bpStyle.color, marginLeft: '0.3rem' }}>
                      {formatPeso(parseFloat(d.amount_paid || 0))} / {formatPeso(parseFloat(d.total_cost || 0))}
                    </span>
                  </span>
                  <span className="num">
                    <div className="delivery-actions">
                      <button className="btn-icon" onClick={() => { setEditingPayment(editingPayment === d.id ? null : d.id); setPaymentStatusInput(d.payment_status || 'unpaid'); setPartialAmountInput(parseFloat(d.amount_paid || 0).toString()); }} title="Update payment">
                        <Edit3 size={14} />
                      </button>
                      <button className="btn-icon btn-icon-danger" onClick={() => setDeleteTarget(d)} title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </span>
                </div>

                {editingPayment === d.id && (
                  <div className="delivery-payment-dropdown">
                    {PAYMENT_STATUSES.map(status => (
                      <button key={status} className={`delivery-payment-option ${paymentStatusInput === status ? 'active' : ''}`} onClick={() => {
                        setPaymentStatusInput(status);
                        if (status === 'paid') setPartialAmountInput(parseFloat(d.total_cost || 0).toFixed(2));
                        if (status === 'unpaid') setPartialAmountInput("0");
                      }}>
                        {status === 'paid' && <CheckCircle size={14} />}
                        {status === 'partial' && <Clock size={14} />}
                        {status === 'unpaid' && <AlertTriangle size={14} />}
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </button>
                    ))}
                    <div className="delivery-amount-input">
                      <label>Amount Paid: ₱</label>
                      <input type="number" min="0" step="0.01" value={partialAmountInput} onChange={e => {
                        const raw = e.target.value;
                        if (raw === '') { setPartialAmountInput(''); return; }
                        const parsed = parseFloat(raw);
                        if (!isNaN(parsed)) {
                          setPartialAmountInput(Math.min(parsed, parseFloat(d.total_cost || 0)).toString());
                        }
                      }} placeholder="0.00" />
                    </div>
                    <button className="btn btn-primary btn-sm" style={{ marginTop: '0.5rem' }} onClick={() => handlePaymentUpdate(d, parseFloat(partialAmountInput) || 0)}>
                      Update Payment
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this delivery?"
        message={deleteTarget ? `Delete delivery of ${deleteTarget.products?.name || 'Unknown'} from ${deleteTarget.suppliers?.name || 'Unknown'}?` : ''}
        confirmLabel="Delete"
        variant="danger"
        icon={Trash2}
        onConfirm={() => { const t = deleteTarget; setDeleteTarget(null); handleDelete(t.id); }}
        onCancel={() => setDeleteTarget(null)}
      />

      <style>{`
        .delivery-sizes-grid { margin-top: 1rem; border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden; }
        .delivery-sizes-header { display: grid; gap: 0.5rem; padding: 0.5rem 0.75rem; background: var(--color-bg); border-bottom: 1px solid var(--color-border); font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-muted); }
        .delivery-size-row { display: grid; gap: 0.5rem; align-items: center; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--color-border); }
        .delivery-size-row:last-child { border-bottom: none; }
        .delivery-size-name { font-size: 0.875rem; font-weight: 500; }
        .delivery-size-input { height: 2rem !important; font-size: 0.8125rem !important; padding: 0 0.5rem !important; }
        .delivery-size-subtotal { font-size: 0.8125rem; font-weight: 600; color: var(--color-primary); }
        .delivery-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1.25rem; }
        .delivery-stat-card { display: flex; align-items: center; gap: 0.75rem; padding: 0.875rem 1rem; background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); }
        .delivery-stat-card svg { color: var(--color-primary); flex-shrink: 0; }
        .delivery-stat-value { display: block; font-weight: 700; font-size: 1.0625rem; }
        .delivery-stat-label { display: block; font-size: 0.75rem; color: var(--color-text-muted); }
        .delivery-breakdown { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; }
        .delivery-breakdown-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 0.8125rem; }
        .delivery-breakdown-badge { display: inline-block; padding: 0.2rem 0.5rem; border-radius: 999px; font-size: 0.7rem; font-weight: 600; text-transform: capitalize; }
        .delivery-breakdown-count { font-weight: 600; color: var(--color-text-secondary); }
        .delivery-breakdown-total { font-weight: 700; color: var(--color-primary); }
        .delivery-form-card { margin-bottom: 1.25rem; animation: fadeIn 0.3s ease-out; }
        .delivery-no-suppliers { text-align: center; padding: 1.5rem; color: var(--color-text-muted); }
        .delivery-cost-preview { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; margin-top: 1rem; background: var(--color-primary-50); border-radius: var(--radius-md); font-size: 0.9375rem; }
        .delivery-cost-preview strong { color: var(--color-primary); font-size: 1.0625rem; }
        .delivery-controls { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.75rem; flex-wrap: wrap; }
        .delivery-controls .search-input-wrapper { flex: 1; min-width: 200px; max-width: 320px; }
        .delivery-controls .search-input-wrapper .input { padding-left: 2rem; height: 2.25rem; font-size: 0.875rem; }
        .delivery-count { font-size: 0.8125rem; color: var(--color-text-muted); white-space: nowrap; }
        .delivery-table-header { display: grid; align-items: center; padding: 0.625rem 1rem; background: var(--color-bg-subtle); border-bottom: 2px solid var(--color-border); font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-text-muted); border-radius: var(--radius-lg) var(--radius-lg) 0 0; }
        .delivery-batch { border-bottom: 1px solid var(--color-border); position: relative; }
        .delivery-batch:last-child { border-bottom: none; }
        .delivery-row { display: grid; align-items: center; padding: 0.75rem 1rem; font-size: 0.9375rem; transition: background 0.2s; }
        .delivery-row:hover { background: var(--color-bg); }
        .delivery-date { font-size: 0.8125rem; color: var(--color-text-secondary); }
        .delivery-supplier { font-weight: 500; }
        .delivery-sizes-summary { font-size: 0.8125rem; color: var(--color-text-secondary); }
        .delivery-qty { font-weight: 600; font-variant-numeric: tabular-nums; }
        .delivery-cost { font-weight: 600; color: var(--color-primary); font-variant-numeric: tabular-nums; }
        .delivery-payment-badge { display: inline-block; padding: 0.2rem 0.5rem; border-radius: 999px; font-size: 0.7rem; font-weight: 600; text-transform: capitalize; }
        .delivery-actions { display: flex; gap: 0.25rem; justify-content: flex-end; }
        .delivery-payment-dropdown { position: absolute; top: 100%; left: 0; width: 100%; background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-lg); z-index: 20; padding: 0.5rem; display: flex; flex-direction: column; gap: 0.75rem; animation: fadeIn 0.15s ease-out; }
        .delivery-payment-option { display: flex; align-items: center; gap: 0.5rem; width: 100%; padding: 0.5rem 0.75rem; border: none; background: transparent; color: var(--color-text-secondary); font-size: 0.8125rem; font-weight: 500; border-radius: var(--radius-sm); cursor: pointer; text-transform: capitalize; transition: all 0.15s; }
        .delivery-payment-option:hover { background: var(--color-primary-50); color: var(--color-primary); }
        .delivery-payment-option.active { background: var(--color-primary); color: white; }
        .delivery-amount-input { padding: 0.5rem; border-top: 1px solid var(--color-border); display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; }
        .delivery-amount-input label { font-weight: 600; color: var(--color-text-muted); }
        .delivery-amount-input input { width: 120px; padding: 0.375rem 0.5rem; border: 1.5px solid var(--color-border); border-radius: var(--radius-sm); font-size: 0.875rem; font-variant-numeric: tabular-nums; }
        .delivery-amount-input input:focus { border-color: var(--color-primary); outline: none; }

        @media (max-width: 640px) {
          .delivery-table-header { display: none; }
          .delivery-row { grid-template-columns: 1fr auto !important; gap: 0.1rem 0.5rem; padding: 0.625rem 0.75rem; }
          .delivery-date { grid-column: 1; grid-row: 1; font-size: 0.6875rem; color: var(--color-text-muted); }
          .delivery-supplier { grid-column: 2; grid-row: 1; }
          .delivery-sizes-summary { grid-column: 1; grid-row: 2; font-size: 0.8125rem; }
          .delivery-qty { grid-column: 2; grid-row: 2; text-align: right; }
          .delivery-cost { grid-column: 1; grid-row: 3; font-size: 0.875rem; }
          .delivery-payment { grid-column: 2; grid-row: 3; text-align: right; }
          .delivery-row .num { grid-column: 1 / -1; grid-row: 4; text-align: right; }
          .delivery-stats { grid-template-columns: 1fr; }
        }
        @media (min-width: 640px) { .delivery-stats { grid-template-columns: 1fr 1fr; } }
        @media (min-width: 900px) { .delivery-stats { grid-template-columns: 1fr 1fr 1fr 1fr; } }
      `}</style>
    </div>
  );
}
