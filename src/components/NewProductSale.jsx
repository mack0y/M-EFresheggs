import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, ArrowLeft, Check, Search, Trash2, Plus, Minus, User } from 'lucide-react';
import { useCart } from './CartContext';
import { fetchProducts, fetchCustomers, recordTransaction, formatPeso } from '../lib/api';
import { toast } from '../lib/toastFn';
import { getUserFriendlyError } from '../lib/errors';
import ConfirmDialog from './ConfirmDialog';

export default function NewProductSale() {
  const navigate = useNavigate();
  const cart = useCart();
  const { items: cartItems, addItem, removeItem, clearCart, getCartTotal, customer, setCustomer } = cart;

  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [productId, setProductId] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [productQtys, setProductQtys] = useState({});

  const [confirmCheckout, setConfirmCheckout] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [prodData, custData] = await Promise.all([
        fetchProducts(),
        fetchCustomers(),
      ]);
      setProducts(prodData || []);
      setCustomers(custData || []);
    } catch (err) {
      console.error('Load error:', err);
      toast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => loadData(), 0);
    return () => clearTimeout(id);
  }, [loadData]);

  const filteredProducts = useMemo(() => {
    let result = products.filter(p => parseFloat(p.quantity_on_hand || 0) > 0);
    if (productSearch) {
      result = result.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()));
    }
    return result;
  }, [products, productSearch]);

  async function handleAddProduct() {
    const pId = parseInt(productId, 10);
    if (!pId) { toast('Select a product', 'error'); return; }
    const product = products.find(p => p.id === pId);
    if (!product) { toast('Product not found', 'error'); return; }

    const qty = parseFloat(productQtys[productId]);
    if (isNaN(qty) || qty <= 0) { toast('Enter a valid quantity', 'error'); return; }

    const stock = parseFloat(product.quantity_on_hand || 0);
    if (qty > stock) {
      toast(`Not enough ${product.name} stock — only ${stock} available`, 'error');
      return;
    }

    const price = parseFloat(product.price || 0);
    const total = qty * price;

    addItem({
      type: 'product',
      id: product.id,
      name: product.name,
      quantity: qty,
      unit: product.unit || 'units',
      pricePerUnit: price,
      total,
    });

    setProductId('');
    setProductSearch('');
    setProductQtys({});
    toast(`Added ${product.name} to cart`);
  }

  async function executeCheckout() {
    setSubmitting(true);
    try {
      const result = await recordTransaction({
        eggItems: [],
        productItems: cartItems.map(i => ({
          id: i.id, name: i.name, quantity: i.quantity, total: i.total,
        })),
        customerId: customer?.id || null,
      });

      clearCart();
      toast(`Sale complete! Transaction #${result.transaction.id} — ₱${parseFloat(result.transaction.total_amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, 'success');
    } catch (err) {
      console.error('Checkout error:', err);
      toast(getUserFriendlyError(err), 'error');
    } finally {
      setSubmitting(false);
      setConfirmCheckout(false);
    }
  }

  const cartTotal = getCartTotal();
  const cartCount = cartItems.length;

  function getProductQty(pId) {
    return productQtys[pId] || '';
  }

  function setProductQty(pId, val) {
    setProductQtys(prev => ({ ...prev, [pId]: val }));
  }

  return (
    <div className="fade-in">
      <div className="page-header-row">
        <div className="flex items-center gap-2">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/')} title="Back">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1>New Product Sale</h1>
            <p className="page-subtitle">{cartCount > 0 ? `${cartCount} item${cartCount > 1 ? 's' : ''} in cart` : 'Select products to add to cart'}</p>
          </div>
        </div>
      </div>

      <div className="ns-customer-bar">
        <User size={16} />
        <select
          className="ns-customer-select"
          value={customer?.id || ''}
          onChange={e => {
            if (!e.target.value) { setCustomer(null); return; }
            const c = customers.find(cu => cu.id === parseInt(e.target.value));
            setCustomer(c || null);
          }}
        >
          <option value="">Walk-in Customer</option>
          {customers.map(c => (
            <option key={c.id} value={c.id}>{c.name}{c.phone ? ` (${c.phone})` : ''}</option>
          ))}
        </select>
      </div>

      {cartItems.length > 0 && (
        <div className="ns-mobile-total-bar">
          <div className="ns-mobile-total-info">
            <span className="ns-mobile-total-count">{cartCount} item{cartCount > 1 ? 's' : ''}</span>
            <span className="ns-mobile-total-value">{formatPeso(cartTotal)}</span>
          </div>
          <button
            className="btn btn-primary ns-mobile-checkout-btn"
            onClick={() => setConfirmCheckout(true)}
            disabled={submitting}
          >
            {submitting ? 'Processing...' : 'Checkout'}
          </button>
        </div>
      )}

      <div className="ns-layout">
        <div className="ns-selector">
          {/* Product Selector */}
          <div className="ns-search-wrapper">
            <Search size={16} className="ns-search-icon" />
            <input
              className="ns-search-input"
              type="text"
              placeholder="Search products..."
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div style={{ padding: '1rem' }}>
              <div className="skeleton" style={{ height: 120, marginBottom: '0.75rem' }}>&nbsp;</div>
              <div className="skeleton" style={{ height: 48 }}>&nbsp;</div>
            </div>
          ) : (
            <div className="ns-products-list">
              {filteredProducts.length === 0 ? (
                <div className="ns-empty-products">No products with stock found</div>
              ) : (
                filteredProducts.map(p => {
                  const unit = p.unit || 'units';
                  const stock = parseFloat(p.quantity_on_hand || 0);
                  const price = parseFloat(p.price || 0);
                  const isSelected = parseInt(productId, 10) === p.id;
                  const qty = getProductQty(p.id);

                  return (
                    <div
                      key={p.id}
                      className={`ns-product-row ${isSelected ? 'selected' : ''}`}
                      onClick={() => setProductId(p.id)}
                    >
                      <div className="ns-product-info">
                        <span className="ns-product-name">{p.name}</span>
                        <span className="ns-product-meta">
                          {stock} {unit} · {formatPeso(price)}/{unit}
                        </span>
                      </div>
                      {isSelected && (
                        <div className="ns-product-action">
                          <span className="ns-qty-label">Qty:</span>
                          <div className="ns-qty-controls">
                            <button
                              className="ns-qty-btn"
                              onClick={e => { e.stopPropagation(); setProductQty(p.id, Math.max(0, (parseFloat(qty) || 0) - 1)); }}
                              disabled={!qty || parseFloat(qty) <= 0}
                              aria-label="Decrease quantity"
                            >
                              <Minus size={14} />
                            </button>
                            <input
                              className="ns-qty-input"
                              type="number"
                              min="0"
                              step="0.5"
                              value={qty}
                              onClick={e => e.stopPropagation()}
                              onChange={e => setProductQty(p.id, e.target.value)}
                              aria-label={`Quantity for ${p.name}`}
                            />
                            <button
                              className="ns-qty-btn"
                              onClick={e => { e.stopPropagation(); setProductQty(p.id, (parseFloat(qty) || 0) + 1); }}
                              aria-label="Increase quantity"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          <button
                            className="btn btn-primary btn-sm ns-add-cart-btn"
                            disabled={!qty || parseFloat(qty) <= 0}
                            onClick={e => {
                              e.stopPropagation();
                              setProductId(p.id);
                              setTimeout(() => handleAddProduct(), 0);
                            }}
                          >
                            <Check size={14} /> Add
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Cart */}
        <div className="ns-cart">
          <h3 className="ns-cart-title">
            <ShoppingCart size={18} />
            <span>Cart ({cartCount})</span>
          </h3>

          {cartItems.length === 0 ? (
            <div className="ns-cart-empty">
              <ShoppingCart size={40} strokeWidth={1} />
              <p>Add products to start a sale</p>
            </div>
          ) : (
            <>
              <div className="ns-cart-items">
                {cartItems.map(item => (
                  <div key={item.cartId} className="ns-cart-item">
                    <div className="ns-cart-item-left">
                      <span className="ns-cart-type type-product">Product</span>
                      <div className="ns-cart-item-details">
                        <span className="ns-cart-item-name">{item.name}</span>
                        <span className="ns-cart-item-meta">
                          {item.quantity} {item.unit}
                          {' × '}{formatPeso(item.pricePerUnit)}
                        </span>
                      </div>
                    </div>
                    <div className="ns-cart-item-right">
                      <span className="ns-cart-item-total">{formatPeso(item.total)}</span>
                      <button className="ns-cart-remove" onClick={() => removeItem(item.cartId)} title="Remove" aria-label={`Remove ${item.name} from cart`}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="ns-cart-actions">
                <button className="btn btn-secondary" onClick={clearCart}>
                  Clear Cart
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => setConfirmCheckout(true)}
                  disabled={submitting}
                >
                  {submitting ? 'Processing...' : `Checkout (${formatPeso(cartTotal)})`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmCheckout}
        title="Confirm Checkout"
        message={`Complete this sale for ${cartCount} item${cartCount > 1 ? 's' : ''} totaling ${formatPeso(cartTotal)}?`}
        confirmLabel="Complete Sale"
        variant="primary"
        icon={ShoppingCart}
        onConfirm={executeCheckout}
        onCancel={() => setConfirmCheckout(false)}
      />

      <style>{`
        .ns-customer-bar {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.625rem 0;
          margin-bottom: 0.5rem;
          border-bottom: 1px solid var(--color-border-light);
        }
        .ns-customer-select {
          flex: 1;
          padding: 0.375rem 0.5rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          background: var(--color-card);
          color: var(--color-text);
          font-size: 0.875rem;
        }
        .ns-layout {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 1.25rem;
          align-items: start;
        }
        .ns-selector {
          min-width: 0;
        }
        .ns-search-wrapper {
          position: relative;
          margin-bottom: 0.75rem;
        }
        .ns-search-icon {
          position: absolute;
          left: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--color-text-muted);
          pointer-events: none;
        }
        .ns-search-input {
          width: 100%;
          padding: 0.625rem 0.75rem 0.625rem 2.25rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background: var(--color-card);
          color: var(--color-text);
          font-size: 0.875rem;
        }
        .ns-products-list {
          max-height: 520px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .ns-product-row {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding: 0.75rem;
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .ns-product-row:hover { border-color: var(--color-primary-100); background: var(--color-primary-50); }
        .ns-product-row.selected { border-color: var(--color-primary); background: var(--color-primary-50); }
        .ns-product-info { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
        .ns-product-name { font-weight: 600; font-size: 0.9375rem; }
        .ns-product-meta { font-size: 0.8125rem; color: var(--color-text-muted); white-space: nowrap; }
        .ns-product-action { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
        .ns-qty-label { font-size: 0.8125rem; color: var(--color-text-secondary); font-weight: 500; }
        .ns-qty-controls { display: flex; align-items: center; gap: 0.25rem; }
        .ns-qty-btn {
          width: 28px; height: 28px;
          display: flex; align-items: center; justify-content: center;
          border: 1px solid var(--color-border); border-radius: var(--radius-sm);
          background: var(--color-card); color: var(--color-text); cursor: pointer;
          font-size: 1rem; line-height: 1;
        }
        .ns-qty-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .ns-qty-input {
          width: 48px; padding: 0.25rem; text-align: center;
          border: 1px solid var(--color-border); border-radius: var(--radius-sm);
          background: var(--color-bg); color: var(--color-text);
          font-size: 0.875rem; font-weight: 600;
        }
        .ns-add-cart-btn { white-space: nowrap; }
        .ns-empty-products {
          text-align: center; padding: 2rem 1rem;
          color: var(--color-text-muted); font-size: 0.875rem;
        }
        .ns-cart {
          background: var(--color-card); border: 1px solid var(--color-border-light);
          border-radius: var(--radius-lg); padding: 1rem;
          position: sticky; top: 1rem;
        }
        .ns-cart-title { display: flex; align-items: center; gap: 0.5rem; font-size: 1rem; margin-bottom: 1rem; }
        .ns-cart-empty { text-align: center; padding: 2rem 1rem; color: var(--color-text-muted); }
        .ns-cart-empty svg { margin-bottom: 0.75rem; opacity: 0.5; }
        .ns-cart-items { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
        .ns-cart-item { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; padding: 0.625rem 0; border-bottom: 1px solid var(--color-border-light); }
        .ns-cart-item:last-child { border-bottom: none; }
        .ns-cart-item-left { display: flex; align-items: center; gap: 0.5rem; min-width: 0; flex: 1; }
        .ns-cart-type { font-size: 0.625rem; font-weight: 700; text-transform: uppercase; padding: 0.15rem 0.4rem; border-radius: var(--radius-xs); letter-spacing: 0.02em; }
        .type-egg { background: var(--color-primary-light); color: var(--color-primary); }
        .type-product { background: #EDE7F6; color: #7B1FA2; }
        .ns-cart-item-details { min-width: 0; }
        .ns-cart-item-name { font-size: 0.875rem; font-weight: 600; display: block; }
        .ns-cart-item-meta { font-size: 0.75rem; color: var(--color-text-muted); }
        .ns-cart-item-right { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
        .ns-cart-item-total { font-weight: 700; font-size: 0.9375rem; font-variant-numeric: tabular-nums; }
        .ns-cart-remove { background: none; border: none; color: var(--color-text-muted); cursor: pointer; padding: 0.25rem; border-radius: var(--radius-sm); }
        .ns-cart-remove:hover { background: var(--color-danger-bg); color: var(--color-danger); }
        .ns-cart-actions { display: flex; gap: 0.5rem; }
        .ns-cart-actions .btn { flex: 1; }

        .ns-mobile-total-bar {
          display: none;
          justify-content: space-between;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          background: var(--color-primary);
          color: white;
          border-radius: var(--radius-md);
          margin-bottom: 1rem;
          position: sticky;
          top: 0.25rem;
          z-index: 50;
          box-shadow: var(--shadow-md);
        }
        .ns-mobile-total-info { display: flex; flex-direction: column; }
        .ns-mobile-total-count { font-size: 0.75rem; opacity: 0.85; }
        .ns-mobile-total-value { font-size: 1.375rem; font-weight: 900; font-variant-numeric: tabular-nums; }
        .ns-mobile-checkout-btn {
          padding: 0.625rem 1.25rem; font-weight: 700;
          background: white; color: var(--color-primary);
          border: none; border-radius: var(--radius-sm);
        }
        .ns-mobile-checkout-btn:hover { background: #f0f0f0; }

        @media (max-width: 768px) {
          .ns-layout { grid-template-columns: 1fr; }
          .ns-cart { position: static; }
          .ns-mobile-total-bar { display: flex; }
          .ns-cart-actions { display: none; }
        }
        @media (min-width: 769px) and (max-width: 1024px) {
          .ns-layout { grid-template-columns: 1fr 320px; }
        }
      `}</style>
    </div>
  );
}
