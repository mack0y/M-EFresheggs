import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, ArrowLeft, Egg, Check, Search, Trash2, Plus, Minus, User } from 'lucide-react';
import { useCart } from './CartContext';
import { fetchInventory, fetchPriceSettings, fetchProducts, fetchCustomers, recordTransaction, formatPeso, formatInventory, TRAY_SIZE } from '../lib/api';
import { toast } from '../lib/toastFn';
import { getUserFriendlyError } from '../lib/errors';
import ConfirmDialog from './ConfirmDialog';

const QUICK_QTY = { piece: [1, 5, 10, 30], tray: [1, 2, 5, 10] };

export default function NewSale() {
  const navigate = useNavigate();
  const cart = useCart();
  const { items: cartItems, addItem, removeItem, clearCart, getCartTotal, customer, setCustomer } = cart;

  const [activeTab, setActiveTab] = useState('eggs');
  const [inventory, setInventory] = useState([]);
  const [priceSettings, setPriceSettings] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  // was: showReceipt / lastTransaction — replaced with toast

  // Egg form state
  const [eggForm, setEggForm] = useState({ eggSizeId: '', quantity: '', unit: 'piece' });

  // Product form state
  const [productId, setProductId] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [productQtys, setProductQtys] = useState({});

  const [confirmCheckout, setConfirmCheckout] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [invData, priceData, prodData, custData] = await Promise.all([
        fetchInventory(),
        fetchPriceSettings(),
        fetchProducts(),
        fetchCustomers(),
      ]);
      setInventory(invData || []);
      setPriceSettings(priceData || []);
      setProducts(prodData || []);
      setCustomers(custData || []);
    } catch (err) {
      console.error('Load error:', err);
      toast(getUserFriendlyError(err), 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // === Egg helpers ===
  function getEggPriceDisplay() {
    if (!eggForm.eggSizeId) return null;
    const eggSizeId = parseInt(eggForm.eggSizeId, 10);
    const price = priceSettings.find(p => p.egg_size_id === eggSizeId);
    if (!price) return null;
    const pp = parseFloat(price.price_per_piece || 0);
    const pt = parseFloat(price.price_per_tray || 0);
    return `${pp > 0 ? formatPeso(pp) + '/pc' : ''}${pp > 0 && pt > 0 ? ' | ' : ''}${pt > 0 ? formatPeso(pt) + '/tray' : ''}`;
  }

  function getEggTotal() {
    if (!eggForm.eggSizeId || !eggForm.quantity) return null;
    const qty = parseInt(eggForm.quantity, 10);
    if (isNaN(qty) || qty <= 0) return null;
    const eggSizeId = parseInt(eggForm.eggSizeId, 10);
    const price = priceSettings.find(p => p.egg_size_id === eggSizeId);
    if (!price) return null;
    const perUnit = eggForm.unit === 'tray'
      ? parseFloat(price.price_per_tray || 0)
      : parseFloat(price.price_per_piece || 0);
    return qty * perUnit > 0 ? qty * perUnit : null;
  }

  function addQuickQty(delta) {
    const current = parseInt(eggForm.quantity, 10) || 0;
    setEggForm({ ...eggForm, quantity: String(current + delta) });
  }

  function handleAddEgg() {
    if (!eggForm.eggSizeId || !eggForm.quantity) {
      toast('Select an egg size and enter quantity', 'error');
      return;
    }
    const qty = parseInt(eggForm.quantity, 10);
    if (isNaN(qty) || qty <= 0) { toast('Enter a valid quantity', 'error'); return; }

    const eggSizeId = parseInt(eggForm.eggSizeId, 10);
    const invItem = inventory.find(i => i.egg_size_id === eggSizeId);
    const name = invItem?.egg_sizes?.name || 'Unknown';

    // Validate stock
    const totalEggs = eggForm.unit === 'tray' ? qty * TRAY_SIZE : qty;
    const stock = invItem?.quantity_on_hand || 0;
    if (totalEggs > stock) {
      toast(`Not enough ${name} stock — only ${stock} eggs available`, 'error');
      return;
    }

    const price = priceSettings.find(p => p.egg_size_id === eggSizeId);
    const pricePerUnit = eggForm.unit === 'tray'
      ? parseFloat(price?.price_per_tray || 0)
      : parseFloat(price?.price_per_piece || 0);
    const total = qty * pricePerUnit;

    addItem({
      type: 'egg',
      id: eggSizeId,
      name,
      quantity: qty,
      unit: eggForm.unit,
      traySize: eggForm.unit === 'tray' ? TRAY_SIZE : null,
      pricePerUnit,
      total,
    });

    setEggForm({ eggSizeId: '', quantity: '', unit: 'piece' });
    toast(`Added ${name} to cart`);
  }

  // === Product helpers ===

  const filteredProducts = useMemo(() => products
    .filter(p => parseFloat(p.quantity_on_hand || 0) > 0)
    .filter(p => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase())),
    [products, productSearch]
  );

  const sortedInventory = useMemo(() =>
    inventory.slice().sort((a, b) => (a.egg_sizes?.sort_order || 0) - (b.egg_sizes?.sort_order || 0)),
    [inventory]
  );

  // === Checkout ===
  async function executeCheckout() {
    setSubmitting(true);
    try {
      const eggItems = cartItems.filter(i => i.type === 'egg');
      const productItems = cartItems.filter(i => i.type === 'product');

      const result = await recordTransaction({
        eggItems: eggItems.map(i => ({
          id: i.id, quantity: i.quantity, unit: i.unit,
          traySize: i.traySize, total: i.total,
        })),
        productItems: productItems.map(i => ({
          id: i.id, quantity: i.quantity, total: i.total,
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

  return (
    <div className="fade-in">
      <div className="page-header-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/')} title="Back">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1>New Sale</h1>
            <p className="page-subtitle">{cartCount > 0 ? `${cartCount} item${cartCount > 1 ? 's' : ''} in cart` : 'Add items to start a sale'}</p>
          </div>
        </div>
      </div>

      {/* Customer Selector */}
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

      {/* Mobile sticky total bar */}
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
        {/* Item Selector */}
        <div className="ns-selector">
          <div className="ns-tabs">
            <button
              className={`ns-tab ${activeTab === 'eggs' ? 'active' : ''}`}
              onClick={() => setActiveTab('eggs')}
            >
              <Egg size={16} /> Eggs
            </button>
            <button
              className={`ns-tab ${activeTab === 'products' ? 'active' : ''}`}
              onClick={() => setActiveTab('products')}
            >
              <ShoppingCart size={16} /> Products
            </button>
          </div>

          {loading ? (
            <div style={{ padding: '1rem' }}>
              <div className="skeleton" style={{ height: 120, marginBottom: '0.75rem' }}>&nbsp;</div>
              <div className="skeleton" style={{ height: 48 }}>&nbsp;</div>
            </div>
          ) : activeTab === 'eggs' ? (
            <div className="ns-form-content">
              <button
                className="btn btn-primary ns-add-btn"
                onClick={handleAddEgg}
                disabled={!eggForm.eggSizeId || !eggForm.quantity}
              >
                <Plus size={18} /> Add to Cart
              </button>

              <div className="ns-field">
                <label>Egg Size</label>
                <div className="ns-size-grid">
                  {sortedInventory.map(item => {
                      const selected = eggForm.eggSizeId === String(item.egg_size_id);
                      const qty = item.quantity_on_hand || 0;
                      let stockClass = 'ns-stock-ok';
                      if (qty === 0) stockClass = 'ns-stock-out';
                      else if (qty <= 50) stockClass = 'ns-stock-low';
                      return (
                        <button
                          key={item.egg_size_id}
                          type="button"
                          className={`ns-size-card ${selected ? 'selected' : ''} ${qty === 0 ? 'out-of-stock' : ''}`}
                          onClick={() => {
                            if (qty > 0) setEggForm({ ...eggForm, eggSizeId: String(item.egg_size_id), quantity: '' });
                          }}
                        >
                          {selected && <span className="ns-size-check"><Check size={14} /></span>}
                          <span className="ns-size-name">{item.egg_sizes?.name || 'Unknown'}</span>
                          <span className="ns-size-stock">{qty.toLocaleString()} eggs</span>
                          <span className={`ns-size-badge ${stockClass}`}>{qty === 0 ? 'Out' : qty <= 50 ? 'Low' : 'OK'}</span>
                        </button>
                      );
                    })}
                </div>
                {eggForm.eggSizeId && getEggPriceDisplay() && (
                  <span className="ns-price-hint">{getEggPriceDisplay()}</span>
                )}
              </div>

              <div className="ns-field">
                <label>Unit</label>
                <div className="ns-unit-tabs">
                  <button type="button" className={`ns-unit-tab ${eggForm.unit === 'piece' ? 'active' : ''}`}
                    onClick={() => setEggForm({ ...eggForm, unit: 'piece', quantity: '' })}>By Piece</button>
                  <button type="button" className={`ns-unit-tab ${eggForm.unit === 'tray' ? 'active' : ''}`}
                    onClick={() => setEggForm({ ...eggForm, unit: 'tray', quantity: '' })}>By Tray</button>
                </div>
              </div>

              <div className="ns-field">
                <label>Quantity ({eggForm.unit === 'tray' ? 'trays' : 'eggs'})</label>
                <input
                  type="number" min="1"
                  placeholder={eggForm.unit === 'tray' ? 'Number of trays' : 'Number of eggs'}
                  value={eggForm.quantity}
                  onChange={e => setEggForm({ ...eggForm, quantity: e.target.value })}
                  className="ns-qty-input"
                />
                <div className="ns-quick-chips">
                  {(eggForm.unit === 'piece' ? QUICK_QTY.piece : QUICK_QTY.tray).map(v => (
                    <button key={v} type="button" className="ns-chip" onClick={() => addQuickQty(v)}>+{v}</button>
                  ))}
                </div>
              </div>

              {eggForm.eggSizeId && eggForm.quantity && (
                <div className="ns-conversion">
                  <Egg size={14} />
                  <span>= {formatInventory(eggForm.unit === 'tray' ? parseInt(eggForm.quantity, 10) * TRAY_SIZE : parseInt(eggForm.quantity, 10))}</span>
                  {getEggTotal() !== null && <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--color-primary)' }}>{formatPeso(getEggTotal())}</span>}
                </div>
              )}
            </div>
          ) : (
            <div className="ns-form-content">
              <button
                className="btn btn-primary ns-add-btn"
                onClick={() => {
                  if (!productId || !productQtys[productId]) {
                    toast('Select a product and enter quantity', 'error');
                    return;
                  }
                  const p = products.find(pr => pr.id === parseInt(productId, 10));
                  if (!p) { toast('Product not found', 'error'); return; }
                  const qty = parseFloat(productQtys[productId]);
                  if (isNaN(qty) || qty <= 0) { toast('Enter a valid quantity', 'error'); return; }
                  const stock = parseFloat(p.quantity_on_hand || 0);
                  if (qty > stock) { toast(`Not enough ${p.name} stock — only ${stock} available`, 'error'); return; }
                  const price = parseFloat(p.price || 0);
                  addItem({
                    type: 'product',
                    id: p.id,
                    name: p.name,
                    quantity: qty,
                    unit: p.unit || 'units',
                    traySize: null,
                    pricePerUnit: price,
                    total: qty * price,
                  });
                  setProductId('');
                  setProductQtys({});
                  setProductSearch('');
                  toast(`Added ${p.name} to cart`);
                }}
                disabled={!productId || !productQtys[productId]}
              >
                <Plus size={18} /> Add to Cart
              </button>

              <div className="ns-field">
                <label>Product</label>
                <div className="ns-search-wrapper">
                  <Search size={16} className="ns-search-icon" />
                  <input
                    type="text"
                    className="ns-search-input"
                    placeholder="Search products..."
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                  />
                </div>
                <div className="ns-product-list">
                  {filteredProducts.length === 0 ? (
                    <div className="ns-empty-products">No products with stock found</div>
                  ) : (
                    filteredProducts.map(p => {
                      const unit = p.unit || 'units';
                      const stock = parseFloat(p.quantity_on_hand || 0);
                      const price = parseFloat(p.price || 0);
                      const isSelected = parseInt(productId, 10) === p.id;
                      const qty = productQtys[p.id] || '';
                      return (
                        <div
                          key={p.id}
                          className={`ns-product-row ${isSelected ? 'selected' : ''}`}
                        >
                          <div
                            className="ns-product-row-top"
                            onClick={() => setProductId(isSelected ? '' : String(p.id))}
                          >
                            <input
                              type="radio"
                              name="product"
                              checked={isSelected}
                              onChange={() => setProductId(isSelected ? '' : String(p.id))}
                              className="ns-radio"
                            />
                            <div className="ns-product-info">
                              <span className="ns-product-name">{p.name}</span>
                              <span className="ns-product-meta">
                                {stock.toLocaleString()} {unit} in stock · {price > 0 ? formatPeso(price) + '/' + unit : 'No price'}
                              </span>
                            </div>
                          </div>
                          {isSelected && (
                            <div className="ns-product-inline-qty">
                              <div className="ns-quick-chips">
                                {[1, 2, 3, 5, 10].map(v => (
                                  <button
                                    key={v}
                                    type="button"
                                    className={`ns-chip ${qty === String(v) ? 'active' : ''}`}
                                    onClick={() => setProductQtys({ ...productQtys, [p.id]: String(v) })}
                                  >
                                    {v}
                                  </button>
                                ))}
                              </div>
                              <div className="ns-qty-row">
                                <input
                                  type="number"
                                  min="1"
                                  step="any"
                                  placeholder="Qty"
                                  value={qty}
                                  onChange={e => setProductQtys({ ...productQtys, [p.id]: e.target.value })}
                                  className="ns-product-qty-input"
                                  autoFocus
                                />
                                <span className="ns-max-label">Max: {stock.toLocaleString()}</span>
                              </div>
                              {qty && price > 0 && (
                                <div className="ns-conversion">
                                  <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                                    {formatPeso(parseFloat(qty) * price)}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Cart */}
        <div className="ns-cart">
          <div className="ns-cart-header">
            <ShoppingCart size={18} />
            <span>Cart</span>
            {cartCount > 0 && <span className="ns-cart-badge">{cartCount}</span>}
          </div>

          {cartItems.length === 0 ? (
            <div className="ns-cart-empty">
              <ShoppingCart size={40} strokeWidth={1} />
              <p>Add items to start a sale</p>
            </div>
          ) : (
            <>
              <div className="ns-cart-items">
                {cartItems.map(item => (
                  <div key={item.cartId} className="ns-cart-item">
                    <div className="ns-cart-item-left">
                      <span className={`ns-cart-type ${item.type === 'egg' ? 'type-egg' : 'type-product'}`}>
                        {item.type === 'egg' ? 'Egg' : 'Product'}
                      </span>
                      <div className="ns-cart-item-details">
                        <span className="ns-cart-item-name">{item.name}</span>
                        <span className="ns-cart-item-meta">
                          {item.quantity} {item.unit === 'tray' ? 'tray' : item.unit}
                          {item.unit === 'tray' && item.quantity > 1 ? 's' : ''}
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

              <div className="ns-cart-footer">
                <button className="btn btn-secondary ns-clear-btn" onClick={clearCart}>
                  Clear Cart
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmCheckout}
        title="Record this sale?"
        message={`Record sale of ${cartCount} item${cartCount > 1 ? 's' : ''} totaling ${formatPeso(cartTotal)}? Stock will be deducted automatically.`}
        confirmLabel="Record Sale"
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
          padding: 0.625rem 1rem;
          background: var(--color-card);
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-md);
          margin-bottom: 1rem;
          color: var(--color-text-secondary);
        }
        .ns-customer-select {
          flex: 1;
          border: none;
          background: transparent;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--color-text);
          outline: none;
          cursor: pointer;
        }

        .ns-layout {
          display: grid;
          grid-template-columns: 1fr 380px;
          gap: 1.25rem;
          align-items: start;
        }

        .ns-selector {
          background: var(--color-card);
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-lg);
          overflow: hidden;
          box-shadow: var(--shadow-sm);
        }

        .ns-tabs {
          display: flex;
          border-bottom: 1px solid var(--color-border-light);
        }
        .ns-tab {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.875rem;
          border: none;
          background: transparent;
          font-size: 0.9375rem;
          font-weight: 600;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all var(--transition-fast);
          border-bottom: 2px solid transparent;
        }
        .ns-tab:hover { color: var(--color-primary); }
        .ns-tab.active {
          color: var(--color-primary);
          border-bottom-color: var(--color-primary);
          background: var(--color-primary-light);
        }

        .ns-form-content {
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .ns-field { display: flex; flex-direction: column; gap: 0.375rem; }
        .ns-field > label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .ns-size-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 0.5rem;
        }
        .ns-size-card {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
          padding: 0.75rem 0.5rem;
          border: 2px solid var(--color-border);
          border-radius: var(--radius-md);
          background: var(--color-card);
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .ns-size-card:hover:not(.out-of-stock) { border-color: var(--color-primary); }
        .ns-size-card.selected { border-color: var(--color-primary); background: var(--color-primary-light); }
        .ns-size-card.out-of-stock { opacity: 0.45; cursor: not-allowed; }
        .ns-size-check { position: absolute; top: 4px; right: 4px; color: var(--color-primary); }
        .ns-size-name { font-weight: 700; font-size: 0.875rem; text-align: center; }
        .ns-size-stock { font-size: 0.75rem; color: var(--color-text-muted); }
        .ns-size-badge {
          font-size: 0.625rem;
          font-weight: 700;
          padding: 0.15rem 0.5rem;
          border-radius: 99px;
        }
        .ns-stock-ok { background: #E8F5E9; color: #2E7D32; }
        .ns-stock-low { background: #FFF3E0; color: #E65100; }
        .ns-stock-out { background: #FFEBEE; color: #C62828; }
        .ns-price-hint { font-size: 0.8125rem; color: var(--color-text-muted); }

        .ns-unit-tabs { display: flex; gap: 0.25rem; }
        .ns-unit-tab {
          flex: 1; padding: 0.5rem;
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-sm);
          background: var(--color-card);
          font-size: 0.8125rem; font-weight: 600;
          color: var(--color-text);
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .ns-unit-tab.active { background: var(--color-primary); border-color: var(--color-primary); color: white; }

        .ns-qty-input {
          width: 100%; padding: 0.75rem 1rem;
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-sm);
          font-size: 1.25rem; font-weight: 700;
          color: var(--color-text);
          background: var(--color-card);
          outline: none; box-sizing: border-box;
        }
        .ns-qty-input:focus { border-color: var(--color-primary); }

        .ns-quick-chips { display: flex; gap: 0.375rem; flex-wrap: wrap; margin-top: 0.25rem; }
        .ns-chip {
          padding: 0.3rem 0.75rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          background: var(--color-card);
          font-size: 0.75rem; font-weight: 600;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .ns-chip:hover { border-color: var(--color-primary); color: var(--color-primary); }

        .ns-conversion {
          display: flex; align-items: center; gap: 0.5rem;
          font-size: 0.8125rem; color: var(--color-text-muted);
        }
        .ns-conversion svg { flex-shrink: 0; }

        .ns-add-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }

        .ns-search-wrapper { position: relative; display: flex; align-items: center; }
        .ns-search-icon { position: absolute; left: 0.75rem; color: var(--color-text-muted); pointer-events: none; }
        .ns-search-input {
          width: 100%; padding: 0.625rem 0.75rem 0.625rem 2.25rem;
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-sm);
          font-size: 0.875rem; color: var(--color-text);
          background: var(--color-card); outline: none; box-sizing: border-box;
        }
        .ns-search-input:focus { border-color: var(--color-primary); }

        .ns-product-list {
          max-height: 420px; overflow-y: auto;
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-sm);
          display: flex; flex-direction: column;
        }
        .ns-empty-products { padding: 1.5rem; text-align: center; color: var(--color-text-muted); font-size: 0.875rem; }

        .ns-product-row {
          border-bottom: 1px solid var(--color-border-light);
        }
        .ns-product-row:last-child { border-bottom: none; }
        .ns-product-row-top {
          display: flex; align-items: center; gap: 0.75rem;
          padding: 0.625rem 0.875rem;
          cursor: pointer;
          transition: background var(--transition-fast);
        }
        .ns-product-row-top:hover { background: var(--color-bg); }
        .ns-product-row.selected .ns-product-row-top { background: var(--color-primary-50); }

        .ns-product-inline-qty {
          padding: 0.5rem 0.875rem 0.75rem;
          display: flex; flex-direction: column; gap: 0.5rem;
          border-top: 1px dashed var(--color-border-light);
          background: var(--color-bg);
        }
        .ns-product-qty-input {
          width: 100px; padding: 0.5rem 0.75rem;
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-sm);
          font-size: 1rem; font-weight: 700;
          color: var(--color-text);
          background: var(--color-card);
          outline: none;
        }
        .ns-product-qty-input:focus { border-color: var(--color-primary); }
        .ns-radio { width: 16px; height: 16px; cursor: pointer; accent-color: var(--color-primary); flex-shrink: 0; }
        .ns-product-info { display: flex; flex-direction: column; gap: 0.125rem; min-width: 0; flex: 1; }
        .ns-product-name { font-weight: 600; font-size: 0.8125rem; }
        .ns-product-meta { font-size: 0.6875rem; color: var(--color-text-muted); }

        .ns-qty-row { display: flex; align-items: center; gap: 0.75rem; }
        .ns-max-label { font-size: 0.75rem; color: var(--color-text-muted); white-space: nowrap; }

        /* Cart */
        .ns-cart {
          background: var(--color-card);
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-lg);
          overflow: hidden;
          box-shadow: var(--shadow-sm);
          position: sticky;
          top: 1.5rem;
        }

        .ns-cart-header {
          display: flex; align-items: center; gap: 0.5rem;
          padding: 0.875rem 1.25rem;
          background: var(--color-bg);
          border-bottom: 1px solid var(--color-border-light);
          font-weight: 600; font-size: 0.9375rem;
        }
        .ns-cart-header svg { color: var(--color-primary); }
        .ns-cart-badge {
          background: var(--color-primary);
          color: white;
          font-size: 0.6875rem;
          font-weight: 700;
          padding: 0.125rem 0.5rem;
          border-radius: 99px;
          margin-left: auto;
        }

        .ns-cart-empty {
          display: flex; flex-direction: column;
          align-items: center; gap: 0.75rem;
          padding: 3rem 1.5rem;
          color: var(--color-text-muted);
          text-align: center;
        }
        .ns-cart-empty p { font-size: 0.875rem; }

        .ns-cart-items {
          max-height: 400px;
          overflow-y: auto;
          padding: 0.5rem 0;
        }

        .ns-cart-item {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0.625rem 1.25rem;
          transition: background var(--transition-fast);
        }
        .ns-cart-item:hover { background: var(--color-bg-subtle); }

        .ns-cart-item-left { display: flex; align-items: center; gap: 0.625rem; min-width: 0; flex: 1; }
        .ns-cart-type {
          font-size: 0.5625rem; font-weight: 700;
          padding: 0.15rem 0.4rem;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          flex-shrink: 0;
        }
        .type-egg { background: #E8F5E9; color: #2E7D32; }
        .type-product { background: #F3E5F5; color: #7B1FA2; }

        .ns-cart-item-details { display: flex; flex-direction: column; min-width: 0; }
        .ns-cart-item-name { font-weight: 600; font-size: 0.875rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ns-cart-item-meta { font-size: 0.6875rem; color: var(--color-text-muted); }

        .ns-cart-item-right { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
        .ns-cart-item-total { font-weight: 700; font-size: 0.875rem; color: var(--color-success); font-variant-numeric: tabular-nums; }
        .ns-cart-remove {
          display: flex; align-items: center; justify-content: center;
          width: 28px; height: 28px;
          border: none; border-radius: var(--radius-sm);
          background: transparent;
          color: var(--color-text-muted);
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .ns-cart-remove:hover { background: var(--color-danger-bg); color: var(--color-danger); }

        .ns-cart-footer {
          padding: 1rem 1.25rem;
          border-top: 1px solid var(--color-border-light);
          display: flex; flex-direction: column; gap: 0.625rem;
        }

        .ns-cart-total {
          display: flex; align-items: center; justify-content: space-between;
          font-size: 1.125rem; font-weight: 700;
        }
        .ns-cart-total-value {
          font-size: 2rem; font-weight: 900;
          color: var(--color-primary);
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.5px;
        }

        .ns-checkout-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
        .ns-clear-btn { width: 100%; }

        @media (max-width: 768px) {
          .ns-layout {
            grid-template-columns: 1fr;
          }
          .ns-cart {
            border-radius: var(--radius-lg);
          }
          .ns-cart-items { max-height: none; }
          .ns-size-grid { grid-template-columns: repeat(2, 1fr); }
        }

        .ns-mobile-total-bar {
          display: flex;
          align-items: center;
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
        .ns-mobile-total-info {
          display: flex;
          flex-direction: column;
        }
        .ns-mobile-total-count {
          font-size: 0.75rem;
          opacity: 0.85;
        }
        .ns-mobile-total-value {
          font-size: 1.375rem;
          font-weight: 900;
          font-variant-numeric: tabular-nums;
        }
        .ns-mobile-checkout-btn {
          padding: 0.625rem 1.25rem;
          font-weight: 700;
          background: white;
          color: var(--color-primary);
          border: none;
          border-radius: var(--radius-sm);
        }
        .ns-mobile-checkout-btn:hover {
          background: #f0f0f0;
        }

        @media (min-width: 769px) and (max-width: 1024px) {
          .ns-layout {
            grid-template-columns: 1fr 320px;
          }
        }
      `}</style>
    </div>
  );
}
