import { useState, useCallback } from 'react';

/**
 * Custom hook for confirm dialog state management.
 * Encapsulates the open/close pattern used across multiple components.
 *
 * @returns {Object} { target, openConfirm, closeConfirm, isOpen }
 */
export function useConfirmDialog() {
  const [target, setTarget] = useState(null);

  const openConfirm = useCallback((data) => {
    setTarget(data);
  }, []);

  const closeConfirm = useCallback(() => {
    setTarget(null);
  }, []);

  return {
    target,
    isOpen: target !== null,
    openConfirm,
    closeConfirm,
  };
}
