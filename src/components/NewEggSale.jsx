import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, ArrowLeft, Egg, Check } from 'lucide-react';
import { recordSale, fetchInventory, fetchPriceSettings, formatPeso, formatInventory, TRAY_SIZE } from '../lib/api';
import { toast } from '../lib/toastFn';
import { getUserFriendlyError } from '../lib/errors';
import ConfirmDialog from './ConfirmDialog';

const QUICK_QTY = { piece: [1, 5, 10, 30], tray: [1, 2, 5, 10] };

export default function NewEggSale() {
  const navigate = useNavigate();
  const [inventory, setInventory] = useState([]);
  const [priceSettings, setPriceSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ eggSizeId: '', quantity: '', unit: 'piece' });
  const [confirmSale, setConfirmSale] = useState(null);

  const loadData = useCallback(async () => {
    const executeLoad = async () => {
      try {
        setLoading(true);
        const [invData, priceData] = await Promise.all([
          fetchInventory(),
          fetchPriceSettings(),
        ]);
        setInventory(invData || []);
        setPriceSettings(priceData || []);
      } catch (err) {
        console.error('Load error:', err);
        toast(getUserFriendlyError(err), 'error');
      } finally {
        setLoading(false);
      }
    };
    executeLoad();
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function getFormEggCount() {
    if (!form.eggSizeId || !form.quantity) return null;
    const qty = parseInt(form.quantity, 10);
    if (isNaN(qty) || qty <= 0) return null;
    if (form.unit === 'tray') return qty * TRAY_SIZE;
    return qty;
  }

  function getFormPriceDisplay() {
    if (!form.eggSizeId) return null;
    const eggSizeId = parseInt(form.eggSizeId, 10);
    const price = priceSettings.find(p => p.egg_size_id === eggSizeId);
    if (!price) return null;
    const pp = parseFloat(price.price_per_piece || 0);
    const pt = parseFloat(price.price_per_tray || 0);
    return `${pp > 0 ? formatPeso(pp) + '/pc' : ''}${pp > 0 && pt > 0 ? ' | ' : ''}${pt > 0 ? formatPeso(pt) + '/tray' : ''}`;
  }

  function calculateTotalAmount() {
    if (!form.eggSizeId || !form.quantity) return null;
    const qty = parseInt(form.quantity, 10);
    if (isNaN(qty) || qty <= 0) return null;
    const eggSizeId = parseInt(form.eggSizeId, 10);
    const price = priceSettings.find(p => p.egg_size_id === eggSizeId);
    if (!price) return null;
    const perUnitPrice = form.unit === 'tray'
      ? parseFloat(price.price_per_tray || 0)
      : parseFloat(price.price_per_piece || 0);
    const total = qty * perUnitPrice;
    return total > 0 ? total : null;
  }

  function addQuickQty(delta) {
    const current = parseInt(form.quantity, 10) || 0;
    setForm({ ...form, quantity: String(current + delta) });
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.eggSizeId || !form.quantity) {
      toast('Please fill in all fields', 'error');
      return;
    }
    const qty = parseInt(form.quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      toast('Enter a valid quantity', 'error');
      return;
    }
    const eggSizeId = parseInt(form.eggSizeId, 10);
    const ts = form.unit === 'tray' ? TRAY_SIZE : 1;
    const totalEggs = form.unit === 'tray' ? qty * ts : qty;
    const invItem = inventory.find(i => i.egg_size_id === eggSizeId);
    const stock = invItem?.quantity_on_hand || 0;
    if (totalEggs > stock) {
      toast(`Not enough stock — only ${stock} eggs available`, 'error');
      return;
    }
    setConfirmSale({
      eggSizeId, quantity: qty, unit: form.unit,
      traySize: form.unit === 'tray' ? TRAY_SIZE : null,
    });
  }

  async function executeSale(saleData) {
    setSubmitting(true);
    try {
      await recordSale(saleData);
      toast('Sale recorded!');
      navigate('/sales');
    } catch (err) {
      console.error('Sale record error:', err);
      toast(getUserFriendlyError(err), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const selectedItem = form.eggSizeId
    ? inventory.find(i => i.egg_size_id === parseInt(form.eggSizeId, 10))
    : null;

  return (
    <div className="fade-in">
      <div className="page-header-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/sales')} title="Back to sales list">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1>Record Egg Sale</h1>
            <p className="page-subtitle">Enter sale details below</p>
          </div>
        </div>
      </div>

      <div className="nes-container">
        {loading ? (
          <div>
            <div className="skeleton" style={{ height: 120, marginBottom: '0.75rem' }}>&nbsp;</div>
            <div className="skeleton" style={{ height: 48, marginBottom: '0.75rem' }}>&nbsp;</div>
            <div className="skeleton" style={{ height: 48 }}>&nbsp;</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="nes-form">
            {calculateTotalAmount() && (
              <div className="nes-total-banner">
                <span className="nes-total-label">Total the customer pays</span>
                <span className="nes-total-value">{formatPeso(calculateTotalAmount())}</span>
                <span className="nes-total-breakdown">
                  {form.unit === 'tray'
                    ? `${form.quantity} tray${form.quantity > 1 ? 's' : ''} × ${formatPeso(parseFloat(priceSettings.find(p => p.egg_size_id === selectedItem?.egg_size_id)?.price_per_tray || 0))}/tray`
                    : `${form.quantity} pc${form.quantity > 1 ? 's' : ''} × ${formatPeso(parseFloat(priceSettings.find(p => p.egg_size_id === selectedItem?.egg_size_id)?.price_per_piece || 0))}/pc`}
                </span>
              </div>
            )}
            <div className="nes-card">
              <div className="nes-card-header">
                <ShoppingCart size={20} />
                <span>Sale Information</span>
              </div>
              <div className="nes-card-body">
                <div className="nes-field">
                  <label>Egg Size</label>
                  <div className="nes-size-grid">
                    {inventory
                      .slice()
                      .sort((a, b) => (a.egg_sizes?.sort_order || 0) - (b.egg_sizes?.sort_order || 0))
                      .map(item => {
                        const selected = form.eggSizeId === String(item.egg_size_id);
                        const qty = item.quantity_on_hand || 0;
                        let stockClass = 'nes-size-stock-ok';
                        let stockLabel = 'In Stock';
                        if (qty === 0) { stockClass = 'nes-size-stock-out'; stockLabel = 'Out'; }
                        else if (qty <= 50) { stockClass = 'nes-size-stock-low'; stockLabel = 'Low'; }
                        return (
                          <button
                            key={item.egg_size_id}
                            type="button"
                            className={`nes-size-card ${selected ? 'selected' : ''} ${qty === 0 ? 'out-of-stock' : ''}`}
                            onClick={() => {
                              if (qty > 0) {
                                setForm({ ...form, eggSizeId: String(item.egg_size_id), quantity: '' });
                              }
                            }}
                          >
                            {selected && (
                              <span className="nes-size-check">
                                <Check size={16} />
                              </span>
                            )}
                            <span className="nes-size-name">{item.egg_sizes?.name || 'Unknown'}</span>
                            <span className="nes-size-stock">{qty.toLocaleString()} eggs</span>
                            <span className={`nes-size-badge ${stockClass}`}>{stockLabel}</span>
                          </button>
                        );
                      })}
                  </div>
                  {form.eggSizeId && getFormPriceDisplay() && (
                    <span className="nes-price-hint">{getFormPriceDisplay()}</span>
                  )}
                </div>

                <div className="nes-field">
                  <label>Unit</label>
                  <div className="nes-unit-tabs">
                    <button type="button" className={`nes-unit-tab ${form.unit === 'piece' ? 'active' : ''}`}
                      onClick={() => setForm({ ...form, unit: 'piece', quantity: '' })}>By Piece</button>
                    <button type="button" className={`nes-unit-tab ${form.unit === 'tray' ? 'active' : ''}`}
                      onClick={() => setForm({ ...form, unit: 'tray', quantity: '' })}>By Tray</button>
                  </div>
                </div>

                <div className="nes-field">
                  <label>Quantity ({form.unit === 'tray' ? 'trays' : 'eggs'})</label>
                  <input
                    type="number" min="1"
                    placeholder={form.unit === 'tray' ? 'Number of trays' : 'Number of eggs'}
                    value={form.quantity}
                    onChange={e => setForm({ ...form, quantity: e.target.value })}
                    className="nes-qty-input"
                    required
                    autoFocus={!!form.eggSizeId}
                  />
                  <div className="nes-quick-chips">
                    {(form.unit === 'piece' ? QUICK_QTY.piece : QUICK_QTY.tray).map(v => (
                      <button key={v} type="button" className="nes-chip" onClick={() => addQuickQty(v)}>+{v}</button>
                    ))}
                  </div>
                </div>

                {getFormEggCount() !== null && (
                  <div className="nes-conversion">
                    <Egg size={14} />
                    <span>= {formatInventory(getFormEggCount())}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="nes-actions">
              <button type="button" className="btn btn-secondary" onClick={() => navigate('/sales')}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || !form.eggSizeId || !form.quantity}
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
        message={confirmSale ? (() => {
          const sn = inventory.find(i => i.egg_size_id === confirmSale.eggSizeId)?.egg_sizes?.name || 'Unknown';
          const ql = confirmSale.unit === 'tray'
            ? `${confirmSale.quantity} tray${confirmSale.quantity > 1 ? 's' : ''} (${confirmSale.quantity * confirmSale.traySize} eggs)`
            : `${confirmSale.quantity} egg${confirmSale.quantity > 1 ? 's' : ''}`;
          return `Record sale of ${ql} of ${sn}? Stock will be deducted automatically.`;
        })() : ''}
        confirmLabel="Record Sale"
        variant="primary"
        icon={ShoppingCart}
        onConfirm={() => { const d = confirmSale; setConfirmSale(null); executeSale(d); }}
        onCancel={() => setConfirmSale(null)}
      />

      <style>{`
        .nes-container { margin: 1.5rem 0; }
        .nes-form { display: flex; flex-direction: column; gap: 1.25rem; }
        .nes-card { background: var(--color-card); border: 1px solid var(--color-border-light); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow-sm); }
        .nes-card-header { display: flex; align-items: center; gap: 0.625rem; padding: 0.875rem 1.25rem; background: var(--color-bg); border-bottom: 1px solid var(--color-border-light); font-weight: 600; font-size: 0.9375rem; color: var(--color-text); }
        .nes-card-header svg { color: var(--color-primary); flex-shrink: 0; }
        .nes-card-body { padding: 1.25rem; display: flex; flex-direction: column; gap: 1.25rem; }
        .nes-field { display: flex; flex-direction: column; gap: 0.375rem; }
        .nes-field > label { font-size: 0.75rem; font-weight: 600; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.03em; }

        .nes-total-banner { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; padding: 1.5rem; background: linear-gradient(135deg, var(--color-primary), #1b5e20); border-radius: var(--radius-lg); color: white; text-align: center; box-shadow: var(--shadow-md); }
        .nes-total-label { font-size: 0.8125rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.85; }
        .nes-total-value { font-size: 2.5rem; font-weight: 800; line-height: 1.1; letter-spacing: -0.02em; }
        .nes-total-breakdown { font-size: 0.8125rem; opacity: 0.75; }

        .nes-size-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.75rem; }
        .nes-size-card { position: relative; display: flex; flex-direction: column; align-items: center; gap: 0.25rem; padding: 1rem 0.75rem; border: 2px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-card); cursor: pointer; transition: all var(--transition-fast); }
        .nes-size-card:hover:not(.out-of-stock) { border-color: var(--color-primary); }
        .nes-size-card.selected { border-color: var(--color-primary); background: var(--color-primary-light); }
        .nes-size-card.out-of-stock { opacity: 0.45; cursor: not-allowed; }
        .nes-size-check { position: absolute; top: 4px; right: 4px; color: var(--color-primary); }
        .nes-size-name { font-weight: 700; font-size: 1rem; text-align: center; color: var(--color-text); }
        .nes-size-stock { font-size: 0.8125rem; color: var(--color-text-muted); }
        .nes-size-badge { font-size: 0.75rem; font-weight: 700; padding: 0.25rem 0.75rem; border-radius: 99px; }
        .nes-size-stock-ok { background: #E8F5E9; color: #2E7D32; }
        .nes-size-stock-low { background: #FFF3E0; color: #E65100; }
        .nes-size-stock-out { background: #FFEBEE; color: #C62828; }
        .nes-price-hint { font-size: 0.875rem; color: var(--color-text-muted); }

        .nes-unit-tabs { display: flex; gap: 0.25rem; }
        .nes-unit-tab { flex: 1; padding: 0.625rem; border: 1.5px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-card); font-size: 0.875rem; font-weight: 600; color: var(--color-text); cursor: pointer; transition: all var(--transition-fast); }
        .nes-unit-tab.active { background: var(--color-primary); border-color: var(--color-primary); color: white; }
        .nes-unit-tab:hover:not(.active) { border-color: var(--color-primary); color: var(--color-text); }

        .nes-qty-input { width: 100%; padding: 0.875rem 1rem; border: 1.5px solid var(--color-border); border-radius: var(--radius-sm); font-size: 1.375rem; font-weight: 700; color: var(--color-text); background: var(--color-card); outline: none; box-sizing: border-box; }
        .nes-qty-input:focus { border-color: var(--color-primary); }

        .nes-quick-chips { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.375rem; }
        .nes-chip { padding: 0.375rem 0.875rem; border: 1px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-card); font-size: 0.8125rem; font-weight: 600; color: var(--color-text-secondary); cursor: pointer; transition: all var(--transition-fast); }
        .nes-chip:hover { border-color: var(--color-primary); color: var(--color-primary); }

        .nes-conversion { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; color: var(--color-text-muted); }
        .nes-conversion svg { flex-shrink: 0; }

        .nes-actions { display: flex; justify-content: flex-end; gap: 0.75rem; }

        @media (max-width: 640px) {
          .nes-container { margin: 1rem 0; }
          .nes-actions { flex-direction: column-reverse; }
          .nes-actions .btn { width: 100%; text-align: center; }
          .nes-size-grid { grid-template-columns: repeat(2, 1fr); }
          .nes-total-value { font-size: 2rem; }
        }
      `}</style>
    </div>
  );
}
