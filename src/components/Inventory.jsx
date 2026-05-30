import { useState, useEffect } from 'react';
import { Plus, Minus, AlertTriangle, RefreshCw } from 'lucide-react';
import { fetchInventory, updateInventory, formatInventory, EGG_SIZES } from '../lib/api';
import { toast } from './Toast';

export default function Inventory() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adjusting, setAdjusting] = useState(null);
  const [addInputs, setAddInputs] = useState({});
  const [removeInputs, setRemoveInputs] = useState({});

  useEffect(() => {
    loadInventory();
  }, []);

  async function loadInventory() {
    try {
      setLoading(true);
      const data = await fetchInventory();
      setInventory(data || []);
    } catch (err) {
      console.error('Inventory load error:', err);
      toast('Failed to load inventory', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleQuickAdjust(item, delta) {
    setAdjusting(item.egg_size_id);
    try {
      const currentQty = item.quantity_on_hand || 0;
      const newQty = Math.max(0, currentQty + delta);
      await updateInventory(item.egg_size_id, newQty);
      toast(
        delta > 0
          ? `Added ${delta} to ${item.egg_sizes?.name}`
          : `Removed ${Math.abs(delta)} from ${item.egg_sizes?.name}`
      );
      loadInventory();
    } catch (err) {
      toast('Failed to adjust inventory', 'error');
    } finally {
      setAdjusting(null);
    }
  }

  async function handleCustomAdd(item) {
    const val = parseInt(addInputs[item.egg_size_id], 10);
    if (isNaN(val) || val <= 0) {
      toast('Enter a valid number', 'error');
      return;
    }
    await handleQuickAdjust(item, val);
    setAddInputs(prev => ({ ...prev, [item.egg_size_id]: '' }));
  }

  async function handleCustomRemove(item) {
    const val = parseInt(removeInputs[item.egg_size_id], 10);
    if (isNaN(val) || val <= 0) {
      toast('Enter a valid number', 'error');
      return;
    }
    await handleQuickAdjust(item, -val);
    setRemoveInputs(prev => ({ ...prev, [item.egg_size_id]: '' }));
  }

  const sortedInventory = [...inventory].sort(
    (a, b) => (a.egg_sizes?.sort_order || 0) - (b.egg_sizes?.sort_order || 0)
  );

  return (
    <div className="fade-in">
      <div className="page-header-row">
        <div>
          <h1>Inventory</h1>
          <p className="page-subtitle">Tap Tray for ±30 or type any number</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadInventory}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

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

                  {/* Bottom row: actions */}
                  <div className="inv-card-actions">
                    {/* Add tray */}
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => handleQuickAdjust(item, 30)}
                      disabled={isAdjusting}
                    >
                      <Plus size={16} />
                      <span className="btn-icon-label">Tray</span>
                    </button>

                    {/* Custom add */}
                    <div className="inv-num-input">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        className="inv-num-field"
                        placeholder="pcs"
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
                      >
                        <Plus size={16} />
                      </button>
                    </div>

                    {/* Custom remove */}
                    <div className="inv-num-input">
                      <button
                        type="button"
                        className="btn-icon btn-icon-danger inv-num-btn"
                        onClick={() => handleCustomRemove(item)}
                        disabled={isAdjusting || qty === 0 || !removeInputs[item.egg_size_id]}
                      >
                        <Minus size={16} />
                      </button>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        className="inv-num-field"
                        placeholder="pcs"
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

                    {/* Remove tray */}
                    <button
                      type="button"
                      className="btn-icon btn-icon-danger"
                      onClick={() => handleQuickAdjust(item, -30)}
                      disabled={isAdjusting || qty < 30}
                    >
                      <Minus size={16} />
                      <span className="btn-icon-label">Tray</span>
                    </button>
                  </div>
                </div>
              );
            })}
      </div>

      <style>{`
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

        .inv-card-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .inv-num-input {
          display: flex;
          align-items: center;
          gap: 0;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          overflow: hidden;
          flex: 0 1 90px;
          min-width: 55px;
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
      `}</style>
    </div>
  );
}
