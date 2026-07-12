import { useState, useEffect, useCallback } from 'react';
import {
  ShoppingCart,
  AlertTriangle,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { deleteProductSale, deleteProductSales, recordProductSale, fetchProductSales, fetchProducts, formatPeso, getLocalDate } from '../lib/api';
import { toast } from '../lib/toastFn';
import { getUserFriendlyError } from '../lib/errors';
import ConfirmDialog from './ConfirmDialog';



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
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [expandedDate, setExpandedDate] = useState(null);
  const today = getLocalDate();

  const [filter, setFilter] = useState('today');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [customStart, setCustomStart] = useState(today);
  const [customEnd, setCustomEnd] = useState(today);

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

  function handleToggleSelect(id) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function handleToggleSelectAll() {
    if (selectedIds.length === filteredSales.length) setSelectedIds([]);
    else setSelectedIds(filteredSales.map(s => s.id));
  }

  async function handleDeleteSale(id) {
    try {
      const deletedSale = await deleteProductSale(id);
      toast('Sale deleted — stock restored', 'success', {
        label: 'Undo',
        onClick: async () => {
          try {
            await recordProductSale({ productId: deletedSale.product_id, quantity: deletedSale.quantity, saleDate: deletedSale.sale_date });
            toast('Sale restored');
            loadData();
          } catch (err) {
            console.error('Undo error:', err);
            toast('Failed to restore sale', 'error');
          }
        },
      });
      loadData();
    } catch (err) {
      console.error('Delete error:', err);
      toast('Failed to delete sale', 'error');
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return;
    const salesToDelete = sales.filter(s => selectedIds.includes(s.id));
    try {
      await deleteProductSales(selectedIds);
      toast(`Deleted ${selectedIds.length} sale(s) — stock restored`, 'success', {
        label: 'Undo',
        onClick: async () => {
          try {
            if (!salesToDelete || salesToDelete.length === 0) return;
            for (const sale of salesToDelete) {
              await recordProductSale({ productId: sale.product_id, quantity: sale.quantity, saleDate: sale.sale_date });
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
      loadData();
    } catch (err) {
      console.error('Bulk delete error:', err);
      toast('Failed to delete sales', 'error');
    }
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header-row">
        <div>
          <h1>Product Sales</h1>
          <p className="page-subtitle">Record and view product sales</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/sales/new')}>
          Record Sale
        </button>
      </div>

      {/* Stats */}
      <div className="ps-stats">
        <div className="ps-stat">
          <ShoppingCart size={18} />
          <div>
            <span className="ps-stat-val">{periodQty.toLocaleString()}</span>
            <span className="ps-stat-lbl">{filter === 'today' ? 'units today' : 'units sold'}</span>
          </div>
        </div>
        <div className="ps-stat">
          <TrendingUp size={18} />
          <div>
            <span className="ps-stat-val">{formatPeso(periodRevenue)}</span>
            <span className="ps-stat-lbl">{filter === 'today' ? 'revenue today' : 'revenue'}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="ps-filter-bar">
        <div className="ps-filter-tabs">
          {[{ key: 'today', label: 'Today' }, { key: 'yesterday', label: 'Yesterday' }, { key: 'week', label: 'Week' }, { key: 'month', label: 'Month' }, { key: 'custom', label: 'Custom' }].map(p => (
            <button key={p.key} className={`ps-filter-tab ${filter === p.key ? 'active' : ''}`} onClick={() => changeFilter(p.key)}>{p.label}</button>
          ))}
        </div>
        {filter === 'custom' && (
          <div className="ps-custom-dates">
            <input type="date" className="ps-date-input" value={customStart} onChange={e => setCustomStart(e.target.value)} />
            <span className="ps-date-sep">→</span>
            <input type="date" className="ps-date-input" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
            <button className="btn btn-primary btn-sm" onClick={applyCustom}>Go</button>
          </div>
        )}
      </div>

      {error && !loading && (
        <div className="error-banner" style={{ marginBottom: '1rem' }}>
          <AlertTriangle size={20} />
          <div className="error-banner-content"><strong>Failed to load</strong><p>{getUserFriendlyError(error)}</p></div>
          <button className="btn btn-sm btn-secondary" onClick={loadData}><RefreshCw size={14} /> Retry</button>
        </div>
      )}

      {/* Search */}
      <div className="ps-search-bar">
        <input type="text" className="ps-search-input" placeholder="Search by product name..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
      </div>

      <div className="ps-record-count">
        Showing {filteredSales.length} sale{filteredSales.length !== 1 ? 's' : ''}
      </div>

      {/* Bulk delete */}
      {selectedIds.length > 0 && (
        <div className="ps-bulk-bar">
          <span className="ps-bulk-count">{selectedIds.length} selected</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete({ type: 'bulk' })}>
              <Trash2 size={14} /> Delete Selected ({selectedIds.length})
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelectedIds([])}>Clear</button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div>
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
        <div>
          {/* Column headers */}
          <div className="ps-col-headers">
            <div className="ps-col-check">
              <input type="checkbox" checked={selectedIds.length === filteredSales.length && filteredSales.length > 0} onChange={handleToggleSelectAll} title="Select all" />
            </div>
            <div className="ps-col-product">Product</div>
            <div className="ps-col-qty">Qty</div>
            <div className="ps-col-amount">Amount</div>
            <div className="ps-col-time">Time</div>
            <div className="ps-col-actions"></div>
          </div>

          {groupedSales.map(group => (
            <div key={group.label} className="ps-date-group">
              <div className="ps-date-header" onClick={() => setExpandedDate(expandedDate === group.label ? null : group.label)}>
                <span className="ps-date-label">{group.label}</span>
                <div className="ps-date-right">
                  <span className="ps-date-count">{group.sales.length} sale{group.sales.length > 1 ? 's' : ''}</span>
                  <span className={`ps-date-chevron ${expandedDate === group.label ? 'open' : ''}`}>▾</span>
                </div>
              </div>
              {(!expandedDate || expandedDate === group.label) && group.sales.map(sale => (
                <div key={sale.id} className="ps-sale-row">
                  <span className="ps-sale-check">
                    <input type="checkbox" checked={selectedIds.includes(sale.id)} onChange={() => handleToggleSelect(sale.id)} title={`Select ${sale.products?.name || 'Unknown'}`} />
                  </span>
                  <div className="ps-sale-left">
                    <span className="ps-sale-name">{sale.products?.name || 'Unknown'}</span>
                    <span className="ps-sale-qty">{parseFloat(sale.quantity || 0).toLocaleString()} units</span>
                  </div>
                  <div className="ps-sale-right">
                    <span className="ps-sale-amount">{formatPeso(sale.total_amount)}</span>
                    <span className="ps-sale-time">{sale.sale_time?.slice(0, 5)}</span>
                    <button className="ps-delete-btn" onClick={() => setConfirmDelete({ type: 'single', id: sale.id, name: sale.products?.name || 'Unknown' })} title="Delete sale">
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
        confirmLabel="Delete" variant="danger" icon={Trash2}
        onConfirm={() => { if (confirmDelete?.type === 'bulk') handleBulkDelete(); else handleDeleteSale(confirmDelete.id); setConfirmDelete(null); }}
        onCancel={() => setConfirmDelete(null)}
      />

      <ConfirmDialog
        open={!!confirmSale}
        title="Record this sale?"
        message={confirmSale ? `Record sale of ${confirmSale.quantity} units of ${confirmSale.productName}? Stock will be deducted automatically.` : ''}
        confirmLabel="Record Sale" variant="primary" icon={ShoppingCart}
        onConfirm={() => { const d = confirmSale; setConfirmSale(null); executeSale(d); }}
        onCancel={() => setConfirmSale(null)}
      />

      <style>{`
        .ps-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem; }
        .ps-stat { display: flex; align-items: center; gap: 0.75rem; padding: 0.875rem 1rem; background: var(--color-card); border: 1px solid var(--color-border-light); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); }
        .ps-stat svg { color: var(--color-primary); flex-shrink: 0; }
        .ps-stat-val { display: block; font-weight: 700; font-size: 1.0625rem; }
        .ps-stat-lbl { display: block; font-size: 0.75rem; color: var(--color-text-muted); }

        .ps-filter-bar { margin-bottom: 1rem; }
        .ps-filter-tabs { display: flex; gap: 0.25rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
        .ps-filter-tab { min-height: 40px; padding: 0.4rem 1rem; border: 1.5px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-card); color: var(--color-text-secondary); font-size: 0.8125rem; font-weight: 500; cursor: pointer; transition: all var(--transition-fast); }
        .ps-filter-tab:hover { border-color: var(--color-primary); color: var(--color-primary); }
        .ps-filter-tab.active { background: var(--color-primary); border-color: var(--color-primary); color: white; }
        .ps-custom-dates { display: flex; align-items: center; gap: 0.5rem; }
        .ps-date-input { flex: 1; max-width: 180px; padding: 0.4rem 0.625rem; border: 1.5px solid var(--color-border); border-radius: var(--radius-sm); font-size: 0.8125rem; color: var(--color-text); background: var(--color-card); outline: none; }
        .ps-date-input:focus { border-color: var(--color-primary); }
        .ps-date-sep { color: var(--color-text-muted); }

        .ps-search-bar { margin-bottom: 0.75rem; }
        .ps-search-input { width: 100%; padding: 0.625rem 0.75rem; border: 1.5px solid var(--color-border); border-radius: var(--radius-sm); font-size: 0.875rem; color: var(--color-text); background: var(--color-card); outline: none; box-sizing: border-box; }
        .ps-search-input:focus { border-color: var(--color-primary); }

        .ps-record-count { font-size: 0.75rem; color: var(--color-text-muted); margin-bottom: 0.5rem; }

        .ps-bulk-bar { display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0.75rem; background: var(--color-primary-50); border: 1px solid var(--color-primary); border-radius: var(--radius-sm); margin-bottom: 0.5rem; }
        .ps-bulk-count { font-size: 0.8125rem; font-weight: 600; color: var(--color-primary); }

        .ps-col-headers { display: flex; align-items: center; padding: 0.5rem 1rem; border-bottom: 2px solid var(--color-border); font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-text-muted); gap: 0.75rem; background: var(--color-card); border-radius: var(--radius-md) var(--radius-md) 0 0; }
        .ps-col-check { width: 36px; flex-shrink: 0; display: flex; align-items: center; }
        .ps-col-check input { width: 16px; height: 16px; cursor: pointer; }
        .ps-col-product { flex: 1; min-width: 100px; }
        .ps-col-qty { width: 80px; flex-shrink: 0; }
        .ps-col-amount { width: 100px; flex-shrink: 0; text-align: right; }
        .ps-col-time { width: 60px; flex-shrink: 0; text-align: right; }
        .ps-col-actions { width: 36px; flex-shrink: 0; }

        .ps-date-group { border: 1px solid var(--color-border-light); border-radius: var(--radius-md); background: var(--color-card); overflow: hidden; box-shadow: var(--shadow-xs); margin-bottom: 0.5rem; }
        .ps-date-header { display: flex; align-items: center; justify-content: space-between; padding: 0.625rem 1rem; cursor: pointer; user-select: none; transition: background var(--transition-fast); }
        .ps-date-header:hover { background: var(--color-bg); }
        .ps-date-label { font-weight: 700; font-size: 0.8125rem; }
        .ps-date-right { display: flex; align-items: center; gap: 0.5rem; }
        .ps-date-count { font-size: 0.6875rem; color: var(--color-text-muted); }
        .ps-date-chevron { font-size: 0.625rem; color: var(--color-text-muted); transition: transform var(--transition-fast); }
        .ps-date-chevron.open { transform: rotate(180deg); }

        .ps-sale-row { display: flex; align-items: center; justify-content: space-between; padding: 0.625rem 1rem; border-top: 1px solid var(--color-border-light); transition: background var(--transition-fast); gap: 0.75rem; }
        .ps-sale-row:hover { background: var(--color-bg); }
        .ps-sale-check { display: flex; align-items: center; flex-shrink: 0; }
        .ps-sale-check input { width: 16px; height: 16px; cursor: pointer; }
        .ps-sale-left { display: flex; align-items: center; gap: 0.75rem; min-width: 0; flex: 1; }
        .ps-sale-name { font-weight: 600; font-size: 0.875rem; min-width: 80px; }
        .ps-sale-qty { font-size: 0.8125rem; color: var(--color-text-secondary); }
        .ps-sale-right { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
        .ps-sale-amount { font-weight: 700; color: var(--color-primary); font-variant-numeric: tabular-nums; }
        .ps-sale-time { font-size: 0.6875rem; color: var(--color-text-muted); }
        .ps-delete-btn { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: none; border-radius: var(--radius-sm); background: transparent; color: var(--color-text-muted); cursor: pointer; transition: all 0.15s; flex-shrink: 0; }
        .ps-delete-btn:hover { background: var(--color-danger-bg); color: var(--color-danger); }

        @media (max-width: 640px) {
          .ps-stats { grid-template-columns: 1fr; }
          .ps-col-headers { display: none; }
          .ps-sale-row { flex-wrap: wrap; }
          .ps-sale-left { width: 100%; }
          .ps-sale-right { width: 100%; justify-content: space-between; }
          .ps-sale-check { position: absolute; left: 0.25rem; }
          .ps-sale-row { position: relative; padding-left: 2rem; }
          .ps-delete-btn { position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%); }
          .ps-custom-dates { flex-wrap: wrap; }
          .ps-date-input { max-width: none; flex: 1; min-width: 100px; }
        }
      `}</style>
    </div>
  );
}
