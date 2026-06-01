import { AlertTriangle } from 'lucide-react';

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'danger', icon: Icon, onConfirm, onCancel }) {
  if (!open) return null;

  const iconColor = variant === 'danger' ? 'var(--color-danger)' : 'var(--color-primary)';
  const iconBg = variant === 'danger' ? 'var(--color-danger-bg)' : 'var(--color-primary-light)';
  const btnClass = variant === 'danger' ? 'btn-confirm-danger' : 'btn-confirm-primary';

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
        <div className="confirm-icon" style={{ background: iconBg, color: iconColor }}>
          {Icon ? <Icon size={28} /> : <AlertTriangle size={28} />}
        </div>
        <h3 className="confirm-title">{title}</h3>
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button className={`btn ${btnClass}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>

      <style>{`
        .confirm-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          padding: 1rem;
          animation: fadeIn 0.15s ease-out;
        }

        .confirm-dialog {
          background: var(--color-card);
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-xl);
          padding: 2rem;
          max-width: 400px;
          width: 100%;
          box-shadow: var(--shadow-xl);
          text-align: center;
          animation: scaleIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .confirm-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          margin-bottom: 1rem;
        }

        .confirm-title {
          font-size: 1.125rem;
          font-weight: var(--font-weight-semibold);
          margin-bottom: 0.5rem;
        }

        .confirm-message {
          color: var(--color-text-secondary);
          font-size: 0.9375rem;
          line-height: 1.5;
          margin-bottom: 1.5rem;
        }

        .confirm-actions {
          display: flex;
          gap: 0.625rem;
          justify-content: center;
        }

        .confirm-actions .btn {
          flex: 1;
          max-width: 140px;
        }

        .btn-confirm-primary {
          background: var(--color-primary);
          color: white;
          box-shadow: var(--shadow-sm);
        }

        .btn-confirm-primary:hover {
          background: var(--color-primary-hover);
          box-shadow: var(--shadow-md);
        }

        .btn-confirm-danger {
          background: var(--color-danger);
          color: white;
          box-shadow: var(--shadow-sm);
        }

        .btn-confirm-danger:hover {
          background: #B71C1C;
          box-shadow: var(--shadow-md);
        }
      `}</style>
    </div>
  );
}
