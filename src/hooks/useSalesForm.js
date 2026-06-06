import { useState, useCallback } from 'react';
import { recordSale } from '../lib/api';
import { calculateSaleTotal, validateStock, QUICK_QTY_CHIPS } from '../lib/salesUtils';
import { toast } from '../components/Toast';

const INITIAL_FORM = {
  eggSizeId: '',
  quantity: '',
  unit: 'piece',
  traySize: 30,
};

export function useSalesForm({ inventory, priceSettings, onSuccess, onError }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [confirmData, setConfirmData] = useState(null);

  const totalAmount = calculateSaleTotal(
    form.quantity,
    form.unit,
    form.traySize,
    priceSettings,
    form.eggSizeId
  );

  const quickChips = QUICK_QTY_CHIPS[form.unit] || QUICK_QTY_CHIPS.piece;

  const handleChange = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const addQuickQty = useCallback((delta) => {
    const current = parseInt(form.quantity, 10) || 0;
    setForm(prev => ({ ...prev, quantity: String(current + delta) }));
  }, [form.quantity]);

  const validateAndConfirm = useCallback(() => {
    if (!form.eggSizeId || !form.quantity) {
      toast('Please fill in all fields', 'error');
      return false;
    }
    const qty = parseInt(form.quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      toast('Please enter a valid quantity', 'error');
      return false;
    }

    const validation = validateStock(inventory, form.eggSizeId, form.quantity, form.unit, form.traySize);
    if (!validation.valid) {
      toast(validation.message, 'error');
      return false;
    }

    setConfirmData({
      eggSizeId: parseInt(form.eggSizeId, 10),
      quantity: qty,
      unit: form.unit,
      traySize: form.unit === 'tray' ? parseInt(form.traySize, 10) : null,
    });
    return true;
  }, [form, inventory, toast]);

  const executeSale = useCallback(async (saleData) => {
    setSubmitting(true);
    try {
      await recordSale(saleData);
      toast('Sale recorded successfully!');
      setForm(INITIAL_FORM);
      onSuccess?.();
    } catch (err) {
      console.error('Sale record error:', err);
      toast('Failed to record sale', 'error');
      onError?.(err);
    } finally {
      setSubmitting(false);
      setConfirmData(null);
    }
  }, [onSuccess, onError, toast]);

  const resetForm = useCallback(() => {
    setForm(INITIAL_FORM);
    setConfirmData(null);
  }, []);

  return {
    form,
    totalAmount,
    quickChips,
    submitting,
    confirmData,
    setConfirmData,
    handleChange,
    addQuickQty,
    validateAndConfirm,
    executeSale,
    resetForm,
  };
}