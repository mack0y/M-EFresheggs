import { useState, useEffect } from 'react';
import { Plus, Minus, AlertTriangle, RefreshCw, Trash2, PackagePlus } from 'lucide-react';
import { fetchInventory, updateInventory, formatInventory, EGG_SIZES } from '../lib/api';
import { toast } from './Toast';
import { getUserFriendlyError } from '../lib/errors';
import ConfirmDialog from './ConfirmDialog';

export default function Inventory() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adjusting, setAdjusting] = useState(null);
  const [addInputs, setAddInputs] = useState({});
  const [removeInputs, setRemoveInputs] = useState({});
  const [trayAddInputs, setTrayAddInputs] = useState({});
  const [trayRemoveInputs, setTrayRemoveInputs] = useState({});
  const [confirmItem, setConfirmItem] = useState(null);

  function requestConfirm(item, delta, unit) {
    const qty = Math.abs(delta);
    const isRemove = delta < 0;
    const trayCount = unit === 'trays' ? qty / 30 : null;
    const label = trayCount
      ? `${trayCount} tray${trayCount > 1 ? 's' : ''} (${qty} eggs)`
      : `${qty} egg${qty > 1 ? 's' : ''}`;
    setConfirmItem({ item, delta, label, isRemove });
  }

  useEffect(() => {
    loadInventory();
  }, []);

  async function loadInventory() {
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
  }

  async function executeAdjust(item, delta) {
    setAdjusting(item.egg_size_id);
    try {
      const currentQty = item.quantity_on_hand || 0;
      const newQty = Math.max(0, currentQty + delta);
      await updateInventory(item.egg_size_id, newQty);
      const actualDelta = newQty - currentQty;
      if (delta < 0 && actualDelta !== delta) {
        toast(`Removed ${Math.abs(actualDelta)} from ${item.egg_sizes?.name} (stock was only ${currentQty})`);
      } else {
        toast(
          delta > 0
            ? `Added ${delta} to ${item.egg_sizes?.name}`
            : `Removed ${Math.abs(delta)} from ${item.egg_sizes?.name}`
        );
      }
      loadInventory();
    } catch {
      toast('Failed to adjust inventory', 'error');
    } finally {
      setAdjusting(null);
    }
  }

  async function handleTrayAdd(item) {
    const val = parseInt(trayAddInputs[item.egg_size_id], 10);
    if (isNaN(val) || val <= 0) {
      toast('Enter a valid number of trays', 'error');
      return;
    }
    requestConfirm(item, val * 30, 'trays');
  }

  async function handleTrayRemove(item) {
    const val = parseInt(trayRemoveInputs[item.egg_size_id], 10);
    if (isNaN(val) || val <= 0) {
      toast('Enter a valid number of trays', 'error');
      return;
    }
    requestConfirm(item, -(val * 30), 'trays');
  }

  async function handleCustomAdd(item) {
    const val = parseInt(addInputs[item.egg_size_id], 10);
    if (isNaN(val) || val <= 0) {
      toast('Enter a valid number', 'error');
      return;
    }
    requestConfirm(item, val, 'pieces');
  }

  async function handleCustomRemove(item) {
    const val = parseInt(removeInputs[item.egg_size_id], 10);
    if (isNaN(val) || val <= 0) {
      toast('Enter a valid number', 'error');
      return;
    }
    requestConfirm(item, -val, 'pieces');
  }

  const sortedInventory = [...inventory].sort(
    (a, b) => (a.egg_sizes?.sort_order || 0) - (b.egg_sizes?.sort_order || 0)
  );

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
        <div className="error-banner">
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
      <div className="inv-list">
        {loading
          ? Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="inv-card">
                <div className="skeleton" style={{ width: '40%', height: 18 }}>&nbsp;</div>
                <div className="skeleton" style={{ width: '30%', height: 28, marginTop: 8 }}>&nbsp;</div>
              </div>
            ))
          : sortedInventory.map((item, i) => {
              const qty = item.quantity_on_hand || 0;
              const isAdjusting = adjusting === item.egg_size_id;

              let statusClass = 'badge-success';
              let statusText = 'In Stock';
              if (qty === 0) {
                statusClass = 'badge-danger';
                statusText = 'Out of Stock';
              } else if (qty <= 50) {
                statusClass = 'badge-warning';
                statusText = 'Low Stock';
              }

              return (
                <div
                  key={item.id || i}
                  className="inv-card"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  {/* Top row: name + stock */}
                  <div className="inv-card-top">
                    <span className="inv-name">
                      {item.egg_sizes?.name || EGG_SIZES[i] || `Size ${i + 1}`}
                    </span>
                    <div className="inv-card-stock">
                      <span className="inv-qty">{qty.toLocaleString()}</span>
                      <span className={`badge ${statusClass}`}>
                        {qty === 0 && <AlertTriangle size={11} />}
                        {statusText}
                      </span>
                    </div>
                  </div>

                  {/* Breakdown: trays + pieces */}
                  {qty > 0 && (
                    <div className="inv-breakdown">
                      <span className="inv-breakdown-text">{formatInventory(qty)}</span>
                    </div>
                  )}

                  {/* Actions: grouped by Add / Remove */}
                  <div className="inv-actions">
                    {/* Add row */}
                    <div className="inv-action-row inv-action-add-row">
                      <span className="inv-action-label">
                        <Plus size={13} />
                        Add
                      </span>
                      <div className="inv-action-controls">
                        {/* Add trays */}
                        <div className="inv-num-input">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            className="inv-num-field"
                            placeholder="Trays"
                            value={trayAddInputs[item.egg_size_id] || ''}
                            onChange={e =>
                              setTrayAddInputs(prev => ({
                                ...prev,
                                [item.egg_size_id]: e.target.value,
                              }))
                            }
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleTrayAdd(item);
                            }}
                            disabled={isAdjusting}
                          />
                          <button
                            type="button"
                            className="btn-icon inv-num-btn"
                            onClick={() => handleTrayAdd(item)}
                            disabled={isAdjusting}
                            title="Add trays"
                          >
                            <Plus size={15} />
                          </button>
                        </div>
                        {/* Add pieces */}
                        <div className="inv-num-input">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            className="inv-num-field"
                            placeholder="Pcs"
                            value={addInputs[item.egg_size_id] || ''}
                            onChange={e =>
                              setAddInputs(prev => ({
                                ...prev,
                                [item.egg_size_id]: e.target.value,
                              }))
                            }
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleCustomAdd(item);
                            }}
                            disabled={isAdjusting}
                          />
                          <button
                            type="button"
                            className="btn-icon inv-num-btn"
                            onClick={() => handleCustomAdd(item)}
                            disabled={isAdjusting}
                            title="Add pieces"
                          >
                            <Plus size={15} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Remove row */}
                    <div className="inv-action-row inv-action-remove-row">
                      <span className="inv-action-label">
                        <Minus size={13} />
                        Remove
                      </span>
                      <div className="inv-action-controls">
                        {/* Remove trays */}
                        <div className="inv-num-input">
                          <button
                            type="button"
                            className="btn-icon btn-icon-danger inv-num-btn"
                            onClick={() => handleTrayRemove(item)}
                            disabled={isAdjusting || qty < 30 || !trayRemoveInputs[item.egg_size_id]}
                            title="Remove trays"
                          >
                            <Minus size={15} />
                          </button>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            className="inv-num-field"
                            placeholder="Trays"
                            value={trayRemoveInputs[item.egg_size_id] || ''}
                            onChange={e =>
                              setTrayRemoveInputs(prev => ({
                                ...prev,
                                [item.egg_size_id]: e.target.value,
                              }))
                            }
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleTrayRemove(item);
                            }}
                            disabled={isAdjusting}
                          />
                        </div>
                        {/* Remove pieces */}
                        <div className="inv-num-input">
                          <button
                            type="button"
                            className="btn-icon btn-icon-danger inv-num-btn"
                            onClick={() => handleCustomRemove(item)}
                            disabled={isAdjusting || qty === 0 || !removeInputs[item.egg_size_id]}
                            title="Remove pieces"
                          >
                            <Minus size={15} />
                          </button>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            className="inv-num-field"
                            placeholder="Pcs"
                            value={removeInputs[item.egg_size_id] || ''}
                            onChange={e =>
                              setRemoveInputs(prev => ({
                                ...prev,
                                [item.egg_size_id]: e.target.value,
                              }))
                            }
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleCustomRemove(item);
                            }}
                            disabled={isAdjusting}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
      </div>
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
          const { item, delta, isRemove } = confirmItem;
          setConfirmItem(null);
          executeAdjust(item, delta);
          if (isRemove) {
            setRemoveInputs(prev => ({ ...prev, [item.egg_size_id]: '' }));
            setTrayRemoveInputs(prev => ({ ...prev, [item.egg_size_id]: '' }));
          } else {
            setAddInputs(prev => ({ ...prev, [item.egg_size_id]: '' }));
            setTrayAddInputs(prev => ({ ...prev, [item.egg_size_id]: '' }));
          }
        }}
        onCancel={() => setConfirmItem(null)}
      />

      <style>{`        .error-banner {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          background: var(--color-danger-bg);
          border: 1px solid var(--color-danger);
          border-radius: var(--radius-md);
          margin-bottom: 1.5rem;
          color: var(--color-danger);
        }

        .error-banner-content {
          flex: 1;
        }

        .error-banner-content p {
          font-size: 0.8125rem;
          margin-top: 0.25rem;
          color: var(--color-text-secondary);
        }

          .page-header-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 1.25rem;
          gap: 1rem;
        }

        .page-subtitle {
          color: var(--color-text-secondary);
          font-size: 0.875rem;
          margin-top: 0.15rem;
        }

        .inv-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .inv-card {
          background: var(--color-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 1.25rem 1.25rem;
          box-shadow: var(--shadow-sm);
          animation: fadeIn 0.3s ease-out forwards;
          opacity: 0;
        }

        .inv-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.75rem;
        }

        .inv-name {
          font-weight: 700;
          font-size: 1.25rem;
        }

        .inv-card-stock {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .inv-qty {
          font-weight: 800;
          font-size: 1.5rem;
          font-variant-numeric: tabular-nums;
        }

        .inv-breakdown {
          margin-bottom: 0.875rem;
        }

        .inv-breakdown-text {
          font-size: 1rem;
          color: var(--color-text-secondary);
          background: var(--color-bg);
          padding: 0.3rem 0.7rem;
          border-radius: var(--radius-sm);
          font-weight: 600;
        }

        .inv-actions {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .inv-action-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .inv-action-label {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          font-weight: 700;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          min-width: 60px;
          flex-shrink: 0;
        }

        .inv-action-add-row .inv-action-label {
          color: var(--color-primary);
        }

        .inv-action-remove-row .inv-action-label {
          color: var(--color-danger);
        }

        .inv-action-controls {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          flex-wrap: wrap;
        }

        .inv-num-input {
          display: flex;
          align-items: center;
          gap: 0;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          overflow: hidden;
          flex: 0 1 100px;
          min-width: 70px;
        }

        .inv-num-field {
          width: 0;
          flex: 1;
          min-width: 40px;
          padding: 0.5rem 0.25rem;
          border: none;
          outline: none;
          font-size: 0.9375rem;
          text-align: center;
          background: var(--color-card);
          color: var(--color-text);
        }

        .inv-num-field:focus {
          background: var(--color-primary-light);
        }

        .inv-num-field::placeholder {
          color: var(--color-text-muted);
          font-size: 0.7rem;
        }

        .inv-num-btn {
          border: none !important;
          border-radius: 0 !important;
          padding: 0.5rem 0.55rem !important;
        }

        .btn-icon {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.55rem 0.65rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          background: var(--color-card);
          color: var(--color-text-secondary);
          font-size: 0.9375rem;
          transition: all 0.15s;
          cursor: pointer;
          white-space: nowrap;
        }

        .btn-icon:hover {
          background: var(--color-primary-light);
          border-color: var(--color-primary);
          color: var(--color-primary);
        }

        .btn-icon:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .btn-icon-danger:hover {
          background: var(--color-danger-bg);
          border-color: var(--color-danger);
          color: var(--color-danger);
        }

        .btn-icon-label {
          font-weight: 600;
        }

        @media (min-width: 640px) {
          .inv-card-actions {
            gap: 0.5rem;
          }
          .inv-num-field {
            min-width: 48px;
          }
        }

        @media (max-width: 640px) {
          .inv-num-input {
            min-width: 60px;
            flex: 0 1 85px;
          }
          .inv-num-field {
            padding: 0.375rem 0.2rem;
            font-size: 0.8125rem;
            min-width: 28px;
          }
          .inv-num-btn {
            padding: 0.375rem 0.4rem !important;
          }
          .inv-card {
            padding: 0.875rem;
          }
          .inv-qty {
            font-size: 1.25rem;
          }
          .inv-name {
            font-size: 1.0625rem;
          }
          .inv-action-label {
            min-width: 48px;
            font-size: 0.6875rem;
          }
          .inv-num-field::placeholder {
            font-size: 0.625rem;
          }
        }
      `}</style>
    </div>
  );
}
