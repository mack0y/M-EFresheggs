import { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { fetchCostsPerEgg, fetchPriceSettings, fetchSalesReport, fetchExpenses, formatPeso, EGG_SIZES, TRAY_SIZE, getLocalDate } from '../lib/api';
import { getUserFriendlyError } from '../lib/errors';

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
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
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
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
  const [priceSettings, setPriceSettings] = useState([]);

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

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const [priceData, costData, salesData, expensesData] = await Promise.all([
        fetchPriceSettings(),
        fetchCostsPerEgg(),
        fetchSalesReport({ startDate, endDate, startTime: '00:00', endTime: '23:59' }),
        fetchExpenses({ startDate, endDate }),
      ]);

      setPriceSettings(priceData || []);
      setCostsPerEgg(costData || {});
      setSales(salesData || []);
      setExpenses(expensesData || []);
    } catch (err) {
      console.error('Profits page load error:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

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
        return { name, totalEggs: r.totalEggs, revenue: r.revenue, trays: Math.floor(r.totalEggs / TRAY_SIZE), pieces: r.totalEggs % TRAY_SIZE, salesCount: r.salesCount, costPerEgg, costPerTray, sellPerPiece, sellPerTray, profitPerEgg, profitPerTray, marginPercent, cogs };
      })
      .filter(Boolean);

    const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
    const totalCOGS = rows.reduce((s, r) => s + r.cogs, 0);
    const totalExpensesAmount = expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const grossProfit = Math.round((totalRevenue - totalCOGS) * 100) / 100;
    const netProfit = Math.round((totalRevenue - totalExpensesAmount - totalCOGS) * 100) / 100;
    const totalEggs = rows.reduce((s, r) => s + r.totalEggs, 0);

    return { rows, totalRevenue, totalCOGS, totalExpenses: totalExpensesAmount, grossProfit, netProfit, salesCount: sales.length, totalEggs };
  })();

  return (
    <div className="fade-in">
      <div className="page-header-row" style={{ marginBottom: '0.75rem' }}>
        <h1 style={{ fontSize: '1.25rem' }}>Profit Overview</h1>
        <button className="btn btn-secondary btn-sm" onClick={loadData} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
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

      {/* Period selector */}
      <div className="card" style={{ padding: '0.625rem', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.5rem' }}>
          {PERIODS.map(p => (
            <button
              key={p.key}
              className={`btn ${period === p.key ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => changePeriod(p.key)}
              style={{ padding: '0.3rem 0.625rem', fontSize: '0.7rem' }}
            >
              {p.label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
            <input type="date" className="input" style={{ flex: 1, fontSize: '0.7rem', padding: '0.25rem 0.375rem' }} value={customStart} onChange={e => setCustomStart(e.target.value)} />
            <span style={{ color: 'var(--color-text-muted)' }}>—</span>
            <input type="date" className="input" style={{ flex: 1, fontSize: '0.7rem', padding: '0.25rem 0.375rem' }} value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
            <button className="btn btn-primary btn-sm" onClick={applyCustom} style={{ padding: '0.3rem 0.5rem', fontSize: '0.7rem' }}>Go</button>
          </div>
        )}
        <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
          <Calendar size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.2rem' }} />
          {startDate} — {endDate}
        </div>
      </div>

      {/* Summary */}
      <div className="profit-m-summary">
        <div className="profit-m-card">
          <div className="profit-m-label">Revenue</div>
          <div className="profit-m-value" style={{ color: 'var(--color-primary)' }}>{loading ? '—' : formatPeso(profitData.totalRevenue)}</div>
        </div>
        <div className="profit-m-card">
          <div className="profit-m-label">COGS</div>
          <div className="profit-m-value" style={{ color: '#E65100' }}>{loading ? '—' : formatPeso(profitData.totalCOGS)}</div>
        </div>
        <div className="profit-m-card">
          <div className="profit-m-label">Expenses</div>
          <div className="profit-m-value" style={{ color: '#C62828' }}>{loading ? '—' : formatPeso(profitData.totalExpenses)}</div>
        </div>
        <div className="profit-m-card">
          <div className="profit-m-label">Gross Profit</div>
          <div className="profit-m-value" style={{ color: profitData.grossProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {loading ? '—' : formatPeso(profitData.grossProfit)}
          </div>
        </div>
        <div className="profit-m-card profit-m-card-net">
          <div className="profit-m-label" style={{ fontWeight: 700 }}>Net Profit</div>
          <div className="profit-m-value" style={{
            fontSize: '1.25rem',
            color: profitData.netProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
          }}>
            {loading ? '—' : formatPeso(profitData.netProfit)}
          </div>
        </div>
        <div className="profit-m-card">
          <div className="profit-m-label">Eggs Sold</div>
          <div className="profit-m-value">{loading ? '—' : profitData.totalEggs.toLocaleString()}</div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="card" style={{ padding: '0.75rem' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 28, marginBottom: '0.25rem', borderRadius: 4 }}>&nbsp;</div>
          ))}
        </div>
      ) : profitData.rows.length === 0 ? (
        <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <TrendingUp size={28} style={{ color: 'var(--color-text-muted)', marginBottom: '0.5rem' }} />
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>No sales data for this period.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="profit-table" style={{ fontSize: '0.75rem' }}>
              <thead>
                <tr>
                  <th>Size</th>
                  <th className="num">Sold</th>
                  <th className="num">Revenue</th>
                  <th className="num">Cost/T</th>
                  <th className="num">Sell/T</th>
                  <th className="num">Profit/T</th>
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
                    <td className="num">{row.sellPerTray > 0 ? formatPeso(row.sellPerTray) : '—'}</td>
                    <td className="num" style={{ color: row.profitPerTray >= 0 ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 600 }}>
                      {row.sellPerTray > 0 ? formatPeso(row.profitPerTray) : '—'}
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
                  <td colSpan={2}></td>
                  <td className="num" style={{ fontWeight: 800, color: profitData.grossProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>{formatPeso(profitData.grossProfit)}</td>
                  <td className="num" style={{ color: 'var(--color-text-muted)' }}>{profitData.totalRevenue > 0 ? `${Math.round((profitData.grossProfit / profitData.totalRevenue) * 1000) / 10}%` : '—'}</td>
                  <td className="num" style={{ color: 'var(--color-danger)' }}>{formatPeso(profitData.totalCOGS)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <style>{`
        .profit-m-summary {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 0.375rem;
          margin-bottom: 0.75rem;
        }

        .profit-m-card {
          background: var(--color-card);
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-sm);
          padding: 0.5rem 0.625rem;
          text-align: center;
        }

        .profit-m-label {
          font-size: 0.6rem;
          font-weight: 600;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 0.125rem;
        }

        .profit-m-value {
          font-size: 0.9375rem;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }

        .profit-m-card-net {
          grid-column: 1 / -1;
          padding: 0.625rem;
        }

        .profit-table {
          width: 100%;
          border-collapse: collapse;
        }

        .profit-table th {
          text-align: left;
          padding: 0.5rem 0.5rem;
          font-size: 0.625rem;
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
          padding: 0.5rem;
          border-bottom: 1px solid var(--color-border);
        }

        .profit-table .size-cell {
          font-weight: 600;
        }

        .profit-table .total-row td {
          font-weight: 700;
          border-top: 2px solid var(--color-primary);
          background: var(--color-primary-light);
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
