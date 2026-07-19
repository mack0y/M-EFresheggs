import { useState, useEffect, useCallback } from 'react';
import {
  Package,
  Plus,
  Edit3,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Tag,
  Search,
} from 'lucide-react';
import { fetchProducts, addProduct, updateProduct, deleteProduct, calculateSellingPrice, autoFillPricing, formatPeso } from '../lib/api';
import { toast } from '../lib/toastFn';
import { getUserFriendlyError } from '../lib/errors';
import ConfirmDialog from './ConfirmDialog';

const CATEGORIES = ['Frozen', 'Canned', 'Others'];
const UNITS = ['pcs', 'kg', 'box', 'tray', 'can', 'pack', 'bottle', 'sachet'];

const categoryColors = {
  Frozen: { bg: '#E3F2FD', color: '#1565C0' },
  Canned: { bg: '#FFF3E0', color: '#E65100' },
  Others: { bg: '#F3E5F5', color: '#7B1FA2' },
};

const emptyForm = {
  id: null,
  name: '',
  category: 'Others',
  unitOfSale: 'pcs',
  purchaseUnit: 'pcs',
  qtyPerPurchase: 1,
  costPrice: '',
  sellingPrice: '',
  quantityOnHand: 0,
};

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [pricingMode, setPricingMode] = useState('markup');
  const [markupInput, setMarkupInput] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchProducts();
      setProducts(data || []);
    } catch (err) {
      console.error('Products load error:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => loadData(), 0);
    return () => clearTimeout(id);
  }, [loadData]);

  function openAdd() {
    setForm({ ...emptyForm });
    setPricingMode('markup');
    setMarkupInput('');
    setShowForm(true);
  }

  function openEdit(p) {
    const cost = p.cost || '';
    const price = p.price || '';
    setForm({
      id: p.id,
      name: p.name || '',
      category: p.category || 'Others',
      unitOfSale: p.unit || 'pcs',
      purchaseUnit: p.purchase_unit || 'pcs',
      qtyPerPurchase: p.purchase_qty_per_unit || 1,
      costPrice: cost,
      sellingPrice: price,
      quantityOnHand: p.quantity_on_hand || 0,
    });
    setPricingMode(p.markup_percentage ? 'markup' : 'direct');
    setMarkupInput(p.markup_percentage ? String(p.markup_percentage) : '');
    setShowForm(true);
  }

  function getMarginPreview() {
    const cost = parseFloat(form.costPrice) || 0;
    const price = parseFloat(form.sellingPrice) || 0;
    if (cost <= 0 || price <= 0) return null;
    const profit = price - cost;
    const margin = ((profit / price) * 100).toFixed(1);
    return { profit, margin };
  }

  function handleCostPriceChange(val) {
    const cost = parseFloat(val) || 0;
    setForm(prev => {
      const updated = { ...prev, costPrice: val };
      if (pricingMode === 'markup' && prev.sellingPrice > 0) {
        const markup = parseFloat(prev.sellingPrice) || 0;
        if (markup > 0) {
          updated.sellingPrice = calculateSellingPrice(cost, markup);
        }
      }
      return updated;
    });
    // Recompute markup from current selling price
    const price = parseFloat(form.sellingPrice) || 0;
    if (pricingMode === 'markup' && cost > 0 && price > 0) {
      const m = ((price - cost) / cost) * 100;
      setMarkupInput(m > 0 ? m.toFixed(1) : '');
    }
  }

  function handleSellingPriceChange(val) {
    setForm(prev => {
      const updated = { ...prev, sellingPrice: val };
      if (pricingMode === 'markup' && prev.costPrice > 0) {
        const pricing = autoFillPricing(parseFloat(prev.costPrice), parseFloat(val), null);
        if (pricing) updated.costPrice = pricing.cost;
      }
      return updated;
    });
    // Recompute markup from current cost price
    const cost = parseFloat(form.costPrice) || 0;
    const price = parseFloat(val) || 0;
    if (pricingMode === 'markup' && cost > 0 && price > 0) {
      const m = ((price - cost) / cost) * 100;
      setMarkupInput(m > 0 ? m.toFixed(1) : '');
    }
  }

  function handleMarkupChange(val) {
    setMarkupInput(val);
    const cost = parseFloat(form.costPrice) || 0;
    if (cost > 0 && val) {
      const newPrice = calculateSellingPrice(cost, parseFloat(val));
      setForm(prev => ({ ...prev, sellingPrice: String(newPrice) }));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast('Product name is required', 'error');
      return;
    }
    const cost = parseFloat(form.costPrice) || 0;
    const price = parseFloat(form.sellingPrice) || 0;
    if (cost <= 0 && price <= 0) {
      toast('Enter cost price or selling price', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        unitOfSale: form.unitOfSale,
        purchaseUnit: form.purchaseUnit,
        qtyPerPurchase: form.qtyPerPurchase,
        costPrice: cost,
        sellingPrice: price,
      };

      if (form.id) {
        await updateProduct(form.id, {
          name: payload.name,
          category: payload.category,
          unit: payload.unitOfSale,
          purchase_unit: payload.purchaseUnit,
          purchase_qty_per_unit: payload.qtyPerPurchase,
          cost: payload.costPrice,
          price: payload.sellingPrice,
        });
        toast('Product updated');
      } else {
        await addProduct(payload);
        toast('Product added');
      }
      setShowForm(false);
      loadData();
    } catch (err) {
      console.error('Product save error:', err);
      const msg = getUserFriendlyError(err);
      if (msg.includes('unique') || msg.includes('duplicate')) {
        toast('A product with this name already exists', 'error');
      } else {
        toast(msg || 'Failed to save product', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteProduct(id);
      toast('Product deleted');
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      console.error('Delete error:', err);
      toast('Failed to delete product', 'error');
    }
  }

  const filtered = products.filter(p => {
    if (filterCategory !== 'all' && p.category !== filterCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (p.name || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q);
    }
    return true;
  });

  const totalStockValue = products.reduce((sum, p) => sum + (parseFloat(p.price || 0) * parseFloat(p.quantity_on_hand || 0)), 0);
  const totalStockQty = products.reduce((sum, p) => sum + parseFloat(p.quantity_on_hand || 0), 0);
  const categoryCounts = {};
  products.forEach(p => {
    categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
  });

  const margin = getMarginPreview();

  return (
    <div className="fade-in">
      <div className="page-header-row">
        <div>
          <h1>Products</h1>
          <p className="page-subtitle">Manage product catalog</p>
        </div>
        <button className="btn btn-primary" onClick={() => showForm ? setShowForm(false) : openAdd()}>
          <Plus size={18} />
          {showForm ? 'Cancel' : 'Add Product'}
        </button>
      </div>

      {error && !loading && (
        <div className="error-banner" style={{ marginBottom: '1rem' }}>
          <AlertTriangle size={20} />
          <div className="error-banner-content">
            <strong>Failed to load products</strong>
            <p>{getUserFriendlyError(error)}</p>
          </div>
          <button className="btn btn-sm btn-secondary" onClick={loadData}>
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="prod-stats">
        <div className="prod-stat-card">
          <Package size={18} />
          <div>
            <span className="prod-stat-value">{products.length}</span>
            <span className="prod-stat-label">products</span>
          </div>
        </div>
        <div className="prod-stat-card">
          <Tag size={18} />
          <div>
            <span className="prod-stat-value">{totalStockQty.toLocaleString()}</span>
            <span className="prod-stat-label">units in stock</span>
          </div>
        </div>
        <div className="prod-stat-card">
          <Tag size={18} />
          <div>
            <span className="prod-stat-value">{formatPeso(totalStockValue)}</span>
            <span className="prod-stat-label">stock value</span>
          </div>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card prod-form-card">
          <h3 style={{ marginBottom: '1rem' }}>
            <Package size={18} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
            {form.id ? 'Edit Product' : 'Add New Product'}
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="prod-form-grid">
              <div className="input-group">
                <label htmlFor="prod-name">Product Name</label>
                <input id="prod-name" type="text" className="input" placeholder="e.g. Frozen Fish Ball" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="input-group">
                <label htmlFor="prod-category">Category</label>
                <select id="prod-category" className="select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label htmlFor="prod-unit-sale">Unit of Sale</label>
                <select id="prod-unit-sale" className="select" value={form.unitOfSale} onChange={e => setForm({ ...form, unitOfSale: e.target.value })}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label htmlFor="prod-unit-purchase">Purchase Unit</label>
                <select id="prod-unit-purchase" className="select" value={form.purchaseUnit} onChange={e => setForm({ ...form, purchaseUnit: e.target.value })}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label htmlFor="prod-qty-per">Qty per Purchase Unit</label>
                <input id="prod-qty-per" type="number" min="1" step="any" className="input" value={form.qtyPerPurchase} onChange={e => setForm({ ...form, qtyPerPurchase: e.target.value })} />
              </div>
            </div>

            {/* Pricing Section */}
            <div className="prod-pricing-section">
              <div className="prod-pricing-toggle">
                <button type="button" className={`prod-pricing-btn ${pricingMode === 'markup' ? 'active' : ''}`} onClick={() => setPricingMode('markup')}>Markup %</button>
                <button type="button" className={`prod-pricing-btn ${pricingMode === 'direct' ? 'active' : ''}`} onClick={() => setPricingMode('direct')}>Direct Price</button>
              </div>

              <div className="prod-pricing-fields">
                <div className="input-group">
                  <label htmlFor="prod-cost">Cost Price (₱)</label>
                  <input id="prod-cost" type="number" min="0" step="0.01" className="input" placeholder="0.00" value={form.costPrice} onChange={e => handleCostPriceChange(e.target.value)} />
                </div>
                {pricingMode === 'markup' ? (
                  <div className="input-group">
                    <label htmlFor="prod-markup">Markup %</label>
                    <input id="prod-markup" type="number" min="0" step="0.1" className="input" placeholder="e.g. 30" value={markupInput} onChange={e => handleMarkupChange(e.target.value)} />
                  </div>
                ) : null}
                <div className="input-group">
                  <label htmlFor="prod-price">Selling Price (₱)</label>
                  <input id="prod-price" type="number" min="0" step="0.01" className="input" placeholder="0.00" value={form.sellingPrice} onChange={e => handleSellingPriceChange(e.target.value)} />
                </div>
              </div>

              {margin && (
                <div className="prod-margin-preview">
                  <span>Profit: {formatPeso(margin.profit)}</span>
                  <span>Margin: {margin.margin}%</span>
                </div>
              )}
            </div>

            <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: '1rem' }} disabled={submitting}>
              {submitting ? 'Saving...' : form.id ? 'Update Product' : 'Add Product'}
            </button>
          </form>
        </div>
      )}

      {/* Search + Filter */}
      <div className="prod-controls">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input type="text" className="input" placeholder="Search products..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <div className="prod-filter-tabs">
          <button className={`prod-filter-tab ${filterCategory === 'all' ? 'active' : ''}`} onClick={() => setFilterCategory('all')}>All</button>
          {CATEGORIES.map(c => (
            <button key={c} className={`prod-filter-tab ${filterCategory === c ? 'active' : ''}`} onClick={() => setFilterCategory(c)}>{c}</button>
          ))}
        </div>
        <span className="prod-count">Showing {filtered.length}</span>
      </div>

      {/* Product List */}
      {loading ? (
        <div className="prod-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton prod-card-skeleton">&nbsp;</div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Package size={36} />
          <p>{products.length === 0 ? 'No products yet' : 'No products match your search'}</p>
          {products.length === 0 && (
            <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Add a Product</button>
          )}
        </div>
      ) : (
        <div className="prod-grid">
          {filtered.map((p, i) => {
            const catStyle = categoryColors[p.category] || categoryColors.Others;
            const qty = parseFloat(p.quantity_on_hand || 0);
            const price = parseFloat(p.price || 0);
            const cost = parseFloat(p.cost || 0);
            const m = cost > 0 && price > 0 ? Math.round(((price - cost) / price) * 100) : 0;
            return (
              <div key={p.id} className="prod-card" style={{ animationDelay: `${i * 0.03}s` }}>
                <div className="prod-card-top">
                  <span className="prod-card-badge" style={{ background: catStyle.bg, color: catStyle.color }}>{p.category}</span>
                  <div className="prod-card-actions">
                    <button className="btn-icon" onClick={() => openEdit(p)} title="Edit"><Edit3 size={14} /></button>
                    <button className="btn-icon btn-icon-danger" onClick={() => setDeleteTarget(p)} title="Delete"><Trash2 size={14} /></button>
                  </div>
                </div>
                <h3 className="prod-card-name">{p.name}</h3>
                <div className="prod-card-pricing">
                  {price > 0 && <span className="prod-card-price">{formatPeso(price)}/{p.unit}</span>}
                  {cost > 0 && <span className="prod-card-cost">Cost: {formatPeso(cost)}</span>}
                </div>
                {m > 0 && <span className="prod-card-margin">{m}% margin</span>}
                <div className="prod-card-stock">
                  <span className={`prod-stock-badge ${qty === 0 ? 'out' : qty <= 5 ? 'low' : 'ok'}`}>
                    {qty === 0 ? 'Out of Stock' : `${qty.toLocaleString()} ${p.unit}`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this product?"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        icon={Trash2}
        onConfirm={() => { const t = deleteTarget; setDeleteTarget(null); handleDelete(t.id); }}
        onCancel={() => setDeleteTarget(null)}
      />

      <style>{`
        .prod-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin-bottom: 1.25rem; }
        .prod-stat-card { display: flex; align-items: center; gap: 0.75rem; padding: 0.875rem 1rem; background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); }
        .prod-stat-card svg { color: var(--color-primary); flex-shrink: 0; }
        .prod-stat-value { display: block; font-weight: 700; font-size: 1.0625rem; }
        .prod-stat-label { display: block; font-size: 0.75rem; color: var(--color-text-muted); }

        .prod-form-card { margin-bottom: 1.25rem; animation: fadeIn 0.3s ease-out; }
        .prod-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }

        .prod-pricing-section { margin-top: 1rem; padding: 1rem; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-bg); }
        .prod-pricing-toggle { display: flex; gap: 0.375rem; margin-bottom: 0.75rem; }
        .prod-pricing-btn { flex: 1; min-height: 36px; padding: 0.375rem; border: 1.5px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-card); color: var(--color-text-secondary); font-size: 0.8125rem; font-weight: 500; cursor: pointer; transition: all var(--transition-fast); }
        .prod-pricing-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
        .prod-pricing-btn.active { background: var(--color-primary); border-color: var(--color-primary); color: white; }
        .prod-pricing-fields { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; }

        .prod-margin-preview { display: flex; justify-content: space-between; margin-top: 0.75rem; padding: 0.5rem 0.75rem; background: var(--color-primary-50); border-radius: var(--radius-sm); font-size: 0.8125rem; font-weight: 600; color: var(--color-primary); }

        .prod-controls { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem; flex-wrap: wrap; }
        .prod-controls .search-input-wrapper { flex: 1; min-width: 200px; max-width: 320px; }
        .prod-controls .search-input-wrapper .input { padding-left: 2rem; height: 2.25rem; font-size: 0.875rem; }
        .prod-filter-tabs { display: flex; gap: 0.25rem; }
        .prod-filter-tab { min-height: 32px; padding: 0.25rem 0.75rem; border: 1.5px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-card); color: var(--color-text-secondary); font-size: 0.75rem; font-weight: 500; cursor: pointer; transition: all var(--transition-fast); }
        .prod-filter-tab:hover { border-color: var(--color-primary); color: var(--color-primary); }
        .prod-filter-tab.active { background: var(--color-primary); border-color: var(--color-primary); color: white; }
        .prod-count { font-size: 0.8125rem; color: var(--color-text-muted); white-space: nowrap; }

        .prod-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 0.75rem; }
        .prod-card { padding: 1rem; background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: var(--shadow-xs); animation: fadeIn 0.3s ease-out forwards; opacity: 0; transition: all var(--transition-fast); }
        .prod-card:hover { box-shadow: var(--shadow-sm); transform: translateY(-1px); }
        .prod-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; }
        .prod-card-badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: var(--radius-full); font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; }
        .prod-card-actions { display: flex; gap: 0.25rem; }
        .prod-card-name { font-size: 1rem; font-weight: 700; margin-bottom: 0.375rem; }
        .prod-card-pricing { display: flex; gap: 0.75rem; align-items: center; margin-bottom: 0.375rem; }
        .prod-card-price { font-weight: 700; color: var(--color-primary); font-size: 0.9375rem; }
        .prod-card-cost { font-size: 0.75rem; color: var(--color-text-muted); }
        .prod-card-margin { display: inline-block; font-size: 0.6875rem; font-weight: 600; color: var(--color-success); background: var(--color-success-bg); padding: 0.1rem 0.4rem; border-radius: var(--radius-full); margin-bottom: 0.375rem; }
        .prod-card-stock { margin-top: 0.375rem; }
        .prod-stock-badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: var(--radius-full); font-size: 0.6875rem; font-weight: 700; }
        .prod-stock-badge.ok { background: var(--color-success-bg); color: var(--color-success); }
        .prod-stock-badge.low { background: var(--color-warning-bg); color: var(--color-warning); }
        .prod-stock-badge.out { background: var(--color-danger-bg); color: var(--color-danger); }
        .prod-card-skeleton { height: 160px; border-radius: var(--radius-md); }

        @media (max-width: 640px) {
          .prod-stats { grid-template-columns: 1fr; }
          .prod-form-grid { grid-template-columns: 1fr; }
          .prod-pricing-fields { grid-template-columns: 1fr; }
          .prod-controls { flex-direction: column; align-items: stretch; }
          .prod-controls .search-input-wrapper { max-width: none; }
          .prod-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
