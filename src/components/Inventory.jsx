import { useState, useEffect, useCallback } from 'react';
import { Plus, Minus, AlertTriangle, RefreshCw, Trash2, PackagePlus, Package, Egg, Coins, Search } from 'lucide-react';
import { fetchInventory, updateInventory, formatInventory, formatPeso, EGG_SIZES, TRAY_SIZE } from '../lib/api';
import { fetchPriceSettings } from '../lib/pricing';
import { toast } from '../lib/toastFn';
import { getUserFriendlyError } from '../lib/errors';
import ConfirmDialog from './ConfirmDialog';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'in', label: 'In Stock' },
  { key: 'low', label: 'Low' },
  { key: 'out', label: 'Out of Stock' },
];

export default function Inventory() {
  const [inventory, setInventory] = useState([]);
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adjusting, setAdjusting] = useState(null);
  const [adjustInputs, setAdjustInputs] = useState({});
  const [unitInputs, setUnitInputs] = useState({});
  const [confirmItem, setConfirmItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');

  function requestConfirm(item, delta, unit) {
    const qty = Math.abs(delta);
    const isRemove = delta < 0;
    const trayCount = unit === 'trays' ? qty / TRAY_SIZE : null;
    const label = trayCount
      ? `${trayCount} tray${trayCount > 1 ? 's' : ''} (${qty} eggs)`
      : `${qty} egg${qty > 1 ? 's' : ''}`;
    setConfirmItem({ item, delta, label, isRemove });
  }

  const loadInventory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchInventory();
      setInventory(data || []);
    } catch (err) {
      console.error('Inventory load error:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(async () => {
      loadInventory();
      try {
        const settings = await fetchPriceSettings();
        const map = {};
        (settings || []).forEach(s => {
          map[s.egg_size_id] = {
            price_per_piece: parseFloat(s.price_per_piece) || 0,
            price_per_tray: parseFloat(s.price_per_tray) || 0,
          };
        });
        setPrices(map);
      } catch (err) {
        console.error('Price settings load error:', err);
      }
    }, 0);
    return () => clearTimeout(id);
  }, [loadInventory]);

  async function executeAdjust(item, delta) {
    setAdjusting(item.egg_size_id);
    try {
      const currentQty = item.quantity_on_hand || 0;
      const newQty = Math.max(0, currentQty + delta);
      await updateInventory(item.egg_size_id, newQty);
      const actualDelta = newQty - currentQty;
      const name = item.egg_sizes?.name || 'Unknown';
      if (delta < 0 && actualDelta !== delta) {
        toast(`Could only remove ${Math.abs(actualDelta)} from ${name} — all remaining stock cleared (was ${currentQty})`);
      } else {
        const msg = delta > 0
          ? `Added ${delta} to ${name}`
          : `Removed ${Math.abs(delta)} from ${name}`;
        toast(msg, 'success', {
          label: 'Undo',
          onClick: async () => {
            try {
              await updateInventory(item.egg_size_id, currentQty);
              toast(`${name} restored to ${formatInventory(currentQty)}`);
              loadInventory();
            } catch {
              toast('Failed to undo adjustment', 'error');
            }
          },
        });
      }
      loadInventory();
    } catch (err) {
      console.error('Inventory adjust error:', err);
      toast(getUserFriendlyError(err), 'error');
    } finally {
      setAdjusting(null);
    }
  }

  function getUnit(item) {
    return unitInputs[item.egg_size_id] || 'pcs';
  }

  function handleAdd(item) {
    const val = parseInt(adjustInputs[item.egg_size_id], 10);
    if (isNaN(val) || val <= 0) {
      toast('Enter a valid quantity to add', 'error');
      return;
    }
    const unit = getUnit(item);
    requestConfirm(item, unit === 'trays' ? val * TRAY_SIZE : val, unit);
  }

  function handleRemove(item) {
    const val = parseInt(adjustInputs[item.egg_size_id], 10);
    if (isNaN(val) || val <= 0) {
      toast('Enter a valid quantity to remove', 'error');
      return;
    }
    const unit = getUnit(item);
    requestConfirm(item, -(unit === 'trays' ? val * TRAY_SIZE : val), unit);
  }

  const sortedInventory = [...inventory].sort(
    (a, b) => (a.egg_sizes?.sort_order || 0) - (b.egg_sizes?.sort_order || 0)
  );

  const filtered = sortedInventory.filter(item => {
    const qty = item.quantity_on_hand || 0;
    const threshold = item.reorder_level ?? 30;
    if (filter === 'in') return qty > 0 && qty > threshold;
    if (filter === 'low') return qty > 0 && qty <= threshold;
    if (filter === 'out') return qty === 0;
    return true;
  }).filter(item => {
    if (!searchQuery) return true;
    return (item.egg_sizes?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
  });

  const totalQty = sortedInventory.reduce((sum, i) => sum + (i.quantity_on_hand || 0), 0);
  const totalValue = sortedInventory.reduce((sum, i) => {
    const pp = prices[i.egg_size_id]?.price_per_piece || 0;
    return sum + (i.quantity_on_hand || 0) * pp;
  }, 0);

  return (
    <div className="fade-in">
      <div className="page-header-row">
        <div>
          <h1>Inventory</h1>
          <p className="page-subtitle">Add or remove stock by trays or pieces</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadInventory}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error && !loading && (
        <div className="error-banner" style={{ marginBottom: '1rem' }}>
          <AlertTriangle size={20} />
          <div className="error-banner-content">
            <strong>Failed to load inventory</strong>
            <p>{getUserFriendlyError(error)}</p>
          </div>
          <button className="btn btn-sm btn-secondary" onClick={loadInventory}>
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      )}

      {!error && (
        <>
          {/* Stats */}
          <div className="inv-stats">
            <div className="inv-stat-card">
              <Package size={18} />
              <div>
                <span className="inv-stat-value">{sortedInventory.length}</span>
                <span className="inv-stat-label">sizes</span>
              </div>
            </div>
            <div className="inv-stat-card">
              <Egg size={18} />
              <div>
                <span className="inv-stat-value">{totalQty.toLocaleString()}</span>
                <span className="inv-stat-label">eggs in stock</span>
              </div>
            </div>
            <div className="inv-stat-card">
              <Coins size={18} />
              <div>
                <span className="inv-stat-value">{formatPeso(totalValue)}</span>
                <span className="inv-stat-label">egg stock value</span>
              </div>
            </div>
          </div>

          {/* Search + Filter */}
          <div className="inv-controls">
            <div className="search-input-wrapper">
              <Search size={16} className="search-icon" />
              <input type="text" className="input" placeholder="Search sizes..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <div className="inv-filter-tabs">
              {FILTERS.map(f => (
                <button key={f.key} className={`inv-filter-tab ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>{f.label}</button>
              ))}
            </div>
            <span className="inv-count">Showing {filtered.length}</span>
          </div>

          {/* Inventory Grid */}
          {loading ? (
            <div className="inv-grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton inv-card-skeleton">&nbsp;</div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <Package size={36} />
              <p>{sortedInventory.length === 0 ? 'No egg sizes yet' : 'No sizes match your search'}</p>
            </div>
          ) : (
            <div className="inv-grid">
              {filtered.map((item, i) => {
                const qty = item.quantity_on_hand || 0;
                const threshold = item.reorder_level ?? 30;
                const isAdjusting = adjusting === item.egg_size_id;
                const unit = getUnit(item);
                const p = prices[item.egg_size_id] || {};

                let statusClass = 'badge-success';
                let statusText = 'In Stock';
                if (qty === 0) {
                  statusClass = 'badge-danger';
                  statusText = 'Out of Stock';
                } else if (qty <= threshold) {
                  statusClass = 'badge-warning';
                  statusText = 'Low Stock';
                }

                const priceParts = [];
                if (p.price_per_piece > 0) priceParts.push(`${formatPeso(p.price_per_piece)}/pc`);
                if (p.price_per_tray > 0) priceParts.push(`${formatPeso(p.price_per_tray)}/tray`);
                const priceLine = priceParts.length ? priceParts.join(' · ') : null;

                return (
                  <div
                    key={item.id || i}
                    className="inv-card"
                    style={{ animationDelay: `${i * 0.05}s` }}
                  >
                    <h3 className="inv-card-name">
                      {item.egg_sizes?.name || EGG_SIZES[i] || `Size ${i + 1}`}
                    </h3>

                    {priceLine && (
                      <div className="inv-card-pricing">
                        <span className="inv-card-price">{priceLine}</span>
                      </div>
                    )}

                    <div className="inv-card-stock">
                      <span className="inv-qty">{qty.toLocaleString()}</span>
                      <span className={`badge ${statusClass}`}>
                        {qty === 0 && <AlertTriangle size={11} />}
                        {statusText}
                      </span>
                    </div>

                    {qty > 0 && (
                      <div className="inv-breakdown">
                        <span className="inv-breakdown-text">{formatInventory(qty)}</span>
                      </div>
                    )}

                    {/* Stock Adjust Controls */}
                    <div className="inv-adjust-row">
                      <div className="inv-unit-toggle">
                        {['pcs', 'trays'].map(u => (
                          <button
                            key={u}
                            type="button"
                            className={`inv-unit-btn ${unit === u ? 'active' : ''}`}
                            onClick={() => setUnitInputs(prev => ({ ...prev, [item.egg_size_id]: u }))}
                          >
                            {u}
                          </button>
                        ))}
                      </div>
                      <div className="inv-adjust-input-group">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          className="inv-adjust-input"
                          placeholder="Qty"
                          value={adjustInputs[item.egg_size_id] || ''}
                          onChange={e =>
                            setAdjustInputs(prev => ({ ...prev, [item.egg_size_id]: e.target.value }))
                          }
                          onKeyDown={e => {
                            if (e.key === 'Enter' && adjustInputs[item.egg_size_id]) handleAdd(item);
                          }}
                          disabled={isAdjusting}
                        />
                        <button
                          type="button"
                          className="btn-icon inv-adjust-btn inv-adjust-add"
                          onClick={() => handleAdd(item)}
                          disabled={isAdjusting || !adjustInputs[item.egg_size_id]}
                          title="Add stock"
                        >
                          <Plus size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon btn-icon-danger inv-adjust-btn inv-adjust-remove"
                          onClick={() => handleRemove(item)}
                          disabled={
                            isAdjusting ||
                            (unit === 'trays' ? qty < TRAY_SIZE : qty === 0) ||
                            !adjustInputs[item.egg_size_id]
                          }
                          title="Remove stock"
                        >
                          <Minus size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!confirmItem}
        title={confirmItem?.isRemove ? 'Remove stock?' : 'Add stock?'}
        message={confirmItem
          ? confirmItem.isRemove
            ? `Remove ${confirmItem.label} from ${confirmItem.item.egg_sizes?.name}? Current stock: ${formatInventory(confirmItem.item.quantity_on_hand || 0)}.`
            : `Add ${confirmItem.label} to ${confirmItem.item.egg_sizes?.name}? Current stock: ${formatInventory(confirmItem.item.quantity_on_hand || 0)}.`
          : ''}
        confirmLabel={confirmItem?.isRemove ? 'Remove' : 'Add'}
        icon={confirmItem?.isRemove ? Trash2 : PackagePlus}
        onConfirm={() => {
          const { item } = confirmItem;
          setConfirmItem(null);
          executeAdjust(item, confirmItem.delta);
          setAdjustInputs(prev => ({ ...prev, [item.egg_size_id]: '' }));
        }}
        onCancel={() => setConfirmItem(null)}
      />

      <style>{`        .inv-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin-bottom: 1.25rem; }
        .inv-stat-card { display: flex; align-items: center; gap: 0.75rem; padding: 0.875rem 1rem; background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); }
        .inv-stat-card svg { color: var(--color-primary); flex-shrink: 0; }
        .inv-stat-value { display: block; font-weight: 700; font-size: 1.0625rem; }
        .inv-stat-label { display: block; font-size: 0.75rem; color: var(--color-text-muted); }

        .inv-controls { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem; flex-wrap: wrap; }
        .inv-controls .search-input-wrapper { flex: 1; min-width: 200px; max-width: 320px; }
        .inv-controls .search-input-wrapper .input { padding-left: 2rem; height: 2.25rem; font-size: 0.875rem; }
        .inv-filter-tabs { display: flex; gap: 0.25rem; }
        .inv-filter-tab { min-height: 32px; padding: 0.25rem 0.75rem; border: 1.5px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-card); color: var(--color-text-secondary); font-size: 0.75rem; font-weight: 500; cursor: pointer; transition: all var(--transition-fast); }
        .inv-filter-tab:hover { border-color: var(--color-primary); color: var(--color-primary); }
        .inv-filter-tab.active { background: var(--color-primary); border-color: var(--color-primary); color: white; }
        .inv-count { font-size: 0.8125rem; color: var(--color-text-muted); white-space: nowrap; }

        .inv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 0.75rem; }
        .inv-card { padding: 1rem; background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-xs); animation: fadeIn 0.3s ease-out forwards; opacity: 0; transition: all var(--transition-fast); }
        .inv-card:hover { box-shadow: var(--shadow-sm); transform: translateY(-1px); }
        .inv-card-skeleton { height: 160px; border-radius: var(--radius-md); }
        .inv-card-name { font-size: 1rem; font-weight: 700; margin-bottom: 0.375rem; }
        .inv-card-pricing { display: flex; gap: 0.75rem; align-items: center; margin-bottom: 0.375rem; }
        .inv-card-price { font-weight: 700; color: var(--color-primary); font-size: 1.125rem; letter-spacing: 0.01em; }
        .inv-card-stock { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.375rem; }
        .inv-qty { font-weight: 800; font-size: 1.375rem; font-variant-numeric: tabular-nums; }
        .inv-breakdown { margin-top: 0.375rem; }
        .inv-breakdown-text { font-size: 0.8125rem; color: var(--color-text-secondary); background: var(--color-bg); padding: 0.2rem 0.55rem; border-radius: var(--radius-sm); font-weight: 600; }

        .inv-adjust-row { margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--color-border); }
        .inv-unit-toggle { display: flex; gap: 0.25rem; margin-bottom: 0.375rem; }
        .inv-unit-btn { flex: 1; min-height: 28px; padding: 0.15rem; border: 1.5px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-card); color: var(--color-text-secondary); font-size: 0.6875rem; font-weight: 600; cursor: pointer; transition: all var(--transition-fast); }
        .inv-unit-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
        .inv-unit-btn.active { background: var(--color-primary); border-color: var(--color-primary); color: white; }
        .inv-adjust-input-group { display: flex; align-items: center; gap: 0.25rem; }
        .inv-adjust-input { flex: 1; min-width: 0; padding: 0.4rem 0.5rem; border: 1px solid var(--color-border); border-radius: var(--radius-sm); font-size: 0.8125rem; text-align: center; background: var(--color-card); color: var(--color-text); outline: none; }
        .inv-adjust-input:focus { border-color: var(--color-primary); background: var(--color-primary-light); }
        .inv-adjust-input::placeholder { color: var(--color-text-muted); font-size: 0.6875rem; }
        .inv-adjust-btn { padding: 0.4rem 0.5rem !important; border-radius: var(--radius-sm) !important; }
        .inv-adjust-add { color: var(--color-primary) !important; }
        .inv-adjust-add:hover { background: var(--color-primary-light) !important; border-color: var(--color-primary) !important; }
        .inv-adjust-remove:hover { background: var(--color-danger-bg) !important; border-color: var(--color-danger) !important; }

        @media (max-width: 640px) {
          .inv-stats { grid-template-columns: 1fr; }
          .inv-controls { flex-direction: column; align-items: stretch; }
          .inv-controls .search-input-wrapper { max-width: none; }
          .inv-grid { grid-template-columns: 1fr; }
          .inv-qty { font-size: 1.25rem; }
        }
      `}</style>
    </div>
  );
}
