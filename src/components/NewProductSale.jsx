import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, ArrowLeft, Search } from 'lucide-react';
import { fetchProducts, recordProductSale, formatPeso, getLocalDate } from '../lib/api';
import { toast } from '../lib/toastFn';
import { getUserFriendlyError } from '../lib/errors';
import ConfirmDialog from './ConfirmDialog';

export default function NewProductSale() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmSale, setConfirmSale] = useState(null);
  const today = getLocalDate();

  const loadProducts = useCallback(async () => {
    const executeLoad = async () => {
      try {
        setLoading(true);
        const data = await fetchProducts();
        setProducts(data || []);
      } catch (err) {
        console.error('Load products error:', err);
        toast(getUserFriendlyError(err), 'error');
      } finally {
        setLoading(false);
      }
    };
    executeLoad();
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const selectedProduct = productId
    ? products.find(p => p.id === parseInt(productId, 10))
    : null;

  function calcTotal() {
    if (!selectedProduct || !quantity) return null;
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) return null;
    const price = parseFloat(selectedProduct.price || 0);
    if (price <= 0) return null;
    return qty * price;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!productId || !quantity) {
      toast('Please select a product and enter quantity', 'error');
      return;
    }
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast('Enter a valid quantity', 'error');
      return;
    }
    if (!selectedProduct) { toast('Product not found', 'error'); return; }
    const stock = parseFloat(selectedProduct.quantity_on_hand || 0);
    if (qty > stock) {
      toast(`Not enough stock — only ${stock} ${selectedProduct.unit || 'units'} available`, 'error');
      return;
    }
    setConfirmSale({ productId: parseInt(productId, 10), quantity: qty, productName: selectedProduct.name });
  }

  async function executeSale(saleData) {
    setSubmitting(true);
    try {
      await recordProductSale({ productId: saleData.productId, quantity: saleData.quantity, saleDate: today });
      toast('Product sale recorded');
      navigate('/product-sales');
    } catch (err) {
      console.error('Product sale error:', err);
      toast(getUserFriendlyError(err), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const filteredProducts = products
    .filter(p => parseFloat(p.quantity_on_hand || 0) > 0)
    .filter(p => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="fade-in">
      <div className="page-header-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/product-sales')} title="Back to sales list">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1>Record Product Sale</h1>
            <p className="page-subtitle">Enter sale details below</p>
          </div>
        </div>
      </div>

      <div className="nps-container">
        {loading ? (
          <div>
            <div className="skeleton" style={{ height: 48, marginBottom: '0.75rem' }}>&nbsp;</div>
            <div className="skeleton" style={{ height: 48, marginBottom: '0.75rem' }}>&nbsp;</div>
            <div className="skeleton" style={{ height: 48 }}>&nbsp;</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="nps-form">
            {calcTotal() !== null && (
              <div className="nps-total-banner">
                <span className="nps-total-label">Total the customer pays</span>
                <span className="nps-total-value">{formatPeso(calcTotal())}</span>
                <span className="nps-total-breakdown">
                  {parseFloat(quantity).toLocaleString()} × {formatPeso(parseFloat(selectedProduct.price || 0))}
                </span>
              </div>
            )}
            <div className="nps-card">
              <div className="nps-card-header">
                <ShoppingCart size={20} />
                <span>Sale Information</span>
              </div>
              <div className="nps-card-body">
                <div className="nps-field">
                  <label>Product</label>
                  <div className="nps-search-wrapper">
                    <Search size={16} className="nps-search-icon" />
                    <input
                      type="text"
                      className="nps-search-input"
                      placeholder="Search products..."
                      value={searchQuery}
                      onChange={e => { setSearchQuery(e.target.value); setProductId(''); }}
                    />
                  </div>
                  <div className="nps-product-list">
                    {filteredProducts.length === 0 ? (
                      <div className="nps-empty-products">No products with stock found</div>
                    ) : (
                      filteredProducts.map(p => {
                        const unit = p.unit || 'units';
                        const stock = parseFloat(p.quantity_on_hand || 0);
                        const price = parseFloat(p.price || 0);
                        const isSelected = parseInt(productId, 10) === p.id;
                        return (
                          <label
                            key={p.id}
                            className={`nps-product-option ${isSelected ? 'selected' : ''}`}
                            onClick={() => { setProductId(String(p.id)); setSearchQuery(''); }}
                          >
                            <input type="radio" name="product" value={p.id} checked={isSelected} onChange={() => {}} className="nps-radio" />
                            <div className="nps-product-info">
                              <span className="nps-product-name">{p.name}</span>
                              <span className="nps-product-meta">
                                {stock.toLocaleString()} {unit} in stock · {price > 0 ? formatPeso(price) + '/' + unit : 'No price'}
                              </span>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                {selectedProduct && (
                  <div className="nps-field">
                    <label>Quantity ({selectedProduct.unit || 'units'})</label>
                    <div className="nps-qty-row">
                      <input
                        type="number"
                        min="1"
                        step="any"
                        placeholder="Enter quantity"
                        value={quantity}
                        onChange={e => setQuantity(e.target.value)}
                        className="nps-qty-input"
                        autoFocus
                      />
                      <span className="nps-max-label">
                        Max: {parseFloat(selectedProduct.quantity_on_hand || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="nps-actions">
              <button type="button" className="btn btn-secondary" onClick={() => navigate('/product-sales')}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || !productId || !quantity}
              >
                {submitting ? 'Recording...' : 'Review & Record Sale'}
              </button>
            </div>
          </form>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmSale}
        title="Record this sale?"
        message={confirmSale ? `Record sale of ${confirmSale.quantity.toLocaleString()} units of ${confirmSale.productName}? Stock will be deducted automatically.` : ''}
        confirmLabel="Record Sale"
        variant="primary"
        icon={ShoppingCart}
        onConfirm={() => { const d = confirmSale; setConfirmSale(null); executeSale(d); }}
        onCancel={() => setConfirmSale(null)}
      />

      <style>{`
        .nps-container {
          margin: 1.5rem 0;
        }
        .nps-form {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .nps-card {
          background: var(--color-card);
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-lg);
          overflow: hidden;
          box-shadow: var(--shadow-sm);
        }
        .nps-card-header {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          padding: 0.875rem 1.25rem;
          background: var(--color-bg);
          border-bottom: 1px solid var(--color-border-light);
          font-weight: 600;
          font-size: 0.9375rem;
          color: var(--color-text);
        }
        .nps-card-header svg {
          color: var(--color-primary);
          flex-shrink: 0;
        }
        .nps-card-body {
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .nps-field {
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }
        .nps-field > label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .nps-search-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }
        .nps-search-icon {
          position: absolute;
          left: 0.75rem;
          color: var(--color-text-muted);
          pointer-events: none;
        }
        .nps-search-input {
          width: 100%;
          padding: 0.625rem 0.75rem 0.625rem 2.25rem;
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-sm);
          font-size: 0.9375rem;
          color: var(--color-text);
          background: var(--color-card);
          outline: none;
          box-sizing: border-box;
        }
        .nps-search-input:focus {
          border-color: var(--color-primary);
        }
        .nps-product-list {
          max-height: 260px;
          overflow-y: auto;
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-sm);
          display: flex;
          flex-direction: column;
        }
        .nps-empty-products {
          padding: 1.5rem;
          text-align: center;
          color: var(--color-text-muted);
          font-size: 0.875rem;
        }
        .nps-product-option {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          cursor: pointer;
          border-bottom: 1px solid var(--color-border-light);
          transition: background var(--transition-fast);
        }
        .nps-product-option:last-child {
          border-bottom: none;
        }
        .nps-product-option:hover {
          background: var(--color-bg);
        }
        .nps-product-option.selected {
          background: var(--color-primary-50);
        }
        .nps-radio {
          width: 16px;
          height: 16px;
          cursor: pointer;
          accent-color: var(--color-primary);
          flex-shrink: 0;
        }
        .nps-product-info {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
          min-width: 0;
          flex: 1;
        }
        .nps-product-name {
          font-weight: 600;
          font-size: 0.875rem;
          color: var(--color-text);
        }
        .nps-product-meta {
          font-size: 0.75rem;
          color: var(--color-text-muted);
        }
        .nps-qty-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .nps-qty-input {
          flex: 1;
          padding: 0.75rem 1rem;
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-sm);
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--color-text);
          background: var(--color-card);
          outline: none;
        }
        .nps-qty-input:focus {
          border-color: var(--color-primary);
        }
        .nps-max-label {
          font-size: 0.75rem;
          color: var(--color-text-muted);
          white-space: nowrap;
          flex-shrink: 0;
        }
        .nps-total-banner { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; padding: 1.75rem; background: linear-gradient(135deg, var(--color-primary), #1b5e20); border-radius: var(--radius-lg); color: white; text-align: center; box-shadow: var(--shadow-md); }
        .nps-total-label { font-size: 0.875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.85; }
        .nps-total-value { font-size: 2.75rem; font-weight: 800; line-height: 1.1; letter-spacing: -0.02em; }
        .nps-total-breakdown { font-size: 0.875rem; opacity: 0.75; }
        .nps-product-option {
          display: flex;
          align-items: center;
          gap: 0.875rem;
          padding: 0.875rem 1.125rem;
          cursor: pointer;
          border-bottom: 1px solid var(--color-border-light);
          transition: background var(--transition-fast);
        }
        .nps-product-option:last-child {
          border-bottom: none;
        }
        .nps-product-option:hover {
          background: var(--color-bg);
        }
        .nps-product-option.selected {
          background: var(--color-primary-50);
        }
        .nps-radio {
          width: 18px;
          height: 18px;
          cursor: pointer;
          accent-color: var(--color-primary);
          flex-shrink: 0;
        }
        .nps-product-info {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
          min-width: 0;
          flex: 1;
        }
        .nps-product-name {
          font-weight: 600;
          font-size: 0.9375rem;
          color: var(--color-text);
        }
        .nps-product-meta {
          font-size: 0.8125rem;
          color: var(--color-text-muted);
        }
        .nps-qty-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .nps-qty-input {
          flex: 1;
          padding: 0.875rem 1rem;
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-sm);
          font-size: 1.375rem;
          font-weight: 700;
          color: var(--color-text);
          background: var(--color-card);
          outline: none;
        }
        .nps-qty-input:focus {
          border-color: var(--color-primary);
        }
        .nps-max-label {
          font-size: 0.8125rem;
          color: var(--color-text-muted);
          white-space: nowrap;
          flex-shrink: 0;
        }
        @media (max-width: 640px) {
          .nps-container { margin: 0.75rem 0; }
          .nps-actions { flex-direction: column-reverse; }
          .nps-actions .btn { width: 100%; text-align: center; min-height: 48px; font-size: 1rem; }
          .nps-total-value { font-size: 2.25rem; }
          .nps-qty-input { font-size: 16px; min-height: 48px; }
          .nps-product-option { min-height: 48px; }
        }
      `}</style>
    </div>
  );
}
