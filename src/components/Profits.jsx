import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  RefreshCw,
  AlertTriangle,
  ShoppingCart,
  Egg,
  ChevronDown,
} from 'lucide-react';
import { fetchCostsPerEgg, fetchCostsPerProduct, fetchPriceSettings, fetchSalesReport, fetchExpenses, formatPeso, EGG_SIZES, TRAY_SIZE, getLocalDate, fetchProductSales } from '../lib/api';
import { getUserFriendlyError } from '../lib/errors';

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'custom', label: 'Custom' },
];

function getPeriodRange(period) {
  const now = new Date();
  const end = getLocalDate(now);

  if (period === 'today') {
    return { startDate: end, endDate: end };
  }

  if (period === 'week') {
    const d = new Date(now);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    d.setDate(diff);
    return { startDate: getLocalDate(d), endDate: end };
  }

  if (period === 'month') {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startDate: getLocalDate(d), endDate: end };
  }

  return { startDate: end, endDate: end };
}

export default function Profits() {
  const [period, setPeriod] = useState('today');
  const [startDate, setStartDate] = useState(getPeriodRange('today').startDate);
  const [endDate, setEndDate] = useState(getPeriodRange('today').endDate);
  const [customStart, setCustomStart] = useState(getPeriodRange('today').startDate);
  const [customEnd, setCustomEnd] = useState(getPeriodRange('today').endDate);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [costsPerEgg, setCostsPerEgg] = useState({});
  const [costsPerProduct, setCostsPerProduct] = useState({});
  const [priceSettings, setPriceSettings] = useState([]);
  const [expandedSize, setExpandedSize] = useState(null);
  const [viewFilter, setViewFilter] = useState('all'); // 'all' | 'eggs' | 'products'
  const [productSales, setProductSales] = useState([]);

  function changePeriod(key) {
    setPeriod(key);
    if (key !== 'custom') {
      const range = getPeriodRange(key);
      setStartDate(range.startDate);
      setEndDate(range.endDate);
    } else {
      setStartDate(customStart);
      setEndDate(customEnd);
    }
  }

  function applyCustom() {
    setStartDate(customStart);
    setEndDate(customEnd);
    setPeriod('custom');
  }

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [priceData, costData, productCostData, salesData, expensesData, prodSalesData] = await Promise.all([
        fetchPriceSettings(),
        fetchCostsPerEgg(),
        fetchCostsPerProduct(),
        fetchSalesReport({ startDate, endDate, startTime: '00:00', endTime: '23:59' }),
        fetchExpenses({ startDate, endDate }),
        fetchProductSales({ startDate, endDate }),
      ]);

      setPriceSettings(priceData || []);
      setCostsPerEgg(costData || {});
      setCostsPerProduct(productCostData || {});
      setSales(salesData || []);
      setExpenses(expensesData || []);
      setProductSales(prodSalesData || []);
    } catch (err) {
      console.error('Profits page load error:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    const id = setTimeout(() => loadData(), 0);
    return () => clearTimeout(id);
  }, [loadData]);

  // Process profit data
  const profitData = (() => {
    const sizeMap = {};
    EGG_SIZES.forEach(name => {
      sizeMap[name] = { totalEggs: 0, revenue: 0, salesCount: 0 };
    });

    sales.forEach(sale => {
      const name = sale.egg_sizes?.name || 'Unknown';
      if (!sizeMap[name]) sizeMap[name] = { totalEggs: 0, revenue: 0, salesCount: 0 };
      sizeMap[name].salesCount++;
      if (sale.unit === 'tray') {
        sizeMap[name].totalEggs += sale.quantity * (sale.tray_size || TRAY_SIZE);
      } else {
        sizeMap[name].totalEggs += sale.quantity;
      }
      sizeMap[name].revenue += parseFloat(sale.total_amount || 0);
    });

    const rows = EGG_SIZES
      .map(name => {
        const r = sizeMap[name];
        if (r.totalEggs === 0 && r.revenue === 0) return null;
        const price = (priceSettings || []).find(p => p.egg_sizes?.name === name);
        const sizeId = price?.egg_size_id;
        const cost = sizeId ? (costsPerEgg || {})[sizeId] : null;
        const costPerEgg = cost?.avgCostPerEgg || 0;
        const costPerTray = cost?.avgCostPerTray || 0;
        const sellPerPiece = parseFloat(price?.price_per_piece || 0);
        const sellPerTray = parseFloat(price?.price_per_tray || 0);
        const profitPerEgg = Math.round((sellPerPiece - costPerEgg) * 100) / 100;
        const profitPerTray = Math.round((sellPerTray - costPerTray) * 100) / 100;
        const marginPercent = sellPerPiece > 0 ? Math.round((profitPerEgg / sellPerPiece) * 1000) / 10 : 0;
        const cogs = Math.round(costPerEgg * r.totalEggs * 100) / 100;
        const revenue = r.revenue;

        return {
          name,
          totalEggs: r.totalEggs,
          revenue,
          trays: Math.floor(r.totalEggs / TRAY_SIZE),
          pieces: r.totalEggs % TRAY_SIZE,
          salesCount: r.salesCount,
          costPerEgg,
          costPerTray,
          sellPerPiece,
          sellPerTray,
          profitPerEgg,
          profitPerTray,
          marginPercent,
          cogs,
        };
      })
      .filter(Boolean);

    // Include product sales in revenue and COGS
    const productRevenue = productSales.reduce((s, ps) => s + parseFloat(ps.total_amount || 0), 0);
    const productCOGS = productSales.reduce((s, ps) => {
      const costPerUnit = costsPerProduct[ps.product_id] || 0;
      return s + costPerUnit * parseFloat(ps.quantity || 0);
    }, 0);

    const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0) + productRevenue;
    const totalCOGS = rows.reduce((s, r) => s + r.cogs, 0) + productCOGS;
    const totalExpensesAmount = expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const grossProfit = Math.round((totalRevenue - totalCOGS) * 100) / 100;
    const revenueCut = Math.round(totalRevenue * 0.01 * 100) / 100;
    const adjustedRevenue = Math.round((totalRevenue - revenueCut) * 100) / 100;
    // Net profit = adjusted revenue minus COGS
    // (expenses are paid from operational funds, funded by the 1% cut)
    const netProfit = Math.round((adjustedRevenue - totalCOGS) * 100) / 100;
    const totalEggs = rows.reduce((s, r) => s + r.totalEggs, 0);

    return { rows, totalRevenue, totalCOGS, totalExpenses: totalExpensesAmount, grossProfit, revenueCut, adjustedRevenue, netProfit, salesCount: sales.length, totalEggs, productRevenue, productCOGS };
  })();

  return (
    <div className="profits-page fade-in">
      {/* Header */}
      <div className="page-header-row">
        <div>
          <h1>Profit Overview</h1>
          <p className="page-subtitle">Real-time profit & margins per egg size</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadData} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="error-banner" style={{ marginBottom: '1rem' }}>
          <AlertTriangle size={20} />
          <div className="error-banner-content">
            <strong>Failed to load profit data</strong>
            <p>{getUserFriendlyError(error)}</p>
          </div>
          <button className="btn btn-sm btn-secondary" onClick={loadData}>Retry</button>
        </div>
      )}

      {/* Period Selector */}
      <div className="pr-period-bar">
        <div className="pr-period-btns">
          {PERIODS.map(p => (
            <button key={p.key}
              className={`pr-period-btn ${period === p.key ? 'active' : ''}`}
              onClick={() => changePeriod(p.key)}>
              {p.label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="pr-custom-inputs">
            <input type="date" className="pr-date-input" value={customStart} onChange={e => setCustomStart(e.target.value)} />
            <span className="pr-date-sep">—</span>
            <input type="date" className="pr-date-input" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
            <button className="btn btn-primary btn-sm" onClick={applyCustom}>Go</button>
          </div>
        )}
        <div className="pr-period-range">
          <Calendar size={12} /> {startDate} — {endDate}
        </div>
      </div>

      {/* View Filter */}
      <div className="pr-view-filter">
        {[
          { key: 'all', label: 'All' },
          { key: 'eggs', label: 'Eggs Only' },
          { key: 'products', label: 'Products Only' },
        ].map(v => (
          <button key={v.key} className={`pr-view-btn ${viewFilter === v.key ? 'active' : ''}`} onClick={() => setViewFilter(v.key)}>{v.label}</button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="profit-summary-grid">
        <div className="profit-summary-card profit-card-revenue">
          <div className="profit-card-icon-wrap" style={{ background: '#E3F2FD', color: '#1565C0' }}>
            <DollarSign size={20} />
          </div>
          <div className="profit-card-info">
            <span className="profit-card-label">Adjusted Revenue</span>
            <span className="profit-card-value">{loading ? '—' : formatPeso(profitData.adjustedRevenue)}</span>
            {profitData.revenueCut > 0 && !loading && (
              <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>After 1% cut ({formatPeso(profitData.revenueCut)})</span>
            )}
          </div>
        </div>
        <div className="profit-summary-card profit-card-cogs">
          <div className="profit-card-icon-wrap" style={{ background: '#FFF3E0', color: '#E65100' }}>
            <ShoppingCart size={20} />
          </div>
          <div className="profit-card-info">
            <span className="profit-card-label">COGS</span>
            <span className="profit-card-value">{loading ? '—' : formatPeso(profitData.totalCOGS)}</span>
          </div>
        </div>
        <div className="profit-summary-card profit-card-expenses">
          <div className="profit-card-icon-wrap" style={{ background: '#FFEBEE', color: '#C62828' }}>
            <TrendingDown size={20} />
          </div>
          <div className="profit-card-info">
            <span className="profit-card-label">Expenses (OpEx)</span>
            <span className="profit-card-value">{loading ? '—' : formatPeso(profitData.totalExpenses)}</span>
            {!loading && <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>Paid from operational funds</span>}
          </div>
        </div>

        <div className="profit-summary-card profit-card-net">
          <div className="profit-card-icon-wrap" style={{
            background: profitData.netProfit >= 0 ? '#E8F5E9' : '#FFEBEE',
            color: profitData.netProfit >= 0 ? '#2E7D32' : '#C62828',
          }}>
            {profitData.netProfit >= 0 ? <TrendingUp size={22} /> : <TrendingDown size={22} />}
          </div>
          <div className="profit-card-info">
            <span className="profit-card-label" style={{ fontWeight: 700 }}>Net Profit</span>
            <span className="profit-card-value profit-card-net-value" style={{
              color: profitData.netProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
              fontSize: '1.25rem',
            }}>
              {loading ? '—' : formatPeso(profitData.netProfit)}
            </span>
          </div>
        </div>
        <div className="profit-summary-card">
          <div className="profit-card-icon-wrap" style={{ background: '#F3E5F5', color: '#7B1FA2' }}>
            <DollarSign size={20} />
          </div>
          <div className="profit-card-info">
            <span className="profit-card-label">Eggs Sold</span>
            <span className="profit-card-value">{loading ? '—' : profitData.totalEggs.toLocaleString()}</span>
          </div>
        </div>
        <div className="profit-summary-card">
          <div className="profit-card-icon-wrap" style={{ background: '#E0F2F1', color: '#00695C' }}>
            <DollarSign size={20} />
          </div>
          <div className="profit-card-info">
            <span className="profit-card-label">Product Sales</span>
            <span className="profit-card-value">{loading ? '—' : formatPeso(productSales.reduce((s, ps) => s + parseFloat(ps.total_amount || 0), 0))}</span>
            <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>{productSales.length} sale{productSales.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ padding: '1.25rem' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ width: '100%', height: 36, marginBottom: '0.375rem', borderRadius: 'var(--radius-sm)' }}>&nbsp;</div>
          ))}
        </div>
      ) : profitData.rows.length === 0 ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <TrendingUp size={40} style={{ color: 'var(--color-text-muted)', marginBottom: '0.75rem' }} />
          <p style={{ color: 'var(--color-text-muted)' }}>No sales data for this period.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="card profit-desktop-table" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="profit-table">
                <thead>
                  <tr>
                    <th>Egg Size</th>
                    <th className="num">Sold</th>
                    <th className="num">Revenue</th>
                    <th className="num">Cost/Tray</th>
                    <th className="num">Cost/Egg</th>
                    <th className="num">Sell/Tray</th>
                    <th className="num">Sell/Egg</th>
                    <th className="num">Profit/Tray</th>
                    <th className="num">Profit/Egg</th>
                    <th className="num">Margin</th>
                    <th className="num">COGS</th>
                  </tr>
                </thead>
                <tbody>
                  {profitData.rows.map(row => (
                    <tr key={row.name}>
                      <td className="size-cell">{row.name}</td>
                      <td className="num">{row.totalEggs.toLocaleString()}</td>
                      <td className="num" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{formatPeso(row.revenue)}</td>
                      <td className="num">{row.costPerTray > 0 ? formatPeso(row.costPerTray) : '—'}</td>
                      <td className="num">{row.costPerEgg > 0 ? formatPeso(row.costPerEgg) : '—'}</td>
                      <td className="num">{row.sellPerTray > 0 ? formatPeso(row.sellPerTray) : '—'}</td>
                      <td className="num">{row.sellPerPiece > 0 ? formatPeso(row.sellPerPiece) : '—'}</td>
                      <td className="num" style={{ color: row.profitPerTray >= 0 ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 600 }}>
                        {row.sellPerTray > 0 ? formatPeso(row.profitPerTray) : '—'}
                      </td>
                      <td className="num" style={{ color: row.profitPerEgg >= 0 ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 600 }}>
                        {row.sellPerPiece > 0 ? formatPeso(row.profitPerEgg) : '—'}
                      </td>
                      <td className="num" style={{ color: row.marginPercent >= 0 ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 600 }}>
                        {row.sellPerPiece > 0 ? `${row.marginPercent}%` : '—'}
                      </td>
                      <td className="num" style={{ color: 'var(--color-danger)' }}>{row.cogs > 0 ? formatPeso(row.cogs) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="total-row">
                    <td className="size-cell">Total</td>
                    <td className="num">{profitData.totalEggs.toLocaleString()}</td>
                    <td className="num" style={{ color: 'var(--color-primary)', fontWeight: 700 }}>{formatPeso(profitData.totalRevenue)}</td>
                    <td colSpan={4}></td>
                    <td colSpan={2} className="num" style={{ fontWeight: 800, color: profitData.grossProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {formatPeso(profitData.grossProfit)}
                    </td>
                    <td className="num" style={{ color: 'var(--color-text-muted)' }}>
                      {profitData.totalRevenue > 0 ? `${Math.round((profitData.grossProfit / profitData.totalRevenue) * 1000) / 10}%` : '—'}
                    </td>
                    <td className="num" style={{ color: 'var(--color-danger)' }}>{formatPeso(profitData.totalCOGS)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Mobile Expandable Cards */}
          <div className="profit-mobile-cards">
            {profitData.rows.map(row => (
              <div key={row.name} className="pr-mobile-card">
                <div className="pr-mobile-header" onClick={() => setExpandedSize(expandedSize === row.name ? null : row.name)}>
                  <div className="pr-mobile-left">
                    <div className="pr-mobile-icon">
                      <Egg size={16} />
                    </div>
                    <div>
                      <span className="pr-mobile-name">{row.name}</span>
                      <span className="pr-mobile-eggs">
                        {row.trays > 0 ? `${row.trays} tray${row.trays > 1 ? 's' : ''}` : ''}
                        {row.trays > 0 && row.pieces > 0 ? ' + ' : ''}
                        {row.pieces > 0 ? `${row.pieces} pcs` : ''}
                        {row.trays === 0 && row.pieces === 0 ? `${row.totalEggs} eggs` : ''}
                      </span>
                    </div>
                  </div>
                  <div className="pr-mobile-right">
                    <span className="pr-mobile-revenue">{formatPeso(row.revenue)}</span>
                    <ChevronDown size={16} className={`pr-mobile-chevron ${expandedSize === row.name ? 'open' : ''}`} />
                  </div>
                </div>
                {expandedSize === row.name && (
                  <div className="pr-mobile-detail">
                    <div className="pr-mobile-row"><span>Sold</span><span className="num">{row.totalEggs.toLocaleString()} eggs</span></div>
                    <div className="pr-mobile-row"><span>Revenue</span><span className="num" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{formatPeso(row.revenue)}</span></div>
                    <div className="pr-mobile-row"><span>Cost/Tray</span><span className="num">{row.costPerTray > 0 ? formatPeso(row.costPerTray) : '—'}</span></div>
                    <div className="pr-mobile-row"><span>Cost/Egg</span><span className="num">{row.costPerEgg > 0 ? formatPeso(row.costPerEgg) : '—'}</span></div>
                    <div className="pr-mobile-row"><span>Sell/Tray</span><span className="num">{row.sellPerTray > 0 ? formatPeso(row.sellPerTray) : '—'}</span></div>
                    <div className="pr-mobile-row"><span>Sell/Egg</span><span className="num">{row.sellPerPiece > 0 ? formatPeso(row.sellPerPiece) : '—'}</span></div>
                    <div className="pr-mobile-row"><span>Profit/Tray</span><span className="num" style={{ color: row.profitPerTray >= 0 ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 600 }}>{row.sellPerTray > 0 ? formatPeso(row.profitPerTray) : '—'}</span></div>
                    <div className="pr-mobile-row"><span>Profit/Egg</span><span className="num" style={{ color: row.profitPerEgg >= 0 ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 600 }}>{row.sellPerPiece > 0 ? formatPeso(row.profitPerEgg) : '—'}</span></div>
                    <div className="pr-mobile-row"><span>Margin</span><span className={`pr-margin-badge-sm ${row.marginPercent >= 0 ? 'pos' : 'neg'}`}>{row.sellPerPiece > 0 ? `${row.marginPercent}%` : '—'}</span></div>
                    <div className="pr-mobile-row"><span>COGS</span><span className="num" style={{ color: '#C62828' }}>{row.cogs > 0 ? formatPeso(row.cogs) : '—'}</span></div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Net Profit Summary Strip */}
          <div className="card profit-net-strip-wrap">
            <div className="profit-net-strip">
              <div className="profit-net-item">
                <span>Gross Revenue</span>
                <span className="profit-net-amount" style={{ color: 'var(--color-primary)' }}>{formatPeso(profitData.totalRevenue)}</span>
              </div>
              <div className="profit-net-op"><TrendingDown size={14} /></div>
              <div className="profit-net-item">
                <span>1% Cut</span>
                <span className="profit-net-amount" style={{ color: '#F57F17' }}>{formatPeso(profitData.revenueCut)}</span>
              </div>
              <div className="profit-net-op"><TrendingDown size={14} /></div>
              <div className="profit-net-item">
                <span>Adjusted Revenue</span>
                <span className="profit-net-amount" style={{ color: 'var(--color-success)', fontWeight: 700 }}>{formatPeso(profitData.adjustedRevenue)}</span>
              </div>
              <div className="profit-net-op"><TrendingDown size={14} /></div>
              <div className="profit-net-item">
                <span>Expenses</span>
                <span className="profit-net-amount" style={{ color: 'var(--color-danger)' }}>{formatPeso(profitData.totalExpenses)}</span>
              </div>
              <div className="profit-net-op"><TrendingDown size={14} /></div>
              <div className="profit-net-item">
                <span>COGS</span>
                <span className="profit-net-amount" style={{ color: '#E65100' }}>{formatPeso(profitData.totalCOGS)}</span>
              </div>
              <div className="profit-net-op profit-net-op-eq"><span>=</span></div>
              <div className={`profit-net-item profit-net-final ${profitData.netProfit >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                <span style={{ fontWeight: 800 }}>Net Profit</span>
                <span className="profit-net-amount" style={{ fontWeight: 800, fontSize: '1.125rem' }}>{formatPeso(profitData.netProfit)}</span>
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        .profits-page {
          max-width: 100%;
        }

        .pr-period-bar { display: flex; flex-direction: column; gap: 0.5rem; padding: 0.875rem 1rem; background: var(--color-card); border: 1px solid var(--color-border-light); border-radius: var(--radius-md); margin-bottom: 1rem; box-shadow: var(--shadow-xs); }
        .pr-period-btns { display: flex; gap: 0.25rem; flex-wrap: wrap; }
        .pr-period-btn { min-height: 40px; padding: 0.4rem 1rem; border: 1.5px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-card); color: var(--color-text-secondary); font-size: 0.8125rem; font-weight: 500; cursor: pointer; transition: all var(--transition-fast); }
        .pr-period-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
        .pr-period-btn.active { background: var(--color-primary); border-color: var(--color-primary); color: white; }
        .pr-custom-inputs { display: flex; align-items: center; gap: 0.375rem; }
        .pr-date-input { flex: 1; max-width: 160px; padding: 0.35rem 0.5rem; border: 1.5px solid var(--color-border); border-radius: var(--radius-sm); font-size: 0.75rem; color: var(--color-text); background: var(--color-card); outline: none; }
        .pr-date-input:focus { border-color: var(--color-primary); }
        .pr-date-sep { color: var(--color-text-muted); font-size: 0.8125rem; }
        .pr-period-range { font-size: 0.75rem; color: var(--color-text-muted); display: flex; align-items: center; gap: 0.25rem; }

        .profit-summary-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.625rem;
          margin-bottom: 1rem;
        }

        .profit-summary-card {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.875rem 1rem;
          background: var(--color-card);
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-xs);
          transition: all var(--transition-base);
        }

        .profit-summary-card:hover {
          box-shadow: var(--shadow-sm);
          transform: translateY(-1px);
        }

        .profit-card-icon-wrap {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .profit-card-info {
          display: flex;
          flex-direction: column;
          gap: 0.0625rem;
          min-width: 0;
        }

        .profit-card-label {
          font-size: 0.6875rem;
          font-weight: var(--font-weight-medium);
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .profit-card-value {
          font-size: 1.0625rem;
          font-weight: var(--font-weight-bold);
          line-height: 1.2;
          font-variant-numeric: tabular-nums;
        }

        .profit-card-net {
          grid-column: span 2;
        }

        .profit-card-net .profit-card-icon-wrap {
          width: 48px;
          height: 48px;
        }

        .profit-card-net-value {
          font-size: 1.25rem !important;
        }

        /* Table */
        .profit-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
        }

        .profit-table th {
          text-align: left;
          padding: 0.75rem;
          font-size: 0.6875rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-muted);
          background: var(--color-bg);
          border-bottom: 2px solid var(--color-border);
          white-space: nowrap;
        }

        .profit-table th.num,
        .profit-table td.num {
          text-align: right;
          white-space: nowrap;
          font-variant-numeric: tabular-nums;
        }

        .profit-table td {
          padding: 0.625rem 0.75rem;
          border-bottom: 1px solid var(--color-border);
        }

        .profit-table tbody tr {
          transition: background var(--transition-fast);
        }

        .profit-table tbody tr:hover {
          background: var(--color-primary-50);
        }

        .profit-table .size-cell {
          font-weight: 600;
        }

        .profit-table .total-row td {
          font-weight: 700;
          border-top: 2px solid var(--color-primary);
          border-bottom: none;
          background: var(--color-primary-light);
        }

        .profit-table .total-row .size-cell {
          font-weight: 800;
        }

        /* Net Profit Strip */
        .profit-net-strip {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.875rem 1rem;
          background: var(--color-card);
          border-top: 1px solid var(--color-border);
          flex-wrap: wrap;
        }

        .profit-net-item {
          display: flex;
          flex-direction: column;
          gap: 0.0625rem;
          font-size: 0.75rem;
          color: var(--color-text-secondary);
          min-width: 0;
        }

        .profit-net-amount {
          font-size: 1rem;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }

        .profit-net-op {
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-text-muted);
          font-size: 0.875rem;
          flex-shrink: 0;
        }

        .profit-net-op-eq {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: var(--color-primary);
          color: white;
          font-weight: 700;
          font-size: 0.875rem;
        }

        .profit-net-final {
          padding: 0.375rem 0.75rem;
          border-radius: var(--radius-sm);
        }

        .profit-net-final.profit-positive {
          background: var(--color-success-bg);
        }

        .profit-net-final.profit-negative {
          background: var(--color-danger-bg);
        }

        /* Responsive */
        @media (max-width: 768px) {
          .profit-summary-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .profit-card-net {
            grid-column: 1 / -1;
          }

          .profit-net-strip {
            gap: 0.375rem;
          }

          .profit-net-item {
            font-size: 0.6875rem;
          }

          .profit-net-amount {
            font-size: 0.8125rem;
          }
        }

        @media (max-width: 480px) {
          .profit-summary-grid {
            grid-template-columns: 1fr 1fr;
            gap: 0.375rem;
          }

          .profit-summary-card {
            padding: 0.625rem 0.75rem;
          }

          .profit-card-icon-wrap {
            width: 32px;
            height: 32px;
          }

          .profit-card-value {
            font-size: 0.875rem;
          }
        }

        /* Mobile expandable cards */
        .profit-mobile-cards { display: none; }

        .pr-mobile-card { border: 1px solid var(--color-border-light); border-radius: var(--radius-md); background: var(--color-card); overflow: hidden; margin-bottom: 0.375rem; box-shadow: var(--shadow-xs); }
        .pr-mobile-header { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; cursor: pointer; user-select: none; transition: background var(--transition-fast); }
        .pr-mobile-header:hover { background: var(--color-bg); }
        .pr-mobile-left { display: flex; align-items: center; gap: 0.625rem; min-width: 0; flex: 1; }
        .pr-mobile-icon { width: 32px; height: 32px; border-radius: var(--radius-sm); background: var(--color-primary-light); color: var(--color-primary); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .pr-mobile-name { font-weight: 600; font-size: 0.875rem; display: block; }
        .pr-mobile-eggs { font-size: 0.6875rem; color: var(--color-text-muted); display: block; }
        .pr-mobile-right { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
        .pr-mobile-revenue { font-weight: 700; font-size: 0.875rem; color: var(--color-primary); font-variant-numeric: tabular-nums; }
        .pr-mobile-chevron { color: var(--color-text-muted); transition: transform var(--transition-fast); }
        .pr-mobile-chevron.open { transform: rotate(180deg); }
        .pr-mobile-detail { border-top: 1px solid var(--color-border-light); padding: 0.5rem 0.75rem; }
        .pr-mobile-row { display: flex; justify-content: space-between; align-items: center; padding: 0.25rem 0; font-size: 0.75rem; }
        .pr-mobile-row span:first-child { color: var(--color-text-secondary); }
        .pr-mobile-row span.num { font-weight: 600; font-variant-numeric: tabular-nums; }
        .pr-mobile-divider { height: 1px; background: var(--color-border-light); margin: 0.25rem 0; }
        .pr-margin-badge-sm { display: inline-block; padding: 0.1rem 0.4rem; border-radius: var(--radius-full); font-size: 0.6875rem; font-weight: 700; }
        .pr-margin-badge-sm.pos { background: var(--color-success-bg); color: var(--color-success); }
        .pr-margin-badge-sm.neg { background: var(--color-danger-bg); color: var(--color-danger); }

        .profit-net-strip-wrap { margin-top: 0.75rem; }

        .pr-view-filter { display: flex; gap: 0.375rem; margin-bottom: 1rem; }
        .pr-view-btn { min-height: 36px; padding: 0.375rem 1rem; border: 1.5px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-card); color: var(--color-text-secondary); font-size: 0.8125rem; font-weight: 500; cursor: pointer; transition: all var(--transition-fast); }
        .pr-view-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
        .pr-view-btn.active { background: var(--color-primary); border-color: var(--color-primary); color: white; }

        @media (max-width: 768px) {
          .profit-desktop-table { display: none; }
          .profit-mobile-cards { display: block; }
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
