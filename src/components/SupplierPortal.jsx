import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Package, Coins, Receipt, CheckCircle, AlertTriangle, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { formatPeso } from '../lib/api';

// PIN gate — simple shared passcode per supplier (user-chosen access model).
// Not cryptographically secure (client-side), acceptable for this use case.
const SUPPLIER_PINS = {
  10: '1029', // Remar Baguio
};

const REFRESH_MS = 15000;

export default function SupplierPortal() {
  const { supplierId } = useParams();
  const sid = parseInt(supplierId, 10);
  const [unlocked, setUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  const [supplier, setSupplier] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stock, setStock] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [sales, setSales] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const pageSize = 1000;

      // supplier
      const { data: sup, error: supErr } = await supabase
        .from('suppliers').select('*').eq('id', sid).single();
      if (supErr) throw supErr;
      setSupplier(sup);

      // his products (stock)
      const { data: prods, error: pErr } = await supabase
        .from('products').select('id, name, category, unit, quantity_on_hand, price, cost')
        .in('id', [306, 307, 313]); // Remar-supplied product ids
      if (pErr) throw pErr;
      setStock(prods || []);

      // his product deliveries (paid/unpaid)
      let allDel = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('product_deliveries')
          .select('id, product_id, products(name), purchase_quantity, cost_per_purchase_unit, total_cost, amount_paid, payment_status, delivery_date, notes')
          .eq('supplier_id', sid)
          .order('delivery_date', { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allDel = allDel.concat(data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      setDeliveries(allDel);

      // real-time product sales for his products
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const { data: ps, error: psErr } = await supabase
        .from('product_sales')
        .select('id, product_id, products(name), quantity, total_amount, sale_date, sale_time, created_at')
        .in('product_id', [306, 307, 313])
        .gte('sale_date', since)
        .order('created_at', { ascending: false })
        .limit(50);
      if (psErr) throw psErr;
      setSales(ps || []);

      setLastUpdated(new Date());
    } catch (err) {
      console.error('Portal load error:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [sid]);

  useEffect(() => {
    if (!unlocked) return;
    setLoading(true);
    loadData();
    const t = setInterval(loadData, REFRESH_MS);
    return () => clearInterval(t);
  }, [unlocked, loadData]);

  const tryUnlock = (e) => {
    e.preventDefault();
    const expected = SUPPLIER_PINS[sid];
    if (pinInput === expected) {
      setUnlocked(true);
      setPinError(false);
    } else {
      setPinError(true);
    }
  };

  if (!unlocked) {
    return (
      <div className="fade-in" style={{ maxWidth: 420, margin: '4rem auto', padding: '2rem' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <h1 style={{ marginBottom: '0.5rem' }}>Supplier Portal</h1>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
            Enter your passcode to view your supply dashboard.
          </p>
          <form onSubmit={tryUnlock}>
            <input
              type="password"
              inputMode="numeric"
              className="input"
              placeholder="Passcode"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              autoFocus
              style={{ textAlign: 'center', letterSpacing: '0.3em', marginBottom: '1rem' }}
            />
            {pinError && (
              <p style={{ color: 'var(--color-danger)', marginBottom: '1rem' }}>Incorrect passcode.</p>
            )}
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Enter
            </button>
          </form>
        </div>
      </div>
    );
  }

  const totalStockUnits = stock.reduce((s, p) => s + (parseFloat(p.quantity_on_hand) || 0), 0);
  const totalStockValue = stock.reduce((s, p) => s + (parseFloat(p.quantity_on_hand) || 0) * (parseFloat(p.price) || 0), 0);
  const totalDelivered = deliveries.reduce((s, d) => s + (parseFloat(d.total_cost) || 0), 0);
  const totalPaid = deliveries.reduce((s, d) => s + (parseFloat(d.amount_paid) || 0), 0);
  const balance = totalDelivered - totalPaid;
  const totalSales = sales.reduce((s, x) => s + (parseFloat(x.total_amount) || 0), 0);

  return (
    <div className="fade-in">
      <div className="page-header-row">
        <div>
          <h1>{supplier?.name || 'Supplier'} — Portal</h1>
          <p className="page-subtitle">
            Live supply dashboard · refreshes every {REFRESH_MS / 1000}s
            {lastUpdated && ` · updated ${lastUpdated.toLocaleTimeString()}`}
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadData}>Refresh</button>
      </div>

      {error && (
        <div className="error-banner" style={{ marginBottom: '1rem' }}>
          <strong>Failed to load data</strong>
          <p>{String(error?.message || error)}</p>
        </div>
      )}

      <div className="inv-stats" style={{ marginBottom: '1.5rem' }}>
        <div className="inv-stat-card">
          <Package size={18} />
          <div>
            <span className="inv-stat-value">{totalStockUnits.toLocaleString()}</span>
            <span className="inv-stat-label">units in stock</span>
          </div>
        </div>
        <div className="inv-stat-card">
          <Coins size={18} />
          <div>
            <span className="inv-stat-value">{formatPeso(totalStockValue)}</span>
            <span className="inv-stat-label">stock value (retail)</span>
          </div>
        </div>
        <div className="inv-stat-card">
          <Receipt size={18} />
          <div>
            <span className="inv-stat-value">{formatPeso(totalDelivered)}</span>
            <span className="inv-stat-label">total delivered</span>
          </div>
        </div>
        <div className="inv-stat-card">
          <CheckCircle size={18} />
          <div>
            <span className="inv-stat-value">{formatPeso(totalPaid)}</span>
            <span className="inv-stat-label">paid</span>
          </div>
        </div>
        <div className="inv-stat-card">
          <AlertTriangle size={18} />
          <div>
            <span className="inv-stat-value">{formatPeso(balance)}</span>
            <span className="inv-stat-label">balance due</span>
          </div>
        </div>
        <div className="inv-stat-card">
          <TrendingUp size={18} />
          <div>
            <span className="inv-stat-value">{formatPeso(totalSales)}</span>
            <span className="inv-stat-label">sales (7d)</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Current Stock</h3>
        <table className="table" style={{ width: '100%' }}>
          <thead>
            <tr><th>Product</th><th>Category</th><th className="num">On Hand</th><th className="num">Retail ₱</th></tr>
          </thead>
          <tbody>
            {stock.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.category}</td>
                <td className="num">{(parseFloat(p.quantity_on_hand) || 0).toLocaleString()}</td>
                <td className="num">{formatPeso(parseFloat(p.price) || 0)}</td>
              </tr>
            ))}
            {stock.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>No products on file</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Deliveries & Payments</h3>
        <table className="table" style={{ width: '100%' }}>
          <thead>
            <tr><th>Date</th><th>Product</th><th className="num">Qty</th><th className="num">Total</th><th className="num">Paid</th><th>Status</th></tr>
          </thead>
          <tbody>
            {deliveries.map((d) => (
              <tr key={d.id}>
                <td>{d.delivery_date}</td>
                <td>{d.products?.name || '—'}</td>
                <td className="num">{(parseFloat(d.purchase_quantity) || 0).toLocaleString()}</td>
                <td className="num">{formatPeso(parseFloat(d.total_cost) || 0)}</td>
                <td className="num">{formatPeso(parseFloat(d.amount_paid) || 0)}</td>
                <td>
                  <span className={`badge ${(d.payment_status || '').toLowerCase()}`}>{d.payment_status}</span>
                </td>
              </tr>
            ))}
            {deliveries.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>No deliveries recorded</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>Recent Sales (7 days)</h3>
        <table className="table" style={{ width: '100%' }}>
          <thead>
            <tr><th>Date/Time</th><th>Product</th><th className="num">Qty</th><th className="num">Amount</th></tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id}>
                <td>{s.sale_date} {s.sale_time || ''}</td>
                <td>{s.products?.name || '—'}</td>
                <td className="num">{(parseFloat(s.quantity) || 0).toLocaleString()}</td>
                <td className="num">{formatPeso(parseFloat(s.total_amount) || 0)}</td>
              </tr>
            ))}
            {sales.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>No recent sales</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
