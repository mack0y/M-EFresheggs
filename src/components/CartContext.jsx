import { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';

const CartContext = createContext(null);
const CART_STORAGE_KEY = 'mefresh_cart';
const CART_CUSTOMER_KEY = 'mefresh_cart_customer';

/* eslint-disable react-refresh/only-export-components */

function loadPersistedItems() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore localStorage read errors
  }
  return [];
}

function loadPersistedCustomer() {
  try {
    const raw = localStorage.getItem(CART_CUSTOMER_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore localStorage read errors
  }
  return null;
}

function getInitialCounter() {
  const items = loadPersistedItems();
  return items.reduce((max, i) => Math.max(max, i.cartId || 0), 0);
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(loadPersistedItems);
  const [customer, setCustomer] = useState(loadPersistedCustomer);
  const cartIdCounter = useRef(getInitialCounter());

  // Persist items to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore localStorage write errors
    }
  }, [items]);

  // Persist customer to localStorage whenever it changes
  useEffect(() => {
    try {
      if (customer) {
        localStorage.setItem(CART_CUSTOMER_KEY, JSON.stringify(customer));
      } else {
        localStorage.removeItem(CART_CUSTOMER_KEY);
      }
    } catch {
      // Ignore localStorage write errors
    }
  }, [customer]);

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
      cartIdCounter.current += 1;
      return [...prev, { ...newItem, cartId: cartIdCounter.current }];
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
    try {
      localStorage.removeItem(CART_STORAGE_KEY);
      localStorage.removeItem(CART_CUSTOMER_KEY);
    } catch {
      // Ignore localStorage errors
    }
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
