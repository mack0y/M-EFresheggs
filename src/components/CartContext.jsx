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

  let cartIdCounter = 0;

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
      cartIdCounter += 1;
      return [...prev, { ...newItem, cartId: cartIdCounter }];
    });
  }, []);

  const removeItem = useCallback((cartId) => {
    setItems(prev => prev.filter(i => i.cartId !== cartId));
  }, []);

  const updateItemQty = useCallback((cartId, quantity) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i.cartId === cartId);
      if (idx < 0) return prev;
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        quantity,
        total: quantity * updated[idx].pricePerUnit,
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
