import { useState, useEffect, useCallback } from 'react';
import {
  ShoppingCart,
  AlertTriangle,
  RefreshCw,
  ClipboardCheck,
  TrendingUp,
  Trash2,
} from 'lucide-react';
import { fetchSales, fetchInventory, recordSale, deleteSale, deleteSales, getEggCount, formatPeso, formatInventory, getLocalDate, TRAY_SIZE } from '../lib/api';

import { toast } from '../lib/toastFn';
import { getUserFriendlyError } from '../lib/errors';
import ConfirmDialog from './ConfirmDialog';

export default function SalesLog() {
  const [sales, setSales] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const today = getLocalDate();

  const [filter, setFilter] = useState('today');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [customStart, setCustomStart] = useState(today);
  const [customEnd, setCustomEnd] = useState(today);

  const [confirmSale, setConfirmSale] = useState(null);
  const [expandedDate, setExpandedDate] = useState(null);
  const PAGE_SIZE = 50;
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [selectedIds, setSelectedIds] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const limit = filter === 'today' || (startDate && endDate) ? 500 : 100;
      const [salesData, invData] = await Promise.all([
        fetchSales({ limit, offset: 0, startDate, endDate }),
        fetchInventory(),
      ]);
      setSales(salesData || []);
      setInventory(invData || []);
      setHasMore(salesData && salesData.length === limit);
      setPage(0);
    } catch (err) {
      console.error('Sales load error:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, filter]);

  useEffect(() => {
    const id = setTimeout(() => loadData(), 0);
    return () => clearTimeout(id);
  }, [loadData]);

  async function loadMore() {
    try {
      const nextPage = page + 1;
      const limit = PAGE_SIZE;
      const salesData = await fetchSales({ limit, offset: nextPage * PAGE_SIZE, startDate, endDate });
      setSales(prev => [...prev, ...(salesData || [])]);
      setHasMore(salesData && salesData.length === limit);
      setPage(nextPage);
    } catch (err) {
      console.error('Load more error:', err);
      toast('Failed to load more sales', 'error');
    }
  }

  function getFilteredSales() {
    let result = [...sales];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        (s.egg_sizes?.name && s.egg_sizes.name.toLowerCase().includes(q))
      );
    }
    result.sort((a, b) => {
      let cmp;
      if (sortField === 'egg_size_name') {
        cmp = (a.egg_sizes?.name || '').localeCompare(b.egg_sizes?.name || '');
      } else if (sortField === 'quantity') {
        cmp = (a.quantity || 0) - (b.quantity || 0);
      } else if (sortField === 'amount') {
        cmp = parseFloat(a.total_amount || 0) - parseFloat(b.total_amount || 0);
      } else {
        cmp = (a.created_at || '').localeCompare(b.created_at || '');
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return result;
  }

  const filteredSales = getFilteredSales();
  const periodTotalEggs = filteredSales.reduce((sum, s) => sum + getEggCount(s), 0);
  const periodRevenue = filteredSales.reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0);

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

  const groupedSales = groupByDate(filteredSales, today);

  function handleSort(field) {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }



  function sortIcon(field) {
    if (sortField !== field) return ' ↕';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  }

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

  function handleToggleSelect(id) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
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
      const deletedSale = await deleteSale(id);
      toast('Sale deleted — stock restored', 'success', {
        label: 'Undo',
        onClick: async () => {
          try {
            await recordSale({
              eggSizeId: deletedSale.egg_size_id,
              quantity: deletedSale.quantity,
              unit: deletedSale.unit,
              traySize: deletedSale.tray_size || TRAY_SIZE,
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

    try {
      await deleteSales(selectedIds);
      
      toast(`Deleted ${selectedIds.length} sale(s) — stock restored`, 'success', {
        label: 'Undo',
        onClick: async () => {
          try {
            if (!salesToDelete || salesToDelete.length === 0) return;
            for (const sale of salesToDelete) {
              await recordSale({
                eggSizeId: sale.egg_size_id,
                quantity: sale.quantity,
                unit: sale.unit,
                traySize: sale.tray_size || TRAY_SIZE,
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
      loadData();
    } catch (err) {
      console.error('Bulk delete error:', err);
      toast('Failed to delete sales', 'error');
    }
  }

  return (
    <div className="sl-page fade-in">
      {/* Header */}
      <div className="sl-header">
        <div>
          <h1>Sales Log</h1>
          <p className="page-subtitle">Record and view egg sales</p>
        </div>
      </div>

      {/* Stats */}
      <div className="sl-stats">
        <div className="sl-stat">
          <ShoppingCart size={18} />
          <div>
            <span className="sl-stat-val">{periodTotalEggs.toLocaleString()}</span>
            <span className="sl-stat-lbl">{filter === 'today' ? 'eggs today' : 'eggs'}</span>
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

      {/* Filter */}
      <div className="sl-filter-bar">
        <div className="sl-filter-tabs">
          {[
            { key: 'today', label: 'Today' },
            { key: 'yesterday', label: 'Yesterday' },
            { key: 'week', label: 'Week' },
            { key: 'month', label: 'Month' },
            { key: 'custom', label: 'Custom' },
          ].map(p => (
            <button
              key={p.key}
              className={`sl-filter-tab ${filter === p.key ? 'active' : ''}`}
              onClick={() => changeFilter(p.key)}
            >
              {p.label}
            </button>
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

      {/* Search */}
        <div className="sl-search-bar">
          <div className="sl-search-input-wrap">
            <input
              type="text"
              placeholder="Search by customer or egg size..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="sl-search-input"
            />
          </div>
        </div>

        {/* Record count */}
        <div className="sl-record-count">
          Showing {filteredSales.length} of {hasMore ? `${sales.length}+` : sales.length} sales
        </div>

        {/* Bulk delete bar */}
        {selectedIds.length > 0 && (
          <div className="sl-bulk-bar">
            <span className="sl-bulk-count">{selectedIds.length} selected</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete({ type: 'bulk' })}>
                <Trash2 size={14} />
                Delete Selected ({selectedIds.length})
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedIds([])}>
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Sales List */}
      {loading ? (
        <div className="sl-skeleton-list">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 48, marginBottom: '0.375rem', borderRadius: 8 }}>&nbsp;</div>
          ))}
        </div>
      ) : filteredSales.length === 0 ? (
        <div className="empty-state">
          <ShoppingCart size={36} />
          <p>No sales recorded yet</p>
          <p style={{ fontSize: '0.8125rem', marginTop: '-0.25rem' }}>Click <a href="/M-EFresheggs/sales/new" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>New Sale</a> in the sidebar to get started</p>
        </div>
      ) : (
        <div className="sl-list">
          {filteredSales.length > 0 && (
            <div className="sl-column-headers">
              <div className="sl-col-check">
                <input
                  type="checkbox"
                  checked={filteredSales.length > 0 && selectedIds.length === filteredSales.length}
                  onChange={handleToggleSelectAll}
                  title="Select all"
                />
              </div>
              <div className="sl-col-size" onClick={() => handleSort('egg_size_name')} style={{cursor:'pointer'}}>
                Size Name<span className="sl-sort-icon">{sortIcon('egg_size_name')}</span>
              </div>
              <div className="sl-col-qty" onClick={() => handleSort('quantity')} style={{cursor:'pointer'}}>
                Qty<span className="sl-sort-icon">{sortIcon('quantity')}</span>
              </div>
              <div className="sl-col-eggs">Eggs</div>
              <div className="sl-col-amount" onClick={() => handleSort('amount')} style={{cursor:'pointer'}}>
                Amount<span className="sl-sort-icon">{sortIcon('amount')}</span>
              </div>
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
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(sale.id)}
                      onChange={() => handleToggleSelect(sale.id)}
                      title={`Select ${sale.egg_sizes?.name || 'Unknown'} sale`}
                    />
                  </span>
                  <div className="sl-sale-left">
                    <span className="sl-sale-size">{sale.egg_sizes?.name || 'Unknown'}</span>
                    <span className="sl-sale-qty">
                      {sale.quantity} {sale.unit === 'tray' ? `tray${sale.quantity > 1 ? 's' : ''}` : `egg${sale.quantity > 1 ? 's' : ''}`}
                    </span>
                    <span className="sl-sale-eggs">{formatInventory(getEggCount(sale))}</span>
                  </div>
                  <div className="sl-sale-right">
                    <span className="sl-sale-amount">{formatPeso(sale.total_amount)}</span>
                    <span className="sl-sale-time">{sale.sale_time?.slice(0, 5)}</span>
                    <button
                      className="sl-delete-btn"
                      onClick={() => setConfirmDelete({ type: 'single', id: sale.id, name: sale.egg_sizes?.name || 'Unknown' })}
                      title="Delete sale"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {hasMore && !loading && (
        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button className="btn btn-secondary" onClick={loadMore}>Load More</button>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title={confirmDelete?.type === 'bulk' ? `Delete ${selectedIds.length} sale(s)?` : 'Delete this sale?'}
        message={confirmDelete?.type === 'bulk'
          ? `Delete ${selectedIds.length} sale(s)? Stock will be restored. This cannot be undone.`
          : `Delete this sale of ${confirmDelete?.name}? Stock will be restored.`}
        confirmLabel="Delete"
        variant="danger"
        icon={Trash2}
        onConfirm={() => {
          if (confirmDelete?.type === 'bulk') {
            handleBulkDelete();
          } else {
            handleDeleteSale(confirmDelete.id);
          }
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />

      <ConfirmDialog
        open={!!confirmSale}
        title="Record this sale?"
        message={confirmSale ? (() => {
          const sn = inventory.find(i => i.egg_size_id === confirmSale.eggSizeId)?.egg_sizes?.name || 'Unknown';
          const ql = confirmSale.unit === 'tray'
            ? `${confirmSale.quantity} tray${confirmSale.quantity > 1 ? 's' : ''} (${confirmSale.quantity * confirmSale.traySize} eggs)`
            : `${confirmSale.quantity} egg${confirmSale.quantity > 1 ? 's' : ''}`;
          return `Record sale of ${ql} of ${sn}? Stock will be deducted automatically.`;
        })() : ''}
        confirmLabel="Record Sale"
        variant="primary"
        icon={ClipboardCheck}
        onConfirm={() => { const d = confirmSale; setConfirmSale(null); recordSale(d); }}
        onCancel={() => setConfirmSale(null)}
      />

      <style>{`
        .sl-page { max-width: 100%; }

        .sl-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: var(--space-xl); gap: var(--space-lg); }

        /* Size Cards */
        .sl-field-sizes {
          grid-column: 1 / -1;
        }

        .sl-size-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
        }

        @media (max-width: 500px) {
          .sl-size-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        .sl-size-card {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.2rem;
          padding: 0.75rem 0.5rem;
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-md);
          background: var(--color-card);
          cursor: pointer;
          transition: all var(--transition-fast);
          min-height: 72px;
        }

        .sl-size-card:hover {
          border-color: var(--color-primary-200);
          background: var(--color-primary-50);
          transform: translateY(-1px);
          box-shadow: var(--shadow-sm);
        }

        .sl-size-card.selected {
          border-color: var(--color-primary);
          border-width: 2px;
          background: var(--color-primary-light);
          box-shadow: 0 0 0 2px var(--color-primary-200);
        }

        .sl-size-check {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--color-primary);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .sl-size-name {
          font-weight: 700;
          font-size: 0.875rem;
          color: var(--color-text);
        }

        .sl-size-card.selected .sl-size-name {
          color: var(--color-primary);
        }

        .sl-size-stock {
          font-size: 0.6875rem;
          color: var(--color-text-muted);
          font-variant-numeric: tabular-nums;
        }

        .sl-size-badge {
          display: inline-block;
          padding: 0.1rem 0.4rem;
          border-radius: var(--radius-full);
          font-size: 0.6rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .sl-size-stock-ok { background: var(--color-success-bg); color: var(--color-success); }
        .sl-size-stock-low { background: var(--color-warning-bg); color: var(--color-warning); }
        .sl-size-stock-out { background: var(--color-danger-bg); color: var(--color-danger); }

        .sl-size-card.out-of-stock {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .sl-size-card.out-of-stock:hover {
          transform: none;
          box-shadow: none;
          border-color: var(--color-border);
          background: var(--color-card);
        }

        .sl-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem; }
        .sl-stat { display: flex; align-items: center; gap: 0.75rem; padding: 0.875rem 1rem; background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); }
        .sl-stat svg { color: var(--color-primary); flex-shrink: 0; }
        .sl-stat-val { display: block; font-weight: 700; font-size: 1.0625rem; }
        .sl-stat-lbl { display: block; font-size: 0.75rem; color: var(--color-text-muted); }

        /* Filter */
        .sl-filter-bar { margin-bottom: 1rem; }
        .sl-filter-tabs { display: flex; gap: 0.25rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
        .sl-filter-tab { min-height: 40px; padding: 0.4rem 1rem; border: 1.5px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-card); color: var(--color-text-secondary); font-size: 0.8125rem; font-weight: 500; cursor: pointer; transition: all var(--transition-fast); }
        .sl-filter-tab:hover { border-color: var(--color-primary); color: var(--color-primary); }
        .sl-filter-tab.active { background: var(--color-primary); border-color: var(--color-primary); color: white; }
        .sl-custom-dates { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
        .sl-date-input { flex: 1; max-width: 180px; padding: 0.4rem 0.625rem; border: 1.5px solid var(--color-border); border-radius: var(--radius-sm); font-size: 0.8125rem; color: var(--color-text); background: var(--color-card); outline: none; }
        .sl-date-input:focus { border-color: var(--color-primary); }
        .sl-date-sep { color: var(--color-text-muted); }

        /* Modal */
        .sl-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); backdrop-filter: blur(4px); z-index: 5000; display: flex; align-items: center; justify-content: center; animation: fadeIn 0.15s ease-out; }
        .sl-modal { width: 100%; max-width: 500px; margin: 1rem; background: var(--color-card); border-radius: var(--radius-xl); box-shadow: var(--shadow-xl); animation: scaleIn 0.2s ease-out; max-height: 90vh; overflow-y: auto; }
        .sl-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.25rem 0; }
        .sl-modal-header h3 { font-size: 1.125rem; }
        .sl-modal-close { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border: none; border-radius: var(--radius-sm); background: transparent; color: var(--color-text-secondary); cursor: pointer; }
        .sl-modal-close:hover { background: var(--color-primary-light); color: var(--color-primary); }
        .sl-modal form { padding: 1.25rem; }

        .sl-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.875rem; }
        @media (max-width: 500px) { .sl-form-grid { grid-template-columns: 1fr; } }

        .sl-field { display: flex; flex-direction: column; gap: 0.3rem; }
        .sl-field label { font-size: 0.75rem; font-weight: 600; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.03em; }
        .sl-field select, .sl-field input { width: 100%; padding: 0.625rem 0.75rem; border: 1.5px solid var(--color-border); border-radius: var(--radius-sm); font-size: 0.9375rem; color: var(--color-text); background: var(--color-card); outline: none; }
        .sl-field select:focus, .sl-field input:focus { border-color: var(--color-primary); }
        .sl-price-hint { font-size: 0.75rem; color: var(--color-text-muted); margin-top: 0.125rem; }

        .sl-unit-tabs { display: flex; gap: 0.375rem; }
        .sl-unit-tab { flex: 1; min-height: 40px; padding: 0.5rem; border: 1.5px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-card); color: var(--color-text-secondary); font-size: 0.8125rem; font-weight: 500; cursor: pointer; transition: all var(--transition-fast); }
        .sl-unit-tab:hover { border-color: var(--color-primary); color: var(--color-primary); }
        .sl-unit-tab.active { background: var(--color-primary); border-color: var(--color-primary); color: white; }

        .sl-quick-chips { display: flex; gap: 0.375rem; margin-top: 0.25rem; }
        .sl-chip { min-height: 32px; padding: 0.25rem 0.75rem; border: 1px solid var(--color-border); border-radius: var(--radius-full); background: var(--color-card); color: var(--color-text-secondary); font-size: 0.75rem; font-weight: 500; cursor: pointer; transition: all var(--transition-fast); }
        .sl-chip:hover { background: var(--color-primary); border-color: var(--color-primary); color: white; }

        .sl-conversion { display: flex; align-items: center; gap: 0.375rem; padding: 0.5rem 0.75rem; background: var(--color-bg); border-radius: var(--radius-sm); font-size: 0.8125rem; color: var(--color-text-secondary); margin-top: 0.75rem; }

        .sl-total { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: var(--color-primary-50); border-radius: var(--radius-md); font-size: 0.9375rem; margin-top: 0.75rem; }
        .sl-total strong { color: var(--color-primary); font-size: 1.0625rem; }

        /* Sales List */
        .sl-skeleton-list { padding: 0; }
        .sl-list { display: flex; flex-direction: column; gap: 0.5rem; }

        .sl-date-group { border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-card); overflow: hidden; box-shadow: var(--shadow-xs); }
        .sl-date-header { display: flex; align-items: center; justify-content: space-between; padding: 0.625rem 1rem; cursor: pointer; user-select: none; transition: background var(--transition-fast); }
        .sl-date-header:hover { background: var(--color-bg); }
        .sl-date-label { font-weight: 700; font-size: 0.8125rem; }
        .sl-date-right { display: flex; align-items: center; gap: 0.5rem; }
        .sl-date-count { font-size: 0.6875rem; color: var(--color-text-muted); }
        .sl-date-chevron { font-size: 0.625rem; color: var(--color-text-muted); transition: transform var(--transition-fast); }
        .sl-date-chevron.open { transform: rotate(180deg); }

        .sl-date-sales { }
        .sl-sale-item { display: flex; align-items: center; justify-content: space-between; padding: 0.625rem 1rem; border-top: 1px solid var(--color-border); transition: background var(--transition-fast); }
        .sl-sale-item:hover { background: var(--color-bg); }
        .sl-sale-left { display: flex; align-items: center; gap: 0.75rem; min-width: 0; }
        .sl-sale-size { font-weight: 600; font-size: 0.875rem; min-width: 70px; }
        .sl-sale-qty { font-size: 0.8125rem; color: var(--color-text-secondary); }
        .sl-sale-eggs { font-size: 0.75rem; color: var(--color-text-muted); }
        .sl-sale-right { text-align: right; }
        .sl-sale-amount { font-weight: 700; color: var(--color-primary); font-variant-numeric: tabular-nums; }
        .sl-sale-time { font-size: 0.6875rem; color: var(--color-text-muted); }

        /* Search */
        .sl-search-bar { margin-bottom: 0.75rem; }
        .sl-search-input-wrap { position: relative; }
        .sl-search-input { width: 100%; padding: 0.625rem 0.75rem; border: 1.5px solid var(--color-border); border-radius: var(--radius-sm); font-size: 0.875rem; color: var(--color-text); background: var(--color-card); outline: none; box-sizing: border-box; }
        .sl-search-input:focus { border-color: var(--color-primary); }

        .sl-record-count { font-size: 0.75rem; color: var(--color-text-muted); margin-bottom: 0.5rem; }

        .sl-bulk-bar { display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0.75rem; background: var(--color-primary-50); border: 1px solid var(--color-primary); border-radius: var(--radius-sm); margin-bottom: 0.5rem; }
        .sl-bulk-count { font-size: 0.8125rem; font-weight: 600; color: var(--color-primary); }

        .sl-column-headers { display: flex; align-items: center; padding: 0.5rem 1rem; border-bottom: 2px solid var(--color-border); font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-text-muted); gap: 0.75rem; }
        .sl-column-headers > div { user-select: none; }
        .sl-col-check { width: 36px; flex-shrink: 0; display: flex; align-items: center; }
        .sl-col-check input { width: 16px; height: 16px; cursor: pointer; }
        .sl-col-size { flex: 1; min-width: 70px; }
        .sl-col-qty { width: 80px; flex-shrink: 0; }
        .sl-col-eggs { width: 60px; flex-shrink: 0; }
        .sl-col-amount { width: 90px; flex-shrink: 0; text-align: right; }
        .sl-col-time { width: 50px; flex-shrink: 0; text-align: right; }
        .sl-col-actions { width: 36px; flex-shrink: 0; }
        .sl-sort-icon { font-size: 0.625rem; margin-left: 0.25rem; }

        .sl-sale-check { display: flex; align-items: center; flex-shrink: 0; }
        .sl-sale-check input { width: 16px; height: 16px; cursor: pointer; }

        .sl-delete-btn {
          display: flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; border: none; border-radius: var(--radius-sm);
          background: transparent; color: var(--color-text-muted); cursor: pointer;
          transition: all 0.15s; flex-shrink: 0; margin-left: 0.25rem;
        }
        .sl-delete-btn:hover { background: var(--color-danger-bg); color: var(--color-danger); }

        /* Mobile */
        @media (max-width: 640px) {
          .sl-sale-item { flex-direction: column; align-items: flex-start; gap: 0.25rem; }
          .sl-sale-left { width: 100%; }
          .sl-sale-right { width: 100%; display: flex; justify-content: space-between; align-items: center; }
          .sl-custom-dates { flex-wrap: wrap; }
          .sl-date-input { max-width: none; flex: 1; min-width: 100px; }
          .sl-column-headers { display: none; }
          .sl-sale-check { position: absolute; left: 0.25rem; }
          .sl-sale-item { position: relative; padding-left: 2rem; }
          .sl-delete-btn { position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%); }
        }
      `}</style>
    </div>
  );
}
