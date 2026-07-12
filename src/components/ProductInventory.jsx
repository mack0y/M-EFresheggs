import { useState, useEffect } from 'react';
import { Plus, Minus, AlertTriangle, RefreshCw, Trash2, PackagePlus } from 'lucide-react';
import { fetchProducts, updateProduct, formatPeso } from '../lib/api';
import { toast } from '../lib/toastFn';
import { getUserFriendlyError } from '../lib/errors';
import ConfirmDialog from './ConfirmDialog';

export default function ProductInventory() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [adjusting, setAdjusting] = useState(null);
  const [addInputs, setAddInputs] = useState({});
  const [removeInputs, setRemoveInputs] = useState({});
  const [confirmItem, setConfirmItem] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchProducts();
      setProducts(data || []);
    } catch (err) {
      console.error('Product inventory load error:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  async function executeAdjust(product, delta) {
    setAdjusting(product.id);
    try {
      const currentQty = parseFloat(product.quantity_on_hand || 0);
      const newQty = Math.max(0, currentQty + delta);
      await updateProduct(product.id, { quantity_on_hand: newQty });
      const actualDelta = newQty - currentQty;
      if (delta < 0 && actualDelta !== delta) {
        toast(`Could only remove ${Math.abs(actualDelta)} from ${product.name} — all remaining stock cleared (was ${currentQty})`);
      } else {
        toast(
          delta > 0
            ? `Added ${delta} ${product.unit}(s) to ${product.name}`
            : `Removed ${Math.abs(delta)} ${product.unit}(s) from ${product.name}`
        );
      }
      loadData();
    } catch (err) {
      console.error('Inventory adjust error:', err);
      toast('Failed to adjust inventory', 'error');
    } finally {
      setAdjusting(null);
    }
  }

  function requestConfirm(product, delta) {
    const qty = Math.abs(delta);
    const isRemove = delta < 0;
    const label = `${qty} ${product.unit}${qty !== 1 ? 's' : ''}`;
    setConfirmItem({ product, delta, label, isRemove });
  }

  function handleAdd(product) {
    const val = parseInt(addInputs[product.id], 10);
    if (isNaN(val) || val <= 0) {
      toast(`Enter a valid number of ${product.unit}s`, 'error');
      return;
    }
    requestConfirm(product, val);
  }

  function handleRemove(product) {
    const val = parseInt(removeInputs[product.id], 10);
    if (isNaN(val) || val <= 0) {
      toast(`Enter a valid number of ${product.unit}s`, 'error');
      return;
    }
    requestConfirm(product, -val);
  }

  return (
    <div className="fade-in">
      <div className="page-header-row">
        <div>
          <h1>Product Inventory</h1>
          <p className="page-subtitle">Add or remove product stock</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadData}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error && !loading && (
        <div className="error-banner">
          <AlertTriangle size={20} />
          <div className="error-banner-content">
            <strong>Failed to load products</strong>
            <p>{getUserFriendlyError(error)}</p>
          </div>
          <button className="btn btn-sm btn-secondary" onClick={loadData}>
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      )}

      {!error && (
      <div className="inv-list">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="inv-card">
                <div className="skeleton" style={{ width: '40%', height: 18 }}>&nbsp;</div>
                <div className="skeleton" style={{ width: '30%', height: 28, marginTop: 8 }}>&nbsp;</div>
              </div>
            ))
          : products.map((product, i) => {
              const qty = parseFloat(product.quantity_on_hand || 0);
              const price = parseFloat(product.price || 0);
              const isAdjusting = adjusting === product.id;

              let statusClass = 'badge-success';
              let statusText = 'In Stock';
              if (qty === 0) {
                statusClass = 'badge-danger';
                statusText = 'Out of Stock';
              } else if (qty <= 5) {
                statusClass = 'badge-warning';
                statusText = 'Low Stock';
              }

              return (
                <div
                  key={product.id}
                  className="inv-card"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  {/* Top row: name + stock */}
                  <div className="inv-card-top">
                    <div>
                      <span className="inv-name">{product.name}</span>
                      {price > 0 && <span className="inv-price">{formatPeso(price)}/{product.unit}</span>}
                    </div>
                    <div className="inv-card-stock">
                      <span className="inv-qty">{qty.toLocaleString()}</span>
                      <span className={`badge ${statusClass}`}>
                        {qty === 0 && <AlertTriangle size={11} />}
                        {statusText}
                      </span>
                    </div>
                  </div>

                  {/* Actions: grouped by Add / Remove */}
                  <div className="inv-actions">
                    {/* Add row */}
                    <div className="inv-action-row inv-action-add-row">
                      <span className="inv-action-label">
                        <Plus size={13} />
                        Add
                      </span>
                      <div className="inv-action-controls">
                        <div className="inv-num-input">
                          <input
                            id={`prod-inv-add-${product.id}`}
                            type="number"
                            min="1"
                            step="1"
                            className="inv-num-field"
                            placeholder={product.unit + 's'}
                            value={addInputs[product.id] || ''}
                            onChange={e =>
                              setAddInputs(prev => ({
                                ...prev,
                                [product.id]: e.target.value,
                              }))
                            }
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleAdd(product);
                            }}
                            disabled={isAdjusting}
                          />
                          <button
                            type="button"
                            className="btn-icon inv-num-btn"
                            onClick={() => handleAdd(product)}
                            disabled={isAdjusting}
                            title={`Add ${product.unit}s`}
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
                        <div className="inv-num-input">
                          <button
                            type="button"
                            className="btn-icon btn-icon-danger inv-num-btn"
                            onClick={() => handleRemove(product)}
                            disabled={isAdjusting || qty === 0 || !removeInputs[product.id]}
                            title={`Remove ${product.unit}s`}
                          >
                            <Minus size={15} />
                          </button>
                          <input
                            id={`prod-inv-remove-${product.id}`}
                            type="number"
                            min="1"
                            step="1"
                            className="inv-num-field"
                            placeholder={product.unit + 's'}
                            value={removeInputs[product.id] || ''}
                            onChange={e =>
                              setRemoveInputs(prev => ({
                                ...prev,
                                [product.id]: e.target.value,
                              }))
                            }
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleRemove(product);
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
            ? `Remove ${confirmItem.label} from ${confirmItem.product.name}? Current stock: ${confirmItem.product.quantity_on_hand || 0}.`
            : `Add ${confirmItem.label} to ${confirmItem.product.name}? Current stock: ${confirmItem.product.quantity_on_hand || 0}.`
          : ''}
        confirmLabel={confirmItem?.isRemove ? 'Remove' : 'Add'}
        icon={confirmItem?.isRemove ? Trash2 : PackagePlus}
        onConfirm={() => {
          const { product, delta, isRemove } = confirmItem;
          setConfirmItem(null);
          executeAdjust(product, delta);
          if (isRemove) {
            setRemoveInputs(prev => ({ ...prev, [product.id]: '' }));
          } else {
            setAddInputs(prev => ({ ...prev, [product.id]: '' }));
          }
        }}
        onCancel={() => setConfirmItem(null)}
      />

      <style>{`
        .inv-list { display: flex; flex-direction: column; gap: 0.75rem; }
        .inv-card { background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 1.25rem; box-shadow: var(--shadow-sm); animation: fadeIn 0.3s ease-out forwards; opacity: 0; }
        .inv-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; }
        .inv-card-top div { display: flex; flex-direction: column; gap: 0.125rem; }
        .inv-name { font-weight: 700; font-size: 1.25rem; }
        .inv-price { font-size: 0.8125rem; color: var(--color-text-muted); }
        .inv-card-stock { display: flex; align-items: center; gap: 0.5rem; }
        .inv-qty { font-weight: 800; font-size: 1.5rem; font-variant-numeric: tabular-nums; }
        .inv-actions { display: flex; flex-direction: column; gap: 0.5rem; }
        .inv-action-row { display: flex; align-items: center; gap: 0.5rem; }
        .inv-action-label { display: flex; align-items: center; gap: 0.25rem; font-weight: 700; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; min-width: 60px; flex-shrink: 0; }
        .inv-action-add-row .inv-action-label { color: var(--color-primary); }
        .inv-action-remove-row .inv-action-label { color: var(--color-danger); }
        .inv-action-controls { display: flex; align-items: center; gap: 0.375rem; flex-wrap: wrap; }

        @media (max-width: 640px) {
          .inv-num-input { min-width: 60px; flex: 0 1 85px; }
          .inv-num-field { padding: 0.375rem 0.2rem; font-size: 0.8125rem; min-width: 28px; }
          .inv-num-btn { padding: 0.375rem 0.4rem !important; }
          .inv-card { padding: 0.875rem; }
          .inv-qty { font-size: 1.25rem; }
          .inv-name { font-size: 1.0625rem; }
          .inv-action-label { min-width: 48px; font-size: 0.6875rem; }
          .inv-num-field::placeholder { font-size: 0.625rem; }
        }
      `}</style>
    </div>
  );
}