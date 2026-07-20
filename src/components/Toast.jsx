import { useState, useEffect, useRef, useCallback } from 'react';
import { setToastHandler } from '../lib/toastFn';

export function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);
  const timersRef = useRef({});

  const removeToast = useCallback((id) => {
    // Mark as leaving, then actually remove after animation
    setToasts(prev => prev.map(t => t.id === id ? { ...t, leaving: true } : t));
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      if (timersRef.current[id]) {
        clearTimeout(timersRef.current[id]);
        delete timersRef.current[id];
      }
    }, 300); // match exit animation duration
  }, []);

  const addToast = useCallback((message, type = 'success', action = null) => {
    const id = ++idRef.current;
    const duration = action ? 5000 : 3000;
    setToasts(prev => [...prev, { id, message, type, action, leaving: false }]);
    timersRef.current[id] = setTimeout(() => {
      removeToast(id);
    }, duration);
  }, [removeToast]);

  useEffect(() => {
    setToastHandler(addToast);
    return () => {
      setToastHandler(null);
      Object.values(timersRef.current).forEach(clearTimeout);
      timersRef.current = {};
    };
  }, [addToast]);

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`toast toast-${t.type} ${t.leaving ? 'toast-leaving' : ''}`}
          onClick={() => t.leaving ? null : removeToast(t.id)}
        >
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
              onClick={(e) => {
                e.stopPropagation();
                t.action.onClick();
                removeToast(t.id);
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
          left: 1rem;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
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
          max-width: 100%;
          pointer-events: auto;
          line-height: 1.3;
          cursor: pointer;

          /* Entrance: slide up + fade in with spring */
          transform-origin: bottom center;
          animation: toastIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        .toast.toast-leaving {
          animation: toastOut 0.25s ease-in forwards;
        }

        @keyframes toastIn {
          0% {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes toastOut {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-10px) scale(0.95);
          }
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
            left: auto;
          }

          .toast {
            max-width: 360px;
          }
        }

        @media (hover: none) and (pointer: coarse) {
          .toast {
            max-width: calc(100vw - 2rem);
          }
        }
      `}</style>
    </div>
  );
}
