import { useState, useEffect } from 'react';
import { Package, Plus, Minus, AlertTriangle, RefreshCw } from 'lucide-react';
import { fetchInventory, updateInventory, EGG_SIZES } from '../lib/api';
import { toast } from './Toast';

export default function Inventory() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [adjusting, setAdjusting] = useState(null);

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

  async function handleSave(item) {
    const newQty = parseInt(editValue, 10);
    if (isNaN(newQty) || newQty < 0) {
      toast('Please enter a valid number', 'error');
      return;
    }
    try {
      await updateInventory(item.egg_size_id, newQty);
      toast(`Updated ${item.egg_sizes?.name} to ${newQty}`);
      setEditingId(null);
      loadInventory();
    } catch (err) {
      toast('Failed to update inventory', 'error');
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

  const sortedInventory = [...inventory].sort(
    (a, b) => (a.egg_sizes?.sort_order || 0) - (b.egg_sizes?.sort_order || 0)
  );

  return (
    <div className="fade-in">
      <div className="page-header-row">
        <div>
          <h1>Inventory</h1>
          <p className="page-subtitle">Manage your egg stock levels</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadInventory}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="loading-list">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="inventory-row">
                <span className="skeleton" style={{ width: 100, height: 20 }}>&nbsp;</span>
                <span className="skeleton" style={{ width: 80, height: 32 }}>&nbsp;</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="inventory-table">
            <div className="inventory-header">
              <span>Egg Size</span>
              <span className="inv-col-qty">Stock</span>
              <span className="inv-col-status">Status</span>
              <span className="inv-col-actions">Actions</span>
            </div>
            {sortedInventory.map((item, i) => {
              const qty = item.quantity_on_hand || 0;
              let statusClass = 'badge-success';
              let statusText = 'In Stock';
              if (qty === 0) {
                statusClass = 'badge-danger';
                statusText = 'Out of Stock';
              } else if (qty <= 50) {
                statusClass = 'badge-warning';
                statusText = 'Low Stock';
              }
              const isEditing = editingId === item.id;
              const isAdjusting = adjusting === item.egg_size_id;

              return (
                <div
                  key={item.id || i}
                  className="inventory-row"
                  style={{ animationDelay: `${i * 0.04}s` }}
                >
                  <span className="inv-name">
                    {item.egg_sizes?.name || EGG_SIZES[i] || `Size ${i + 1}`}
                  </span>

                  <span className="inv-col-qty">
                    {isEditing ? (
                      <input
                        type="number"
                        min="0"
                        className="input inv-edit-input"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSave(item);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        autoFocus
                      />
                    ) : (
                      <span className="inv-qty">{qty.toLocaleString()}</span>
                    )}
                  </span>

                  <span className="inv-col-status">
                    <span className={`badge ${statusClass}`}>
                      {qty === 0 && <AlertTriangle size={12} />}
                      {statusText}
                    </span>
                  </span>

                  <span className="inv-col-actions">
                    <div className="inv-actions">
                      {isEditing ? (
                        <>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleSave(item)}
                          >
                            Save
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="btn-icon"
                            onClick={() => handleQuickAdjust(item, 30)}
                            disabled={isAdjusting}
                            title="Add 30 eggs"
                          >
                            <Plus size={16} />
                            <span className="btn-icon-label">30</span>
                          </button>
                          <button
                            className="btn-icon btn-icon-danger"
                            onClick={() => {
                              setEditingId(item.id);
                              setEditValue(String(qty));
                            }}
                            title="Set exact quantity"
                          >
                            <Package size={16} />
                          </button>
                          <button
                            className="btn-icon btn-icon-danger"
                            onClick={() => handleQuickAdjust(item, -30)}
                            disabled={isAdjusting || qty < 30}
                            title="Remove 30 eggs"
                          >
                            <Minus size={16} />
                            <span className="btn-icon-label">30</span>
                          </button>
                        </>
                      )}
                    </div>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

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

        .inventory-table {
          display: flex;
          flex-direction: column;
        }

        .inventory-header {
          display: none;
          padding: 0.75rem 1rem;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-muted);
          background: var(--color-bg);
          border-bottom: 1px solid var(--color-border);
        }

        .inventory-row {
          display: grid;
          grid-template-columns: 1fr auto auto;
          gap: 0.75rem;
          align-items: center;
          padding: 0.875rem 1rem;
          border-bottom: 1px solid var(--color-border);
          animation: fadeIn 0.3s ease-out forwards;
          opacity: 0;
          transition: background 0.2s;
        }

        .inventory-row:last-child {
          border-bottom: none;
        }

        .inventory-row:hover {
          background: var(--color-bg);
        }

        .inv-name {
          font-weight: 500;
          font-size: 0.9375rem;
        }

        .inv-qty {
          font-weight: 700;
          font-size: 1.0625rem;
          font-variant-numeric: tabular-nums;
        }

        .inv-edit-input {
          width: 100px;
          padding: 0.375rem 0.5rem;
        }

        .inv-actions {
          display: flex;
          align-items: center;
          gap: 0.375rem;
        }

        .btn-icon {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.375rem 0.625rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          background: var(--color-card);
          color: var(--color-text-secondary);
          font-size: 0.8125rem;
          transition: all 0.2s;
          cursor: pointer;
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

        .loading-list {
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .loading-list .skeleton {
          display: block;
        }

        @media (min-width: 768px) {
          .inventory-header {
            display: grid;
            grid-template-columns: 1fr 80px 100px 1fr;
            gap: 0.75rem;
          }

          .inventory-row {
            grid-template-columns: 1fr 80px 100px 1fr;
          }

          .inv-col-qty { text-align: center; }
          .inv-col-status { text-align: center; }
          .inv-col-actions { display: flex; justify-content: flex-end; }
        }
      `}</style>
    </div>
  );
}
