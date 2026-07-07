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
  ChevronDown,
  ChevronRight,
  Edit3,
  Search,
} from 'lucide-react';
import {
  fetchDeliveries,
  recordDeliveryBatch,
  deleteDelivery,
  deleteDeliveryBatch,
  updateDeliveryPayment,
  fetchSuppliers,
  fetchInventory,
  PAYMENT_STATUSES,
  formatPeso,
  TRAY_SIZE,
  getLocalDate,
} from '../lib/api';
import { formatDate, formatQuantity } from '../lib/formatters';
import { toast } from '../lib/toastFn';
import { getUserFriendlyError } from '../lib/errors';
import ConfirmDialog from './ConfirmDialog';

export default function Deliveries() {
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null); // stores item id being edited
  const [paymentStatusInput, setPaymentStatusInput] = useState('unpaid');
  const [partialAmountInput, setPartialAmountInput] = useState(0);
  const [confirmItem, setConfirmItem] = useState(null);
  const [expandedBatches, setExpandedBatches] = useState({});
  const PAGE_SIZE = 50;
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBatches, setSelectedBatches] = useState(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const today = getLocalDate();

  const [form, setForm] = useState({
    supplierId: '',
    sizes: [],
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
        fetchDeliveries({ limit: PAGE_SIZE, offset: 0 }),
        fetchSuppliers(),
        fetchInventory(),
      ]);
      setDeliveries(delData || []);
      setPage(0);
      setHasMore(delData && delData.length === PAGE_SIZE);
      setSuppliers(suppData || []);

      // Initialize form sizes when inventory loads
      if (invData && invData.length > 0) {
        setForm(prev => ({
          ...prev,
          sizes: invData
            .sort((a, b) => (a.egg_sizes?.sort_order || 0) - (b.egg_sizes?.sort_order || 0))
            .map(item => ({
              eggSizeId: item.egg_size_id,
              name: item.egg_sizes?.name || 'Unknown',
              quantity: '',
              costPerTray: '',
            })),
        }));
      }
    } catch (err) {
      console.error('Deliveries load error:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    try {
      const nextPage = page + 1;
      const data = await fetchDeliveries({ limit: PAGE_SIZE, offset: nextPage * PAGE_SIZE });
      if (data && data.length > 0) {
        setDeliveries(prev => [...prev, ...data]);
        setPage(nextPage);
        setHasMore(data.length === PAGE_SIZE);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Load more error:', err);
      toast('Failed to load more deliveries', 'error');
    }
  }

  function updateSize(index, field, value) {
    setForm(prev => {
      const sizes = [...prev.sizes];
      sizes[index] = { ...sizes[index], [field]: value };
      return { ...prev, sizes };
    });
  }

  function calculateBatchTotal() {
    return form.sizes.reduce((sum, s) => {
      const qty = parseInt(s.quantity, 10) || 0;
      const cost = parseFloat(s.costPerTray) || 0;
      return sum + (qty * cost);
    }, 0);
  }

  function activeSizes() {
    return form.sizes.filter(s => parseInt(s.quantity, 10) > 0);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.supplierId) {
      toast('Please select a supplier', 'error');
      return;
    }
    const active = activeSizes();
    if (active.length === 0) {
      toast('Enter quantity for at least one egg size', 'error');
      return;
    }
    for (const s of active) {
      if (!s.costPerTray || parseFloat(s.costPerTray) < 0) {
        toast(`Enter cost per tray for ${s.name}`, 'error');
        return;
      }
    }
    setConfirmItem({ ...form });
  }

  async function executeDelivery(data) {
    setSubmitting(true);
    try {
      const active = data.sizes.filter(s => parseInt(s.quantity, 10) > 0);
      const result = await recordDeliveryBatch({
        supplierId: parseInt(data.supplierId, 10),
        items: active.map(s => ({
          eggSizeId: parseInt(s.eggSizeId, 10),
          quantity: parseInt(s.quantity, 10),
          costPerTray: parseFloat(s.costPerTray),
        })),
        unit: 'tray',
        traySize: TRAY_SIZE,
        paymentStatus: data.paymentStatus,
        notes: data.notes.trim(),
        deliveryDate: data.date,
      });
      const batchId = result?.[0]?.batch_id;
      toast('Delivery recorded!', 'success', {
        label: 'Undo',
        onClick: async () => {
          if (batchId) {
            try {
              await deleteDeliveryBatch(batchId);
              toast('Delivery undone');
              loadData();
            } catch {
              toast('Failed to undo delivery', 'error');
            }
          }
        },
      });
      setForm(prev => ({
        ...prev,
        supplierId: '',
        sizes: prev.sizes.map(s => ({ ...s, quantity: '', costPerTray: '' })),
        paymentStatus: 'unpaid',
        notes: '',
        date: today,
      }));
      setShowForm(false);
      loadData();
    } catch (err) {
      console.error('Delivery record error:', err);
      toast('Failed to record delivery', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBulkDeleteConfirmed() {
    try {
      const ids = [...selectedBatches];
      await Promise.all(ids.map(batchId => deleteDeliveryBatch(batchId)));
      toast(`${ids.length} delivery(ies) removed`);
      setSelectedBatches(new Set());
      setConfirmBulkDelete(false);
      loadData();
    } catch (err) {
      console.error('Bulk delete error:', err);
      toast('Failed to remove deliveries', 'error');
      setConfirmBulkDelete(false);
    }
  }

  async function handleDeleteBatch(batchId) {
    try {
      await deleteDeliveryBatch(batchId);
      toast('Delivery removed');
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      console.error('Delete batch error:', err);
      toast('Failed to remove delivery', 'error');
    }
  }

  async function handleDeleteSingle(id) {
    try {
      await deleteDelivery(id);
      toast('Delivery item removed');
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      console.error('Delete delivery error:', err);
      toast('Failed to remove delivery', 'error');
    }
  }

  async function handlePaymentUpdate(id, status, amount = 0, totalCost = 0) {
    try {
      await updateDeliveryPayment(id, status, parseFloat(amount || 0));
      
      let message = `Payment marked as ${status}`;
      if (status === 'partial' && parseFloat(amount) > 0) {
        const remaining = totalCost - parseFloat(amount);
        message += ` — ₱${remaining.toFixed(2)} remaining`;
      }
      
      toast(message);
      setEditingPayment(null);
      setPartialAmountInput(0);
      loadData();
    } catch (err) {
      console.error('Update payment error:', err);
      toast('Failed to update payment status', 'error');
    }
  }

  // Group deliveries by batch_id
  const batches = {};
  deliveries.forEach(d => {
    const bid = d.batch_id || `single_${d.id}`;
    if (!batches[bid]) {
      batches[bid] = { batchId: bid, items: [], isSingle: !d.batch_id };
    }
    batches[bid].items.push(d);
  });
  const batchList = Object.values(batches).sort((a, b) => {
    const dateA = a.items[0]?.delivery_date || '';
    const dateB = b.items[0]?.delivery_date || '';
    if (dateA !== dateB) return dateB.localeCompare(dateA);
    return (b.items[0]?.id || 0) - (a.items[0]?.id || 0);
  });

  const filteredBatchList = batchList.filter(batch => {
    if (!searchQuery) return true;
    const name = (batch.items[0]?.suppliers?.name || '').toLowerCase();
    return name.includes(searchQuery.toLowerCase());
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



  function batchTotalQty(items) {
    return items.reduce((sum, d) => sum + d.quantity, 0);
  }

  function batchTotalCost(items) {
    return items.reduce((sum, d) => sum + parseFloat(d.total_cost || 0), 0);
  }

  function batchPaymentStatus(items) {
    const statuses = items.map(d => d.payment_status);
    if (statuses.every(s => s === 'paid')) return 'paid';
    if (statuses.some(s => s === 'paid')) return 'partial';
    return 'unpaid';
  }

  function batchAmountPaid(items) {
    return items.reduce((sum, d) => sum + parseFloat(d.amount_paid || 0), 0);
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
            <span className="delivery-stat-value">{batchList.length}</span>
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
                {parseFloat(data.paid) > 0 && (
                  <span className="delivery-breakdown-paid">Paid: {formatPeso(data.paid)}</span>
                )}
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
                  <label htmlFor="delivery-date">Date</label>
                  <input
                    id="delivery-date"
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
                    className="select"
                    value={form.paymentStatus}
                    onChange={e => setForm({ ...form, paymentStatus: e.target.value })}
                  >
                    {PAYMENT_STATUSES.map(status => (
                      <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Egg size inputs */}
              <div className="delivery-sizes-grid">
                <div className="delivery-sizes-header">
                  <span className="delivery-sizes-label">Egg Size</span>
                  <span className="delivery-sizes-label">Qty (trays)</span>
                  <span className="delivery-sizes-label">Cost/Tray</span>
                  <span className="delivery-sizes-label num">Subtotal</span>
                </div>
                {form.sizes.map((size, i) => (
                  <div key={size.eggSizeId} className="delivery-size-row">
                    <span className="delivery-size-name">{size.name}</span>
                    <input
                      type="number"
                      className="input delivery-size-input"
                      min="0"
                      placeholder="0"
                      value={size.quantity}
                      onChange={e => updateSize(i, 'quantity', e.target.value)}
                    />
                    <input
                      type="number"
                      className="input delivery-size-input"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={size.costPerTray}
                      onChange={e => updateSize(i, 'costPerTray', e.target.value)}
                    />
                    <span className="delivery-size-subtotal num">
                      {(parseInt(size.quantity, 10) || 0) * (parseFloat(size.costPerTray) || 0) > 0
                        ? formatPeso((parseInt(size.quantity, 10) || 0) * (parseFloat(size.costPerTray) || 0))
                        : '—'}
                    </span>
                  </div>
                ))}
              </div>

              <div className="input-group" style={{ marginTop: '0.75rem' }}>
                <label htmlFor="delivery-notes">Notes</label>
                <input
                  id="delivery-notes"
                  type="text"
                  className="input"
                  placeholder="e.g. Good quality, some cracked eggs"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              {/* Batch total preview */}
              {activeSizes().length > 0 && (
                <div className="delivery-cost-preview">
                  <span>Total Cost ({activeSizes().length} size{activeSizes().length > 1 ? 's' : ''}):</span>
                  <strong>{formatPeso(calculateBatchTotal())}</strong>
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

      {/* Search and controls */}
      <div className="delivery-controls">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="input"
            placeholder="Search supplier..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <span className="delivery-count">Showing {filteredBatchList.length} {filteredBatchList.length === 1 ? 'batch' : 'batches'}</span>
      </div>

      {selectedBatches.size > 0 && (
        <div className="bulk-delete-bar">
          <span className="bulk-delete-label">{selectedBatches.size} selected</span>
          <button className="btn btn-sm btn-danger" onClick={() => setConfirmBulkDelete(true)}>
            <Trash2 size={14} />
            Delete Selected ({selectedBatches.size})
          </button>
          <button className="btn btn-sm btn-secondary" onClick={() => setSelectedBatches(new Set())}>
            Clear Selection
          </button>
        </div>
      )}

      {/* Delivery list */}
      <div className="card" style={{ padding: 0 }}>
        <div className="delivery-table-header">
          <span className="checkbox-col">
            <input
              type="checkbox"
              checked={filteredBatchList.length > 0 && selectedBatches.size === filteredBatchList.length}
              onChange={e => {
                if (e.target.checked) {
                  setSelectedBatches(new Set(filteredBatchList.map(b => b.batchId)));
                } else {
                  setSelectedBatches(new Set());
                }
              }}
            />
          </span>
          <span>Date</span>
          <span>Supplier</span>
          <span>Sizes</span>
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
        ) : batchList.length === 0 ? (
          <div className="empty-state">
            <Truck size={36} />
            <p>No deliveries recorded yet</p>
            <p style={{ fontSize: '0.8125rem', marginTop: '-0.25rem' }}>Click "Record Delivery" to log a supplier delivery with all egg sizes</p>
          </div>
        ) : filteredBatchList.length === 0 ? (
          <div className="empty-state">
            <Search size={36} />
            <p>No deliveries match your search</p>
            <p style={{ fontSize: '0.8125rem', marginTop: '-0.25rem' }}>Try a different supplier name</p>
          </div>
        ) : (
          filteredBatchList.map((batch) => {
            const isExpanded = expandedBatches[batch.batchId];
            const bpStatus = batch.isSingle
              ? batch.items[0]?.payment_status
              : batchPaymentStatus(batch.items);
            const bpStyle = paymentColors[bpStatus] || paymentColors.unpaid;
            return (                <div key={batch.batchId} className="delivery-batch" style={editingPayment === batch.batchId ? { zIndex: 20 } : undefined}>
                <div
                  className="delivery-row delivery-batch-header"
                  onClick={() => !batch.isSingle && setExpandedBatches(prev => ({ ...prev, [batch.batchId]: !prev[batch.batchId] }))}
                  style={{ cursor: batch.isSingle ? 'default' : 'pointer' }}
                >
                  <span className="checkbox-col" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedBatches.has(batch.batchId)}
                      onChange={e => {
                        const newSet = new Set(selectedBatches);
                        if (e.target.checked) {
                          newSet.add(batch.batchId);
                        } else {
                          newSet.delete(batch.batchId);
                        }
                        setSelectedBatches(newSet);
                      }}
                    />
                  </span>
                  {!batch.isSingle && (
                    <span className="delivery-batch-chevron">
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                  )}
                  <span className="delivery-date">{formatDate(batch.items[0]?.delivery_date)}</span>
                  <span className="delivery-supplier">{batch.items[0]?.suppliers?.name || 'Unknown'}</span>
                  <span className="delivery-sizes-summary">
                    {batch.items.length} size{batch.items.length > 1 ? 's' : ''}
                  </span>
                  <span className="delivery-qty">{batchTotalQty(batch.items)} trays</span>
                    <span className="delivery-cost">{formatPeso(batchTotalCost(batch.items))}</span>
                    <span className="delivery-remaining">
                      Remaining: {formatPeso(batchTotalCost(batch.items) - batchAmountPaid(batch.items))}
                    </span>
                  <span className="delivery-payment">
                    {batch.isSingle ? (
                      <span
                        className="delivery-payment-badge"
                        style={{ background: bpStyle.bg, color: bpStyle.color }}
                      >
                        {bpStatus}
                      </span>
                    ) : (
                      <span
                        className="delivery-payment-badge"
                        style={{ background: bpStyle.bg, color: bpStyle.color }}
                      >
                        {bpStatus}
                      </span>
                    )}
                  </span>
                  <span className="num">
                    <div className="delivery-actions">
                      <button
                        className="btn-icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingPayment(editingPayment === batch.batchId ? null : batch.batchId);
                        }}
                        title="Update payment"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        className="btn-icon btn-icon-danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(batch);
                        }}
                        title="Delete delivery"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </span>
                </div>

                {/* Expanded size details */}
                {isExpanded && batch.items.length > 1 && (
                  <div className="delivery-batch-details">
                    {batch.items
                      .sort((a, b) => (a.egg_sizes?.sort_order || 0) - (b.egg_sizes?.sort_order || 0))
                      .map(item => (
                        <div key={item.id} className="delivery-batch-item">
                          <span className="delivery-batch-item-size">{item.egg_sizes?.name}</span>
                          <span className="delivery-batch-item-qty">{formatQuantity(item)}</span>
                          <span className="delivery-batch-item-cost">{formatPeso(item.total_cost)}</span>
                          <span
                            className="delivery-payment-badge"
                            style={{
                              background: paymentColors[item.payment_status]?.bg,
                              color: paymentColors[item.payment_status]?.color,
                            }}
                          >
                            {item.payment_status}
                          </span>
                        </div>
                      ))}
                  </div>
                )}

                {/* Payment update dropdown */}
                {editingPayment === batch.batchId && (
                  <div className="delivery-payment-dropdown">
                    {PAYMENT_STATUSES.map(status => (
                      <button
                        key={status}
                        className={`delivery-payment-option ${paymentStatusInput === status ? 'active' : ''}`}
                        onClick={() => {
                          setPaymentStatusInput(status);
                          
                          if (status === 'paid') {
                            // Auto-set to full amount for convenience
                            setPartialAmountInput(batchTotalCost(batch.items));
                          } else if (status === 'partial') {
                            // Keep current input or set to 0 if empty
                            if (partialAmountInput === 0) setPartialAmountInput(0);
                          }
                        }}
                      >
                        {status === 'paid' && <CheckCircle size={14} />}
                        {status === 'partial' && <Clock size={14} />}
                        {status === 'unpaid' && <AlertTriangle size={14} />}
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </button>
                    ))}
                    
                    {/* Amount input field */}
                    <div className="delivery-amount-input">
                      <label>Amount Paid: ₱</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={partialAmountInput.toFixed(2)}
                        onChange={(e) => {
                          const val = Math.min(parseFloat(e.target.value) || 0, batchTotalCost(batch.items));
                          setPartialAmountInput(val);
                        }}
                        placeholder="0.00"
                      />
                    </div>

                    {/* Save Button */}
                    <button 
                      className="btn btn-primary btn-sm" 
                      style={{ marginTop: '0.5rem' }}
                      onClick={() => {
                        const items = batch.items;
                        Promise.all(items.map(item => handlePaymentUpdate(
                          item.id, 
                          paymentStatusInput, 
                          partialAmountInput, 
                          batchTotalCost(batch.items)
                        )));
                      }}
                    >
                      Update Payment
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {hasMore && !searchQuery && (
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button className="btn btn-secondary" onClick={loadMore}>
            Load More
          </button>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmItem}
        title="Record this delivery?"
        message={confirmItem
          ? (() => {
              const active = activeSizes();
              const sName = suppliers.find(s => s.id === parseInt(confirmItem.supplierId, 10))?.name || 'Unknown';
              const lines = active.map(s => `${s.quantity} trays of ${s.name}`);
              return `Delivery from ${sName}:\n${lines.join('\n')}`;
            })()
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
        open={confirmBulkDelete}
        title="Delete selected deliveries?"
        message={`Delete ${selectedBatches.size} delivery(ies)? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        icon={Trash2}
        onConfirm={handleBulkDeleteConfirmed}
        onCancel={() => setConfirmBulkDelete(false)}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this delivery?"
        message={deleteTarget
          ? `Delete the ${deleteTarget.items[0]?.suppliers?.name || 'Unknown'} delivery of ${deleteTarget.items.length} size(s)? This cannot be undone.`
          : ''}
        confirmLabel="Delete"
        variant="danger"
        icon={Trash2}
        onConfirm={() => {
          const target = deleteTarget;
          setDeleteTarget(null);
          if (target.isSingle) {
            handleDeleteSingle(target.items[0].id);
          } else {
            handleDeleteBatch(target.batchId);
          }
        }}
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

        .delivery-sizes-grid {
          margin-top: 1rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          overflow: hidden;
        }

        .delivery-sizes-header {
          display: grid;
          grid-template-columns: 1fr 90px 110px 100px;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: var(--color-bg);
          border-bottom: 1px solid var(--color-border);
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-muted);
        }

        .delivery-size-row {
          display: grid;
          grid-template-columns: 1fr 90px 110px 100px;
          gap: 0.5rem;
          align-items: center;
          padding: 0.5rem 0.75rem;
          border-bottom: 1px solid var(--color-border);
        }

        .delivery-size-row:last-child { border-bottom: none; }

        .delivery-size-name {
          font-size: 0.875rem;
          font-weight: 500;
        }

        .delivery-size-input {
          height: 2rem !important;
          font-size: 0.8125rem !important;
          padding: 0 0.5rem !important;
        }

        .delivery-size-subtotal {
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--color-primary);
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
          grid-template-columns: 36px 70px 1fr 60px 80px 90px 80px 60px;
          padding: 0.625rem 1rem;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-muted);
          background: var(--color-bg);
          border-bottom: 1px solid var(--color-border);
        }

        .delivery-batch {
          border-bottom: 1px solid var(--color-border);
          animation: fadeIn 0.3s ease-out forwards;
          opacity: 0;
          position: relative;
        }

        .delivery-batch:last-child { border-bottom: none; }

        .delivery-row {
          display: grid;
          grid-template-columns: 36px 70px 1fr 60px 80px 90px 80px 60px;
          align-items: center;
          padding: 0.75rem 0.5rem 0.75rem 0.25rem;
          transition: background 0.2s;
          font-size: 0.9375rem;
          position: relative;
        }

        .delivery-batch-header:hover { background: var(--color-bg); }

        .delivery-batch-chevron {
          position: absolute;
          left: 2rem;
          color: var(--color-text-muted);
        }

        .checkbox-col {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .checkbox-col input[type="checkbox"] {
          width: 1rem;
          height: 1rem;
          cursor: pointer;
          accent-color: var(--color-primary);
        }

        .delivery-controls {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          margin-bottom: 0.75rem;
          flex-wrap: wrap;
        }

        .search-input-wrapper {
          position: relative;
          flex: 1;
          min-width: 200px;
          max-width: 320px;
        }

        .search-input-wrapper .input {
          padding-left: 2rem;
          height: 2.25rem;
          font-size: 0.875rem;
        }

        .search-icon {
          position: absolute;
          left: 0.625rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--color-text-muted);
          pointer-events: none;
        }

        .delivery-count {
          font-size: 0.8125rem;
          color: var(--color-text-muted);
          white-space: nowrap;
        }

        .bulk-delete-bar {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          margin-bottom: 0.75rem;
          background: #FFF3E0;
          border: 1px solid #FFB74D;
          border-radius: var(--radius-md);
          font-size: 0.8125rem;
        }

        .bulk-delete-label {
          font-weight: 600;
          color: #E65100;
        }

        .delivery-date {
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
        }

        .delivery-supplier {
          font-weight: 500;
        }

        .delivery-sizes-summary {
          font-size: 0.8125rem;
          color: var(--color-text-muted);
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

        .delivery-batch-details {
          background: var(--color-bg);
          border-top: 1px dashed var(--color-border);
          padding: 0.5rem 1rem 0.5rem 2rem;
        }

        .delivery-batch-item {
          display: grid;
          grid-template-columns: 1fr 80px 90px 80px;
          gap: 0.5rem;
          align-items: center;
          padding: 0.35rem 0;
          font-size: 0.8125rem;
        }

        .delivery-batch-item-size { font-weight: 500; }
        .delivery-batch-item-qty { font-variant-numeric: tabular-nums; }
        .delivery-batch-item-cost { color: var(--color-primary); font-weight: 600; }

        /* Payment update dropdown */
        .delivery-payment-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          width: 100%;
          background: var(--color-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-lg);
          z-index: 20;
          padding: 0.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          animation: fadeIn 0.15s ease-out;
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

        /* Amount input styling */
        .delivery-amount-input {
          padding: 0.5rem;
          border-top: 1px solid var(--color-border);
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
        }

        .delivery-amount-input label {
          font-weight: 600;
          color: var(--color-text-muted);
        }

        .delivery-amount-input input {
          width: 120px;
          padding: 0.375rem 0.5rem;
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-sm);
          font-size: 0.875rem;
          font-variant-numeric: tabular-nums;
        }

        .delivery-amount-input input:focus {
          border-color: var(--color-primary);
          outline: none;
        }

        /* Remaining balance display */
        .delivery-remaining {
          font-size: 0.75rem;
          color: var(--color-danger);
          font-weight: 600;
        }

        /* Paid amount badge in breakdown */
        .delivery-breakdown-paid {
          font-size: 0.7rem;
          color: var(--color-success);
          font-weight: 600;
          padding: 0.1rem 0.3rem;
          background: var(--color-success-bg);
          border-radius: var(--radius-sm);
        }

        @media (max-width: 640px) {
          .delivery-table-header { display: none; }
          .checkbox-col { display: none; }
          .delivery-row {
            grid-template-columns: 1fr auto;
            gap: 0.1rem 0.5rem;
            padding: 0.625rem 0.75rem;
          }
          .delivery-batch-chevron {
            left: 0.25rem;
          }
          .delivery-date {
            grid-column: 1; grid-row: 1;
            font-size: 0.6875rem;
            color: var(--color-text-muted);
          }
          .delivery-supplier {
            grid-column: 2; grid-row: 1;
          }
          .delivery-sizes-summary {
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
          .delivery-sizes-header {
            grid-template-columns: 1fr 70px 85px 80px;
            font-size: 0.6rem;
          }
          .delivery-size-row {
            grid-template-columns: 1fr 70px 85px 80px;
          }
          .delivery-batch-item {
            grid-template-columns: 1fr 60px 70px 60px;
            font-size: 0.75rem;
          }
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
