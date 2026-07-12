import { createContext, useContext, useState, useCallback, useMemo } from 'react';

const CartContext = createContext(null);

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [customer, setCustomer] = useState(null);

  const addItem = useCallback((newItem) => {
    setItems(prev => {
      // Dedup: same type + same id + same unit = merge quantities
      const idx = prev.findIndex(
        i => i.type === newItem.type && i.id === newItem.id && i.unit === newItem.unit
      );
      if (idx >= 0) {
        const updated = [...prev];
        const old = updated[idx];
        const mergedQty = old.quantity + newItem.quantity;
        updated[idx] = {
          ...old,
          quantity: mergedQty,
          total: mergedQty * old.pricePerUnit,
        };
        return updated;
      }
      return [...prev, { ...newItem }];
    });
  }, []);

  const removeItem = useCallback((index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateItemQty = useCallback((index, quantity) => {
    setItems(prev => {
      const updated = [...prev];
      const item = updated[index];
      if (!item) return prev;
      updated[index] = {
        ...item,
        quantity,
        total: quantity * item.pricePerUnit,
      };
      return updated;
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setCustomer(null);
  }, []);

  const getCartTotal = useCallback(() => {
    return items.reduce((sum, item) => sum + (item.total || 0), 0);
  }, [items]);

  const getCartCount = useCallback(() => {
    return items.length;
  }, [items]);

  const value = useMemo(() => ({
    items,
    customer,
    setCustomer,
    addItem,
    removeItem,
    updateItemQty,
    clearCart,
    getCartTotal,
    getCartCount,
  }), [items, customer, addItem, removeItem, updateItemQty, clearCart, getCartTotal, getCartCount]);

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}
