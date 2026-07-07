import { useState, useEffect, useCallback } from 'react';
import {
  ShoppingCart,
  Plus,
  X,
  AlertTriangle,
  RefreshCw,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { fetchProducts, recordProductSale, deleteProductSale, deleteProductSales, fetchProductSales, formatPeso, getLocalDate } from '../lib/api';
import { toast } from '../lib/toastFn';
import { getUserFriendlyError } from '../lib/errors';
import ConfirmDialog from './ConfirmDialog';

const undoSalesData = { current: null };

function groupByDate(salesList, todayStr) {
  const groups = {};
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalDate(yesterday);
  salesList.forEach(sale => {
    const d = sale.sale_date;
    let label;
    if (d === todayStr) label = 'Today';
    else if (d === yesterdayStr) label = 'Yesterday';
    else {
      const dt = new Date(d + 'T00:00:00');
      label = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    if (!groups[label]) groups[label] = { label, date: d, sales: [] };
    groups[label].sales.push(sale);
  });
  return Object.keys(groups)
    .sort((a, b) => groups[b].date.localeCompare(groups[a].date))
    .map(k => groups[k]);
}

export default function ProductSales() {
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmSale, setConfirmSale] = useState(null);
  const [expandedDate, setExpandedDate] = useState(null);
  const today = getLocalDate();

  const [filter, setFilter] = useState('today');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [customStart, setCustomStart] = useState(today);
  const [customEnd, setCustomEnd] = useState(today);

  const [form, setForm] = useState({
    productId: '',
    quantity: '',
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [salesData, productData] = await Promise.all([
        fetchProductSales({ limit: 500, offset: 0, startDate, endDate }),
        fetchProducts(),
      ]);
      setSales(salesData || []);
      setProducts(productData || []);
    } catch (err) {
      console.error('Product sales load error:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    const id = setTimeout(() => loadData(), 0);
    return () => clearTimeout(id);
  }, [loadData]);

  function changeFilter(key) {
    setFilter(key);
    setExpandedDate(null);
    setSelectedIds([]);
    if (key === 'today') { setStartDate(today); setEndDate(today); }
    else if (key === 'yesterday') {
      const y = new Date(); y.setDate(y.getDate() - 1);
      setStartDate(getLocalDate(y)); setEndDate(getLocalDate(y));
    } else if (key === 'week') {
      const d = new Date(); d.setDate(d.getDate() - 7);
      setStartDate(getLocalDate(d)); setEndDate(today);
    } else if (key === 'month') {
      const d = new Date(); d.setDate(1);
      setStartDate(getLocalDate(d)); setEndDate(today);
    }
  }

  function applyCustom() {
    setStartDate(customStart);
    setEndDate(customEnd);
    setFilter('custom');
    setExpandedDate(null);
    setSelectedIds([]);
  }

  function getFilteredSales() {
    let result = [...sales];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s => (s.products?.name || '').toLowerCase().includes(q));
    }
    return result;
  }

  const filteredSales = getFilteredSales();
  const groupedSales = groupByDate(filteredSales, today);
  const periodRevenue = filteredSales.reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0);
  const periodQty = filteredSales.reduce((sum, s) => sum + parseFloat(s.quantity || 0), 0);

  function getSelectedProduct() {
    if (!form.productId) return null;
    return products.find(p => p.id === parseInt(form.productId, 10));
  }

  function calculateTotalAmount() {
    const product = getSelectedProduct();
    if (!product || !form.quantity) return null;
    const qty = parseFloat(form.quantity);
    if (isNaN(qty) || qty <= 0) return null;
    const price = parseFloat(product.price || 0);
    if (price <= 0) return null;
    return qty * price;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.productId || !form.quantity) {
      toast('Please select a product and enter quantity', 'error');
      return;
    }
    const qty = parseFloat(form.quantity);
    if (isNaN(qty) || qty <= 0) {
      toast('Enter a valid quantity', 'error');
      return;
    }
    const product = getSelectedProduct();
    if (!product) { toast('Product not found', 'error'); return; }

    const stock = parseFloat(product.quantity_on_hand || 0);
    if (qty > stock) {
      toast(`Not enough stock — only ${stock} ${product.unit || 'units'} available`, 'error');
      return;
    }
    setConfirmSale({ productId: parseInt(form.productId, 10), quantity: qty, productName: product.name });
  }

  async function executeSale(saleData) {
    setSubmitting(true);
    try {
      await recordProductSale({
        productId: saleData.productId,
        quantity: saleData.quantity,
        saleDate: today,
      });
      toast('Product sale recorded');
      setForm({ productId: '', quantity: '' });
      setShowForm(false);
      loadData();
    } catch (err) {
      console.error('Product sale error:', err);
      toast('Failed to record sale', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  function handleToggleSelect(id) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function handleToggleSelectAll() {
    if (selectedIds.length === filteredSales.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredSales.map(s => s.id));
    }
  }

  async function handleDeleteSale(id) {
    try {
      const deletedSale = await deleteProductSale(id);
      toast('Sale deleted — stock restored', 'success', {
        label: 'Undo',
        onClick: async () => {
          try {
            await recordProductSale({
              productId: deletedSale.product_id,
              quantity: deletedSale.quantity,
              saleDate: deletedSale.sale_date,
            });
            toast('Sale restored');
            loadData();
          } catch (err) {
            console.error('Undo restore error:', err);
            toast('Failed to restore sale', 'error');
          }
        },
      });
      loadData();
    } catch (err) {
      console.error('Delete sale error:', err);
      toast('Failed to delete sale', 'error');
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return;
    const salesToDelete = sales.filter(s => selectedIds.includes(s.id));
    undoSalesData.current = salesToDelete;
    try {
      await deleteProductSales(selectedIds);
      toast(`Deleted ${selectedIds.length} sale(s) — stock restored`, 'success', {
        label: 'Undo',
        onClick: async () => {
          try {
            const toRestore = undoSalesData.current;
            if (!toRestore || toRestore.length === 0) return;
            for (const sale of toRestore) {
              await recordProductSale({
                productId: sale.product_id,
                quantity: sale.quantity,
                saleDate: sale.sale_date,
              });
            }
            toast('Sales restored');
            loadData();
          } catch (err) {
            console.error('Undo bulk error:', err);
            toast('Failed to restore sales', 'error');
          }
        },
      });
      setSelectedIds([]);
      undoSalesData.current = null;
      loadData();
    } catch (err) {
      console.error('Bulk delete error:', err);
      toast('Failed to delete sales', 'error');
    }
  }

  return (
    <div className="ps-page fade-in">
      <div className="sl-header">
        <div>
          <h1>Product Sales</h1>
          <p className="page-subtitle">Record and view product sales</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={18} /> Record Sale
        </button>
      </div>

      <div className="sl-stats">
        <div className="sl-stat">
          <ShoppingCart size={18} />
          <div>
            <span className="sl-stat-val">{periodQty.toLocaleString()}</span>
            <span className="sl-stat-lbl">{filter === 'today' ? 'units today' : 'units sold'}</span>
          </div>
        </div>
        <div className="sl-stat">
          <TrendingUp size={18} />
          <div>
            <span className="sl-stat-val">{formatPeso(periodRevenue)}</span>
            <span className="sl-stat-lbl">{filter === 'today' ? 'revenue today' : 'revenue'}</span>
          </div>
        </div>
      </div>

      <div className="sl-filter-bar">
        <div className="sl-filter-tabs">
          {[
            { key: 'today', label: 'Today' },
            { key: 'yesterday', label: 'Yesterday' },
            { key: 'week', label: 'Week' },
            { key: 'month', label: 'Month' },
            { key: 'custom', label: 'Custom' },
          ].map(p => (
            <button key={p.key} className={`sl-filter-tab ${filter === p.key ? 'active' : ''}`} onClick={() => changeFilter(p.key)}>{p.label}</button>
          ))}
        </div>
        {filter === 'custom' && (
          <div className="sl-custom-dates">
            <input type="date" className="sl-date-input" value={customStart} onChange={e => setCustomStart(e.target.value)} />
            <span className="sl-date-sep">→</span>
            <input type="date" className="sl-date-input" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
            <button className="btn btn-primary btn-sm" onClick={applyCustom}>Go</button>
          </div>
        )}
      </div>

      {error && !loading && (
        <div className="error-banner" style={{ marginBottom: '1rem' }}>
          <AlertTriangle size={20} />
          <div className="error-banner-content">
            <strong>Failed to load</strong>
            <p>{getUserFriendlyError(error)}</p>
          </div>
          <button className="btn btn-sm btn-secondary" onClick={loadData}><RefreshCw size={14} /> Retry</button>
        </div>
      )}

      {/* Modal Form */}
      {showForm && (
        <div className="sl-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="sl-modal" onClick={e => e.stopPropagation()}>
            <div className="sl-modal-header">
              <h3>Record Product Sale</h3>
              <button className="sl-modal-close" onClick={() => setShowForm(false)} title="Close"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="sl-form-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="sl-field">
                  <label>Product</label>
                  <select className="select" value={form.productId} onChange={e => setForm({ ...form, productId: e.target.value, quantity: '' })} required>
                    <option value="">Select product...</option>
                    {products.filter(p => parseFloat(p.quantity_on_hand || 0) > 0).map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({parseFloat(p.quantity_on_hand || 0).toLocaleString()} {p.unit || 'units'} — {p.price > 0 ? formatPeso(p.price) + '/' + p.unit : 'No price'})</option>
                    ))}
                  </select>
                </div>
                {form.productId && (
                  <div className="sl-field">
                    <label>Quantity ({getSelectedProduct()?.unit || 'units'})</label>
                    <input type="number" min="1" step="any" placeholder="Enter quantity" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} required />
                  </div>
                )}
              </div>

              {calculateTotalAmount() !== null && (
                <div className="sl-total">
                  <span>Total the customer pays</span>
                  <strong>{formatPeso(calculateTotalAmount())}</strong>
                </div>
              )}

              <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: '0.75rem' }} disabled={submitting}>
                {submitting ? 'Recording...' : 'Review & Record'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="sl-search-bar">
        <div className="sl-search-input-wrap">
          <input type="text" placeholder="Search by product name..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="sl-search-input" />
        </div>
      </div>

      <div className="sl-record-count">
        Showing {filteredSales.length} sale{filteredSales.length !== 1 ? 's' : ''}
      </div>

      {selectedIds.length > 0 && (
        <div className="sl-bulk-bar">
          <span className="sl-bulk-count">{selectedIds.length} selected</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete({ type: 'bulk' })}>
              <Trash2 size={14} /> Delete Selected ({selectedIds.length})
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelectedIds([])}>Clear</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="sl-skeleton-list">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 48, marginBottom: '0.375rem', borderRadius: 8 }}>&nbsp;</div>
          ))}
        </div>
      ) : filteredSales.length === 0 ? (
        <div className="empty-state">
          <ShoppingCart size={36} />
          <p>No product sales recorded yet</p>
          <p style={{ fontSize: '0.8125rem', marginTop: '-0.25rem' }}>Click "Record Sale" to get started</p>
        </div>
      ) : (
        <div className="sl-list">
          {filteredSales.length > 0 && (
            <div className="sl-column-headers">
              <div className="sl-col-check">
                <input type="checkbox" checked={filteredSales.length > 0 && selectedIds.length === filteredSales.length} onChange={handleToggleSelectAll} title="Select all" />
              </div>
              <div className="sl-col-size">Product</div>
              <div className="sl-col-qty">Qty</div>
              <div className="sl-col-amount">Amount</div>
              <div className="sl-col-time">Time</div>
              <div className="sl-col-actions"></div>
            </div>
          )}
          {groupedSales.map(group => (
            <div key={group.label} className="sl-date-group">
              <div className="sl-date-header" onClick={() => setExpandedDate(expandedDate === group.label ? null : group.label)}>
                <span className="sl-date-label">{group.label}</span>
                <div className="sl-date-right">
                  <span className="sl-date-count">{group.sales.length} sale{group.sales.length > 1 ? 's' : ''}</span>
                  <span className={`sl-date-chevron ${expandedDate === group.label ? 'open' : ''}`}>▾</span>
                </div>
              </div>
              {(!expandedDate || expandedDate === group.label) && group.sales.map(sale => (
                <div key={sale.id} className="sl-sale-item">
                  <span className="sl-sale-check">
                    <input type="checkbox" checked={selectedIds.includes(sale.id)} onChange={() => handleToggleSelect(sale.id)} title={`Select ${sale.products?.name || 'Unknown'} sale`} />
                  </span>
                  <div className="sl-sale-left">
                    <span className="sl-sale-size">{sale.products?.name || 'Unknown'}</span>
                    <span className="sl-sale-qty">{parseFloat(sale.quantity || 0).toLocaleString()} units</span>
                  </div>
                  <div className="sl-sale-right">
                    <span className="sl-sale-amount">{formatPeso(sale.total_amount)}</span>
                    <span className="sl-sale-time">{sale.sale_time?.slice(0, 5)}</span>
                    <button className="sl-delete-btn" onClick={() => setConfirmDelete({ type: 'single', id: sale.id, name: sale.products?.name || 'Unknown' })} title="Delete sale">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title={confirmDelete?.type === 'bulk' ? `Delete ${selectedIds.length} sale(s)?` : 'Delete this sale?'}
        message={confirmDelete?.type === 'bulk'
          ? `Delete ${selectedIds.length} product sale(s)? Stock will be restored. This cannot be undone.`
          : `Delete this sale of ${confirmDelete?.name}? Stock will be restored.`}
        confirmLabel="Delete"
        variant="danger"
        icon={Trash2}
        onConfirm={() => {
          if (confirmDelete?.type === 'bulk') { handleBulkDelete(); }
          else { handleDeleteSale(confirmDelete.id); }
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />

      <ConfirmDialog
        open={!!confirmSale}
        title="Record this sale?"
        message={confirmSale ? `Record sale of ${confirmSale.quantity} units of ${confirmSale.productName}? Stock will be deducted automatically.` : ''}
        confirmLabel="Record Sale"
        variant="primary"
        icon={ShoppingCart}
        onConfirm={() => { const d = confirmSale; setConfirmSale(null); executeSale(d); }}
        onCancel={() => setConfirmSale(null)}
      />

      <style>{`
        .ps-page { max-width: 100%; }
      `}</style>
    </div>
  );
}
