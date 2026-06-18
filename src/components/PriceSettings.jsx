import { useState, useEffect } from 'react';
import { DollarSign, Save, RefreshCw, AlertTriangle } from 'lucide-react';
import { fetchPriceSettings, updatePriceSetting, formatPeso, EGG_SIZES } from '../lib/api';
import { toast } from '../lib/toastFn';
import { getUserFriendlyError } from '../lib/errors';

export default function PriceSettings() {
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(null);
  const [pieceInputs, setPieceInputs] = useState({});
  const [trayInputs, setTrayInputs] = useState({});

  useEffect(() => {
    loadPrices();
  }, []);

  async function loadPrices() {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchPriceSettings();
      setPrices(data || []);
      // Initialize input fields
      const pieces = {};
      const trays = {};
      (data || []).forEach(p => {
        pieces[p.egg_size_id] = parseFloat(p.price_per_piece || 0).toFixed(2);
        trays[p.egg_size_id] = parseFloat(p.price_per_tray || 0).toFixed(2);
      });
      setPieceInputs(pieces);
      setTrayInputs(trays);
    } catch (err) {
      console.error('Price load error:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(item) {
    const pieceVal = parseFloat(pieceInputs[item.egg_size_id]);
    const trayVal = parseFloat(trayInputs[item.egg_size_id]);

    if (isNaN(pieceVal) || pieceVal < 0) {
      toast('Invalid piece price', 'error');
      return;
    }
    if (isNaN(trayVal) || trayVal < 0) {
      toast('Invalid tray price', 'error');
      return;
    }

    setSaving(item.egg_size_id);
    try {
      await updatePriceSetting(item.egg_size_id, pieceVal, trayVal);
      toast(`${item.egg_sizes?.name} prices saved!`);
      loadPrices();
    } catch (err) {
      console.error('Price save error:', err);
      toast('Failed to save prices', 'error');
    } finally {
      setSaving(null);
    }
  }

  const sortedPrices = [...prices].sort(
    (a, b) => (a.egg_sizes?.sort_order || 0) - (b.egg_sizes?.sort_order || 0)
  );

  return (
    <div className="fade-in">
      <div className="page-header-row">
        <div>
          <h1>Pricing</h1>
          <p className="page-subtitle">Set per-piece and per-tray prices for each egg size</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadPrices}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {error && !loading && (
        <div className="error-banner">
          <AlertTriangle size={20} />
          <div className="error-banner-content">
            <strong>Failed to load prices</strong>
            <p>{getUserFriendlyError(error)}</p>
          </div>
          <button className="btn btn-sm btn-secondary" onClick={loadPrices}>
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      )}

      {!error && (
      <div className="price-list">
        {loading
          ? Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="price-card">
                <div className="skeleton" style={{ width: '40%', height: 18 }}>&nbsp;</div>
                <div className="skeleton" style={{ width: '60%', height: 28, marginTop: 8 }}>&nbsp;</div>
              </div>
            ))
          : sortedPrices.map((item, i) => {
              const name = item.egg_sizes?.name || EGG_SIZES[i] || `Size ${i + 1}`;
              const isSaving = saving === item.egg_size_id;
              const currentPiece = parseFloat(item.price_per_piece || 0);
              const currentTray = parseFloat(item.price_per_tray || 0);

              return (
                <div
                  key={item.id || i}
                  className="price-card"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  <div className="price-card-top">
                    <span className="price-name">{name}</span>
                    <div className="price-current">
                      <span className="price-current-badge">
                        Current: {formatPeso(currentPiece)} / pc &bull; {formatPeso(currentTray)} / tray
                      </span>
                    </div>
                  </div>

                  <div className="price-card-inputs">
                    <div className="price-field">
                      <label className="price-label" htmlFor={`price-piece-${item.egg_size_id}`}>Per Piece (₱)</label>
                      <input
                        id={`price-piece-${item.egg_size_id}`}
                        name={`price_piece_${item.egg_size_id}`}
                        type="number"
                        step="0.25"
                        min="0"
                        className="input"
                        value={pieceInputs[item.egg_size_id] || ''}
                        onChange={e =>
                          setPieceInputs(prev => ({
                            ...prev,
                            [item.egg_size_id]: e.target.value,
                          }))
                        }
                        disabled={isSaving}
                      />
                    </div>

                    <div className="price-field">
                      <label className="price-label" htmlFor={`price-tray-${item.egg_size_id}`}>Per Tray (₱)</label>
                      <input
                        id={`price-tray-${item.egg_size_id}`}
                        name={`price_tray_${item.egg_size_id}`}
                        type="number"
                        step="0.25"
                        min="0"
                        className="input"
                        value={trayInputs[item.egg_size_id] || ''}
                        onChange={e =>
                          setTrayInputs(prev => ({
                            ...prev,
                            [item.egg_size_id]: e.target.value,
                          }))
                        }
                        disabled={isSaving}
                      />
                    </div>

                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleSave(item)}
                      disabled={isSaving}
                      style={{ alignSelf: 'flex-end' }}
                    >
                      <Save size={14} />
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              );
            })}
      </div>
      )}

      {!loading && sortedPrices.length > 0 && (
        <div className="price-summary-card">
          <DollarSign size={18} />
          <div>
            <span className="price-summary-title">How pricing works</span>
            <p className="price-summary-text">
              When you record a sale, the total amount is calculated using the current price settings.
              Past sales keep their original amounts even if prices change later.
              Set prices to ₱0 if you haven't started selling that size yet.
            </p>
          </div>
        </div>
      )}

      <style>{`
        .price-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .price-card {
          background: var(--color-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 0.875rem 1rem;
          box-shadow: var(--shadow-sm);
          animation: fadeIn 0.3s ease-out forwards;
          opacity: 0;
        }

        .price-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.75rem;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .price-name {
          font-weight: 600;
          font-size: 1rem;
        }

        .price-current {
          display: flex;
          align-items: center;
        }

        .price-current-badge {
          display: inline-block;
          font-size: 0.75rem;
          color: var(--color-text-muted);
          background: var(--color-bg);
          padding: 0.2rem 0.5rem;
          border-radius: var(--radius-sm);
          white-space: nowrap;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .price-card-inputs {
          display: grid;
          grid-template-columns: 1fr 1fr auto;
          gap: 0.625rem;
          align-items: end;
        }

        @media (max-width: 480px) {
          .price-card-inputs {
            grid-template-columns: 1fr 1fr;
          }
          .price-card-inputs .btn {
            grid-column: 1 / -1;
          }
        }

        .price-field {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .price-label {
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--color-text-muted);
        }

        .price-summary-card {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 1rem;
          margin-top: 1rem;
          background: var(--color-primary-light);
          border: 1px solid var(--color-primary);
          border-radius: var(--radius-md);
          color: var(--color-primary);
        }

        .price-summary-title {
          font-weight: 600;
          font-size: 0.875rem;
          display: block;
        }

        .price-summary-text {
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
          margin-top: 0.2rem;
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
}
