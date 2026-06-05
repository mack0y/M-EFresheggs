import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  ShoppingCart,
  AlertTriangle,
  ArrowRight,
  DollarSign,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Clock,
  Truck,
} from 'lucide-react';
import { fetchInventory, fetchTodaySales, fetchTodayExpenses, fetchInventoryValue, fetchDeliveries, getEggCount, formatInventory, formatPeso, getLocalDate } from '../lib/api';
import { getUserFriendlyError } from '../lib/errors';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getGreetingEmoji() {
  const hour = new Date().getHours();
  if (hour < 12) return '🌅';
  if (hour < 17) return '☀️';
  return '🌙';
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [inventory, setInventory] = useState([]);
  const [todaySales, setTodaySales] = useState([]);
  const [todayExpenses, setTodayExpenses] = useState([]);
  const [inventoryValue, setInventoryValue] = useState(0);
  const [todayDeliveries, setTodayDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const today = getLocalDate();
      const [inv, sales, expenses, invValue, deliveries] = await Promise.all([
        fetchInventory(),
        fetchTodaySales(),
        fetchTodayExpenses(),
        fetchInventoryValue(),
        fetchDeliveries({ startDate: today, endDate: today }),
      ]);
      setInventory(inv || []);
      setTodaySales(sales || []);
      setTodayExpenses(expenses || []);
      setInventoryValue(invValue);
      setTodayDeliveries(deliveries || []);
    } catch (err) {
      console.error('Dashboard load error:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => loadData());
  }, []);

  const todayDeliveryCount = todayDeliveries.length;
  const todayDeliveryCost = todayDeliveries.reduce((sum, d) => sum + parseFloat(d.total_cost || 0), 0);
  const totalEggsSoldToday = todaySales.reduce((sum, s) => sum + getEggCount(s), 0);
  const todayRevenue = todaySales.reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0);
  const todayExpenseTotal = todayExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
  const netProfit = todayRevenue - todayExpenseTotal;
  const totalStock = inventory.reduce((sum, item) => sum + (item.quantity_on_hand || 0), 0);
  const lowStockItems = inventory.filter(item => item.quantity_on_hand <= 50 && item.quantity_on_hand > 0);
  const outOfStockItems = inventory.filter(item => item.quantity_on_hand === 0);

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="fade-in">
      {/* Welcome */}
      <div className="welcome-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', marginBottom: '0.125rem' }}>{getGreeting()} {getGreetingEmoji()}</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>{dateStr}</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadData}>
          <RefreshCw size={14} />
        </button>
      </div>

      {error && (
        <div className="error-banner" style={{ marginBottom: '0.75rem' }}>
          <AlertTriangle size={18} />
          <div className="error-banner-content">
            <strong>Failed to load</strong>
            <p>{getUserFriendlyError(error)}</p>
          </div>
          <button className="btn btn-sm btn-secondary" onClick={loadData}>Retry</button>
        </div>
      )}

      {/* Primary Stats */}
      <div className="mb-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <div className="primary-stat" style={{ background: 'var(--color-card)', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-md)', padding: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: 'var(--color-success-bg)', color: 'var(--color-success)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <DollarSign size={18} />
          </div>
          <div>
            <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>Revenue</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {loading ? <span className="skeleton" style={{ display: 'inline-block', width: 70, height: 24 }}>&nbsp;</span> : formatPeso(todayRevenue)}
            </span>
          </div>
        </div>
        <div className="primary-stat" style={{ background: 'var(--color-card)', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-md)', padding: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-sm)', background: netProfit >= 0 ? 'var(--color-success-bg)' : 'var(--color-danger-bg)', color: netProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {netProfit >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
          </div>
          <div>
            <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>Net Profit</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: netProfit < 0 ? 'var(--color-danger)' : undefined }}>
              {loading ? <span className="skeleton" style={{ display: 'inline-block', width: 70, height: 24 }}>&nbsp;</span> : formatPeso(netProfit)}
            </span>
          </div>
        </div>
      </div>

      {/* Secondary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.375rem', marginBottom: '0.75rem' }}>
        {[
          { icon: Package, bg: '#E3F2FD', color: '#1565C0', value: totalStock.toLocaleString(), label: 'Stock' },
          { icon: ShoppingCart, bg: '#F3E5F5', color: '#7B1FA2', value: totalEggsSoldToday.toLocaleString(), label: 'Sold' },
          { icon: TrendingDown, bg: todayExpenseTotal > 0 ? '#FFEBEE' : '#E8F5E9', color: todayExpenseTotal > 0 ? '#C62828' : '#2E7D32', value: formatPeso(todayExpenseTotal), label: 'Costs' },
          { icon: Truck, bg: '#E0F2F1', color: '#00695C', value: todayDeliveryCount.toString(), label: 'Deliveries' },
          { icon: Truck, bg: '#FFF3E0', color: '#E65100', value: formatPeso(todayDeliveryCost), label: 'Del. Cost' },
          { icon: DollarSign, bg: '#E8F5E9', color: '#2E7D32', value: formatPeso(inventoryValue), label: 'Value' },
        ].map((stat, i) => (
          <div key={i} style={{ background: 'var(--color-card)', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-sm)', padding: '0.625rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
              {loading ? <span className="skeleton" style={{ display: 'inline-block', width: 40, height: 20 }}>&nbsp;</span> : stat.value}
            </div>
            <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Low Stock Alert */}
      {(lowStockItems.length > 0 || outOfStockItems.length > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.75rem', background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning)', borderRadius: 'var(--radius-md)', marginBottom: '0.75rem' }}>
          <AlertTriangle size={16} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--color-warning)' }}>
              {outOfStockItems.length > 0
                ? `${outOfStockItems.length} size${outOfStockItems.length > 1 ? 's' : ''} out of stock`
                : `${lowStockItems.length} size${lowStockItems.length > 1 ? 's' : ''} running low`}
            </div>
          </div>
          <button className="btn btn-sm btn-secondary" onClick={() => navigate('/inventory')}>Fix</button>
        </div>
      )}

      {/* Stock Levels + Today's Sales */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Stock Levels */}
        <div className="card" style={{ padding: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h3>Stock Levels</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/inventory')}>View</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {loading ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 24, borderRadius: 4 }}>&nbsp;</div>
            )) : inventory.slice(0, 7).map((item, i) => {
              const qty = item.quantity_on_hand || 0;
              let cls = 'badge-success';
              let lbl = 'In Stock';
              if (qty === 0) { cls = 'badge-danger'; lbl = 'Out'; }
              else if (qty <= 50) { cls = 'badge-warning'; lbl = 'Low'; }
              return (
                <div key={item.id || i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.375rem 0.5rem', borderRadius: 'var(--radius-xs)', background: 'var(--color-bg-subtle)' }}>
                  <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>{item.egg_sizes?.name || `Size ${i+1}`}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatInventory(qty)}</span>
                    <span className={`badge ${cls}`}>{lbl}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Today's Sales */}
        <div className="card" style={{ padding: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h3>Today's Sales</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/sales')}>View</button>
          </div>
          {loading ? Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 24, marginBottom: '0.25rem', borderRadius: 4 }}>&nbsp;</div>
          )) : todaySales.length === 0 ? (
            <div className="empty-state" style={{ padding: '1rem' }}>
              <ShoppingCart size={24} />
              <p style={{ fontSize: '0.8125rem' }}>No sales today</p>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/sales')}>Record Sale</button>
            </div>
          ) : (
            todaySales.slice(0, 5).map((sale, i) => (
              <div key={sale.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.375rem 0.5rem', borderRadius: 'var(--radius-xs)', background: 'var(--color-bg-subtle)', marginBottom: '0.25rem' }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{sale.egg_sizes?.name || 'Unknown'}</div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>
                    {sale.quantity} {sale.unit === 'tray' ? `tray${sale.quantity > 1 ? 's' : ''}` : `egg${sale.quantity > 1 ? 's' : ''}`}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-success)', fontVariantNumeric: 'tabular-nums' }}>{formatPeso(sale.total_amount)}</div>
                  <div style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '0.15rem', justifyContent: 'flex-end' }}>
                    <Clock size={10} />{sale.sale_time?.slice(0, 5)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Today's Deliveries */}
        <div className="card" style={{ padding: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h3>Today's Deliveries</h3>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/deliveries')}>View</button>
          </div>
          {loading ? Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 24, marginBottom: '0.25rem', borderRadius: 4 }}>&nbsp;</div>
          )) : todayDeliveries.length === 0 ? (
            <div className="empty-state" style={{ padding: '1rem' }}>
              <Truck size={24} />
              <p style={{ fontSize: '0.8125rem' }}>No deliveries today</p>
            </div>
          ) : (
            todayDeliveries.slice(0, 5).map((d, i) => (
              <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.375rem 0.5rem', borderRadius: 'var(--radius-xs)', background: 'var(--color-bg-subtle)', marginBottom: '0.25rem' }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{d.egg_sizes?.name || 'Unknown'}</div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>{d.suppliers?.name} · {d.quantity} trays</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums' }}>{formatPeso(d.total_cost)}</div>
                  <span style={{ display: 'inline-block', padding: '0.1rem 0.35rem', borderRadius: 999, fontSize: '0.6rem', fontWeight: 600,
                    background: d.payment_status === 'paid' ? '#E8F5E9' : d.payment_status === 'partial' ? '#FFF8E1' : '#FFF3E0',
                    color: d.payment_status === 'paid' ? '#2E7D32' : d.payment_status === 'partial' ? '#F57F17' : '#E65100',
                  }}>{d.payment_status}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
