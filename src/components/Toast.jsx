import { useState, useEffect, useRef, useCallback } from 'react';
import { setToastHandler } from '../lib/toastFn';

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const addToast = useCallback((message, type = 'success', action = null) => {
    const id = ++idRef.current;
    const duration = action ? 5000 : 3000;
    setToasts(prev => [...prev, { id, message, type, action }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  useEffect(() => {
    setToastHandler(addToast);
    return () => { setToastHandler(null); };
  }, [addToast]);

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.type === 'success' && (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <path d="M13.5 4.5L6 12L2.5 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
          {t.type === 'error' && (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          )}
          <span>{t.message}</span>
          {t.action && (
            <button
              className="toast-action"
              onClick={() => {
                t.action.onClick();
                setToasts(prev => prev.filter(toast => toast.id !== t.id));
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}

      <style>{`
        .toast-container {
          position: fixed;
          bottom: 5rem;
          right: 1rem;
          z-index: 1000;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          pointer-events: none;
        }

        .toast {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          border-radius: var(--radius-md);
          font-size: 0.875rem;
          font-weight: var(--font-weight-medium);
          box-shadow: var(--shadow-xl);
          animation: slideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
          max-width: 360px;
          pointer-events: auto;
          line-height: 1.3;
        }

        .toast-success { background: var(--color-success); color: white; }
        .toast-error { background: var(--color-danger); color: white; }

        .toast-action {
          margin-left: auto;
          padding: 0.25rem 0.625rem;
          border: 1px solid rgba(255,255,255,0.5);
          border-radius: var(--radius-sm);
          background: transparent;
          color: white;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
        }

        .toast-action:hover {
          background: rgba(255,255,255,0.2);
          border-color: rgba(255,255,255,0.8);
        }

        @media (min-width: 768px) {
          .toast-container {
            bottom: 1.5rem;
            right: 1.5rem;
          }
        }
      `}</style>
    </div>
  );
}
