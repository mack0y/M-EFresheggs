import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import PropTypes from 'prop-types';



function handleKeyDown(e, onCancel, onConfirm) {
  if (e.key === 'Escape') { e.stopPropagation(); onCancel?.(); return; }
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onConfirm?.(); return; }
  const focusable = e.currentTarget.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.key === 'Tab') {
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
}

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'danger', icon: Icon, onConfirm, onCancel }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (open && dialogRef.current) {
      const els = dialogRef.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (els.length > 0) els[0].focus();
    }
  }, [open]);

  if (!open) return null;

  const iconColor = variant === 'danger' ? 'var(--color-danger)' : 'var(--color-primary)';
  const iconBg = variant === 'danger' ? 'var(--color-danger-bg)' : 'var(--color-primary-light)';
  const btnClass = variant === 'danger' ? 'btn-confirm-danger' : 'btn-confirm-primary';

  return (
    <div className="confirm-overlay" onClick={() => onCancel?.()}>
      <div className="confirm-dialog" role="dialog" aria-modal="true" aria-label={title} ref={dialogRef} onKeyDown={e => handleKeyDown(e, onCancel, onConfirm)} onClick={e => e.stopPropagation()}>
        <div className="confirm-icon" style={{ background: iconBg, color: iconColor }}>
          {Icon ? <Icon size={28} /> : <AlertTriangle size={28} />}
        </div>
        <h3 className="confirm-title">{title}</h3>
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button className="btn btn-secondary" onClick={() => onCancel?.()}>
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
          z-index: 6000;
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

ConfirmDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  title: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
  confirmLabel: PropTypes.string,
  cancelLabel: PropTypes.string,
  variant: PropTypes.oneOf(['danger', 'primary']),
  icon: PropTypes.elementType,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func,
};
