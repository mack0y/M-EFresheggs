import { useEffect } from 'react';
import { CheckCircle, Egg, Package, User, Clock } from 'lucide-react';
import { formatPeso } from '../lib/api';

export default function ReceiptView({ transaction, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => { onClose(); }, 30000);
    return () => clearTimeout(timer);
  }, [onClose]);

  if (!transaction) return null;

  const { transaction: tx, eggSales, productSales } = transaction;
  const eggTotal = (eggSales || []).reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0);
  const prodTotal = (productSales || []).reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0);

  return (
    <div className="rv-overlay" onClick={onClose}>
      <div className="rv-receipt" onClick={e => e.stopPropagation()}>
        <div className="rv-success-icon">
          <CheckCircle size={48} />
        </div>
        <h2 className="rv-title">Sale Recorded!</h2>
        <p className="rv-subtitle">Transaction #{tx.id}</p>

        {tx.customers?.name && (
          <div className="rv-customer">
            <User size={14} />
            <span>{tx.customers.name}</span>
          </div>
        )}

        <div className="rv-meta">
          <span><Clock size={13} /> {tx.sale_date} {tx.sale_time?.slice(0, 5)}</span>
        </div>

        <div className="rv-items">
          {eggSales && eggSales.length > 0 && (
            <div className="rv-section">
              <div className="rv-section-header">
                <Egg size={14} />
                <span>Eggs</span>
              </div>
              {eggSales.map((sale, i) => (
                <div key={i} className="rv-item">
                  <span className="rv-item-name">{sale.egg_sizes?.name || 'Unknown'}</span>
                  <span className="rv-item-detail">
                    {sale.quantity} {sale.unit === 'tray' ? 'tray' : 'pc'}{sale.quantity > 1 ? 's' : ''}
                  </span>
                  <span className="rv-item-total">{formatPeso(sale.total_amount)}</span>
                </div>
              ))}
              <div className="rv-section-total">
                <span>Egg Subtotal</span>
                <span>{formatPeso(eggTotal)}</span>
              </div>
            </div>
          )}

          {productSales && productSales.length > 0 && (
            <div className="rv-section">
              <div className="rv-section-header">
                <Package size={14} />
                <span>Products</span>
              </div>
              {productSales.map((sale, i) => (
                <div key={i} className="rv-item">
                  <span className="rv-item-name">{sale.products?.name || 'Unknown'}</span>
                  <span className="rv-item-detail">
                    {sale.quantity} {sale.products?.unit_of_sale || 'units'}
                  </span>
                  <span className="rv-item-total">{formatPeso(sale.total_amount)}</span>
                </div>
              ))}
              <div className="rv-section-total">
                <span>Product Subtotal</span>
                <span>{formatPeso(prodTotal)}</span>
              </div>
            </div>
          )}
        </div>

        <div className="rv-grand-total">
          <span>Total</span>
          <span className="rv-grand-total-value">{formatPeso(tx.total_amount)}</span>
        </div>

        <button className="btn btn-primary rv-done-btn" onClick={onClose}>
          Done
        </button>

        <p className="rv-dismiss-hint">Auto-closes in 30s</p>
      </div>

      <style>{`
        .rv-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 7000;
          padding: 1rem;
          animation: fadeIn 0.2s ease-out;
        }

        .rv-receipt {
          background: var(--color-card);
          border-radius: var(--radius-lg);
          padding: 2rem;
          max-width: 420px;
          width: 100%;
          max-height: 85vh;
          overflow-y: auto;
          box-shadow: var(--shadow-xl);
          text-align: center;
          animation: slideUp 0.3s ease-out;
        }

        .rv-success-icon {
          color: var(--color-success);
          margin-bottom: 0.75rem;
        }

        .rv-title {
          font-size: 1.375rem;
          font-weight: 800;
          margin-bottom: 0.25rem;
        }

        .rv-subtitle {
          font-size: 0.875rem;
          color: var(--color-text-muted);
          margin-bottom: 0.75rem;
        }

        .rv-customer {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.3rem 0.75rem;
          background: var(--color-primary-light);
          border-radius: 99px;
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--color-primary);
          margin-bottom: 0.75rem;
        }

        .rv-meta {
          font-size: 0.75rem;
          color: var(--color-text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.375rem;
          margin-bottom: 1.25rem;
        }

        .rv-items {
          text-align: left;
          margin-bottom: 1rem;
        }

        .rv-section {
          margin-bottom: 1rem;
        }

        .rv-section-header {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 0.5rem;
          padding-bottom: 0.375rem;
          border-bottom: 1px solid var(--color-border-light);
        }

        .rv-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.375rem 0;
          font-size: 0.875rem;
        }

        .rv-item-name {
          font-weight: 600;
          flex: 1;
        }

        .rv-item-detail {
          color: var(--color-text-muted);
          font-size: 0.8125rem;
          margin: 0 0.75rem;
          white-space: nowrap;
        }

        .rv-item-total {
          font-weight: 600;
          font-variant-numeric: tabular-nums;
        }

        .rv-section-total {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 0.375rem;
          border-top: 1px solid var(--color-border-light);
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--color-text-secondary);
        }

        .rv-grand-total {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem;
          background: var(--color-success-bg);
          border-radius: var(--radius-md);
          margin-bottom: 1rem;
        }

        .rv-grand-total-value {
          font-size: 1.5rem;
          font-weight: 800;
          color: var(--color-success);
        }

        .rv-done-btn {
          width: 100%;
          margin-bottom: 0.5rem;
        }

        .rv-dismiss-hint {
          font-size: 0.6875rem;
          color: var(--color-text-muted);
        }
      `}</style>
    </div>
  );
}
