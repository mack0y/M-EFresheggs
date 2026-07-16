import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  Clock,
  BarChart3,
  PieChart as PieChartIcon,
  Calendar,
  DollarSign,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { fetchSalesBySize, fetchSalesByHour, fetchSalesTrend, fetchProfitMargins, formatPeso, EGG_SIZES, getLocalDate, fetchProductSalesBySize, fetchProductSalesByHour, fetchProductSalesTrend } from '../lib/api';
import { formatDateShort } from '../lib/formatters';
import { getUserFriendlyError } from '../lib/errors';

const COLORS = [
  '#8B4513', '#A0522D', '#D4A574', '#F5DEB3',
  '#CD853F', '#DEB887', '#8B7355',
];

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip">
        <p className="chart-tooltip-label">{label}</p>
        {payload.map((entry, i) => {
          let val;
          if (entry.name?.includes('Revenue') || entry.dataKey === 'revenue') {
            val = formatPeso(entry.value);
          } else if (entry.dataKey === 'products') {
            val = `${entry.value.toLocaleString()} units`;
          } else {
            val = `${entry.value.toLocaleString()} eggs`;
          }
          return (
            <p key={i} style={{ color: entry.color, fontWeight: 600 }}>
              {entry.name}: {val}
            </p>
          );
        })}
      </div>
    );
  }
  return null;
}

export default function Analytics() {
  const [bySize, setBySize] = useState([]);
  const [byHour, setByHour] = useState([]);
  const [trend, setTrend] = useState([]);
  const [revenueBySize, setRevenueBySize] = useState([]);
  const [margins, setMargins] = useState([]);
  const [loadingMargins, setLoadingMargins] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(30);
  const [chartTab, setChartTab] = useState('size');
  const [category, setCategory] = useState('both');

  // Product analytics state
  const [prodBySize, setProdBySize] = useState([]);
  const [prodByHour, setProdByHour] = useState([]);
  const [prodTrend, setProdTrend] = useState([]);



  function formatHour(h) {
    if (h === 12) return '12 PM';
    if (h === 0) return '12 AM';
    if (h < 12) return `${h} AM`;
    return `${h - 12} PM`;
  }

  async function loadAnalytics() {
    try {
      setLoading(true);
      setError(null);
      const endDate = getLocalDate();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const startDateStr = getLocalDate(startDate);
      const [sizeData, hourData, trendData, prodSizeData, prodHourData, prodTrendData] = await Promise.all([
        fetchSalesBySize(startDateStr, endDate),
        fetchSalesByHour(startDateStr, endDate),
        fetchSalesTrend(days),
        fetchProductSalesBySize(startDateStr, endDate),
        fetchProductSalesByHour(startDateStr, endDate),
        fetchProductSalesTrend(days),
      ]);

      // Process sales by size
      const sizeMap = {};
      (sizeData || []).forEach(sale => {
        const name = sale.egg_sizes?.name || 'Unknown';
        if (!sizeMap[name]) sizeMap[name] = 0;
        if (sale.unit === 'tray') {
          sizeMap[name] += sale.quantity * (sale.tray_size || 30);
        } else {
          sizeMap[name] += sale.quantity;
        }
      });

      const sortedBySize = EGG_SIZES.map(name => ({
        name,
        eggs: sizeMap[name] || 0,
      }));

      setBySize(sortedBySize);

      // Process revenue by size
      const revenueMap = {};
      (sizeData || []).forEach(sale => {
        const name = sale.egg_sizes?.name || 'Unknown';
        if (!revenueMap[name]) revenueMap[name] = 0;
        revenueMap[name] += parseFloat(sale.total_amount || 0);
      });

      const sortedRevenue = EGG_SIZES.map(name => ({
        name,
        revenue: revenueMap[name] || 0,
      }));

      setRevenueBySize(sortedRevenue);

      // Process sales by hour
      const hourMap = {};
      for (let h = 5; h <= 20; h++) {
        hourMap[h] = 0;
      }
      (hourData || []).forEach(sale => {
        const hour = parseInt(sale.sale_time?.split(':')[0] || '0', 10);
        if (hourMap[hour] !== undefined) {
          let count = sale.quantity;
          if (sale.unit === 'tray') count *= sale.tray_size || 30;
          hourMap[hour] += count;
        }
      });

      const sortedByHour = Object.entries(hourMap)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([hour, eggs]) => ({
          hour: `${hour}:00`,
          eggs,
          label: formatHour(parseInt(hour)),
        }));

      setByHour(sortedByHour);

      // Process sales trend
      const dailyMap = {};
      (trendData || []).forEach(sale => {
        if (!dailyMap[sale.sale_date]) dailyMap[sale.sale_date] = { eggs: 0, revenue: 0 };
        let count = sale.quantity;
        if (sale.unit === 'tray') count *= sale.tray_size || 30;
        dailyMap[sale.sale_date].eggs += count;
        dailyMap[sale.sale_date].revenue += parseFloat(sale.total_amount || 0);
      });

      const sortedTrend = Object.entries(dailyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, { eggs, revenue }]) => ({
          date: formatDateShort(date),
          eggs,
          revenue: Math.round(revenue * 100) / 100,
        }));

      setTrend(sortedTrend);

      // Process product sales by size (by product name)
      const prodSizeMap = {};
      (prodSizeData || []).forEach(sale => {
        const name = sale.products?.name || 'Unknown';
        if (!prodSizeMap[name]) prodSizeMap[name] = { quantity: 0, revenue: 0 };
        prodSizeMap[name].quantity += parseFloat(sale.quantity || 0);
        prodSizeMap[name].revenue += parseFloat(sale.total_amount || 0);
      });
      const sortedProdBySize = Object.entries(prodSizeMap)
        .sort(([, a], [, b]) => b.quantity - a.quantity)
        .map(([name, data]) => ({ name, ...data }));
      setProdBySize(sortedProdBySize);

      // Process product sales by hour
      const prodHourMap = {};
      for (let h = 5; h <= 20; h++) prodHourMap[h] = 0;
      (prodHourData || []).forEach(sale => {
        const hour = parseInt(sale.sale_time?.split(':')[0] || '0', 10);
        if (prodHourMap[hour] !== undefined) {
          prodHourMap[hour] += parseFloat(sale.quantity || 0);
        }
      });
      const sortedProdByHour = Object.entries(prodHourMap)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([hour, qty]) => ({
          hour: `${hour}:00`,
          eggs: qty,
          label: formatHour(parseInt(hour)),
        }));
      setProdByHour(sortedProdByHour);

      // Process product sales trend
      const prodDailyMap = {};
      (prodTrendData || []).forEach(sale => {
        if (!prodDailyMap[sale.sale_date]) prodDailyMap[sale.sale_date] = 0;
        prodDailyMap[sale.sale_date] += parseFloat(sale.quantity || 0);
      });
      const sortedProdTrend = Object.entries(prodDailyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, qty]) => ({
          date: formatDateShort(date),
          eggs: qty,
        }));
      setProdTrend(sortedProdTrend);

    } catch (err) {
      console.error('Analytics load error:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadMargins() {
    try {
      setLoadingMargins(true);
      const data = await fetchProfitMargins();
      setMargins(data || []);
    } catch (err) {
      console.error('Margins load error:', err);
    } finally {
      setLoadingMargins(false);
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => loadAnalytics());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  useEffect(() => {
    Promise.resolve().then(() => loadMargins());
  }, []);

  const totalEggsSold = bySize.reduce((sum, s) => sum + s.eggs, 0);
  const totalRevenue = revenueBySize.reduce((sum, s) => sum + s.revenue, 0);
  const totalProdQty = prodBySize.reduce((sum, s) => sum + s.quantity, 0);
  const totalProdRevenue = prodBySize.reduce((sum, s) => sum + s.revenue, 0);
  const bestSize = bySize.reduce(
    (best, curr) => (curr.eggs > (best?.eggs || 0) ? curr : best),
    null
  );
  const peakHour = byHour.reduce(
    (best, curr) => (curr.eggs > (best?.eggs || 0) ? curr : best),
    null
  );
  const bestProduct = prodBySize.length > 0 ? prodBySize[0] : null;

  return (
    <div className="fade-in">
      <div className="page-header-row">
        <div>
          <h1>Analytics</h1>
          <p className="page-subtitle">Sales trends and insights</p>
        </div>
        <div className="days-selector">
          <Calendar size={16} />
          <select
            id="analytics-days"
            name="days"
            className="select"
            style={{ width: 'auto', padding: '0.375rem 0.75rem' }}
            value={days}
            onChange={e => setDays(parseInt(e.target.value))}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Category Filter */}
      <div className="analytics-category-filter">
        {[
          { key: 'eggs', label: 'Eggs Only' },
          { key: 'products', label: 'Products Only' },
          { key: 'both', label: 'Both' },
        ].map(v => (
          <button key={v.key} className={`analytics-cat-btn ${category === v.key ? 'active' : ''}`} onClick={() => setCategory(v.key)}>{v.label}</button>
        ))}
      </div>

      {error && !loading && (
        <div className="error-banner" style={{ marginBottom: '1rem' }}>
          <AlertTriangle size={20} />
          <div className="error-banner-content">
            <strong>Failed to load analytics</strong>
            <p>{getUserFriendlyError(error)}</p>
          </div>
          <button className="btn btn-sm btn-secondary" onClick={loadAnalytics}>
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      )}

      {/* Summary stats */}
      <div className="analytics-stats">
        {(category === 'eggs' || category === 'both') && (
          <>
            <div className="analytics-stat-card">
              <DollarSign size={20} />
              <div>
                <span className="analytics-stat-value">{formatPeso(totalRevenue)}</span>
                <span className="analytics-stat-label">egg revenue</span>
              </div>
            </div>
            <div className="analytics-stat-card">
              <TrendingUp size={20} />
              <div>
                <span className="analytics-stat-value">{totalEggsSold.toLocaleString()}</span>
                <span className="analytics-stat-label">eggs sold</span>
              </div>
            </div>
            {bestSize && (
              <div className="analytics-stat-card">
                <BarChart3 size={20} />
                <div>
                  <span className="analytics-stat-value">{bestSize.name}</span>
                  <span className="analytics-stat-label">best egg size</span>
                </div>
              </div>
            )}
          </>
        )}
        {(category === 'products' || category === 'both') && (
          <>
            <div className="analytics-stat-card">
              <DollarSign size={20} />
              <div>
                <span className="analytics-stat-value">{formatPeso(totalProdRevenue)}</span>
                <span className="analytics-stat-label">product revenue</span>
              </div>
            </div>
            <div className="analytics-stat-card">
              <TrendingUp size={20} />
              <div>
                <span className="analytics-stat-value">{totalProdQty.toLocaleString()}</span>
                <span className="analytics-stat-label">products sold</span>
              </div>
            </div>
            {bestProduct && (
              <div className="analytics-stat-card">
                <BarChart3 size={20} />
                <div>
                  <span className="analytics-stat-value">{bestProduct.name}</span>
                  <span className="analytics-stat-label">top product</span>
                </div>
              </div>
            )}
          </>
        )}
        {category === 'both' && (
          <div className="analytics-stat-card">
            <DollarSign size={20} />
            <div>
              <span className="analytics-stat-value">{formatPeso(totalRevenue + totalProdRevenue)}</span>
              <span className="analytics-stat-label">combined revenue</span>
            </div>
          </div>
        )}
        {peakHour && (category === 'eggs' || category === 'both') && (
          <div className="analytics-stat-card">
            <Clock size={20} />
            <div>
              <span className="analytics-stat-value">{peakHour.label}</span>
              <span className="analytics-stat-label">peak selling time</span>
            </div>
          </div>
        )}
      </div>

      {/* Chart tabs */}
      <div className="chart-tabs">
        <button
          className={`chart-tab ${chartTab === 'size' ? 'active' : ''}`}
          onClick={() => setChartTab('size')}
        >
          <BarChart3 size={16} />
          By Size
        </button>
        <button
          className={`chart-tab ${chartTab === 'hour' ? 'active' : ''}`}
          onClick={() => setChartTab('hour')}
        >
          <Clock size={16} />
          By Time
        </button>
        <button
          className={`chart-tab ${chartTab === 'trend' ? 'active' : ''}`}
          onClick={() => setChartTab('trend')}
        >
          <TrendingUp size={16} />
          Trend
        </button>
        <button
          className={`chart-tab ${chartTab === 'pie' ? 'active' : ''}`}
          onClick={() => setChartTab('pie')}
        >
          <PieChartIcon size={16} />
          Distribution
        </button>
        <button
          className={`chart-tab ${chartTab === 'revenue' ? 'active' : ''}`}
          onClick={() => setChartTab('revenue')}
        >
          <DollarSign size={16} />
          Revenue
        </button>
        <button
          className={`chart-tab ${chartTab === 'margins' ? 'active' : ''}`}
          onClick={() => setChartTab('margins')}
        >
          <DollarSign size={16} />
          Margins
        </button>
      </div>

      {/* Charts */}
      {loading ? (
        <div className="card" style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="skeleton" style={{ width: '80%', height: 300 }}>&nbsp;</div>
        </div>
      ) : (
        <div className="card chart-card">
          {chartTab === 'size' && (
            <div>
              {category === 'eggs' && <h3 style={{ marginBottom: '1rem' }}>Sales by Egg Size</h3>}
              {category === 'products' && <h3 style={{ marginBottom: '1rem' }}>Sales by Product</h3>}
              {category === 'both' && <h3 style={{ marginBottom: '1rem' }}>Sales by Item</h3>}
              {(category === 'eggs' || category === 'both') && (
                <ResponsiveContainer width="100%" height={category === 'both' ? 280 : 350}>
                  <BarChart data={bySize} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8DDD0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="eggs" name="Eggs Sold" radius={[4, 4, 0, 0]}>
                      {bySize.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
              {category === 'both' && <div style={{ height: '1rem' }} />}
              {(category === 'products' || category === 'both') && (
                <ResponsiveContainer width="100%" height={category === 'both' ? 280 : 350}>
                  <BarChart data={prodBySize} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8DDD0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value) => `${value} units`} />
                    <Bar dataKey="quantity" name="Products Sold" radius={[4, 4, 0, 0]} fill="#2E7D32">
                      {prodBySize.map((_, i) => (
                        <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

          {chartTab === 'hour' && (
            <div>
              {category === 'eggs' && <h3 style={{ marginBottom: '1rem' }}>Sales by Time of Day</h3>}
              {category === 'products' && <h3 style={{ marginBottom: '1rem' }}>Product Sales by Time of Day</h3>}
              {category === 'both' && <h3 style={{ marginBottom: '1rem' }}>Sales by Time of Day</h3>}
              {(category === 'eggs' || category === 'both') && (
                <ResponsiveContainer width="100%" height={category === 'both' ? 280 : 350}>
                  <BarChart data={byHour} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8DDD0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="eggs" name="Eggs Sold" radius={[4, 4, 0, 0]} fill="#D4A574" />
                  </BarChart>
                </ResponsiveContainer>
              )}
              {category === 'both' && <div style={{ height: '1rem' }} />}
              {(category === 'products' || category === 'both') && (
                <ResponsiveContainer width="100%" height={category === 'both' ? 280 : 350}>
                  <BarChart data={prodByHour} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8DDD0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value) => `${value} units`} />
                    <Bar dataKey="eggs" name="Products Sold" radius={[4, 4, 0, 0]} fill="#2E7D32" />
                  </BarChart>
                </ResponsiveContainer>
              )}
              <p className="chart-hint">
                Shows what times of day most items are sold. Peak hours help you plan staffing and restocking.
              </p>
            </div>
          )}

          {chartTab === 'trend' && (
            <div>
              {category === 'eggs' && <h3 style={{ marginBottom: '1rem' }}>Sales Trend (Last {days} Days)</h3>}
              {category === 'products' && <h3 style={{ marginBottom: '1rem' }}>Product Sales Trend (Last {days} Days)</h3>}
              {category === 'both' && <h3 style={{ marginBottom: '1rem' }}>Combined Sales Trend (Last {days} Days)</h3>}
              {category === 'both' ? (
                (trend.length > 0 || prodTrend.length > 0) ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={trend.length > 0 ? trend.map(t => ({ ...t, eggs: t.eggs || 0, revenue: t.revenue || 0, products: prodTrend.find(p => p.date === t.date)?.eggs || 0 })) : prodTrend.map(p => ({ ...p, eggs: 0, products: p.eggs || 0 }))} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E8DDD0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="eggs" name="Eggs" stroke="#8B4513" strokeWidth={2} dot={{ fill: '#8B4513', r: 3 }} activeDot={{ r: 6 }} yAxisId="left" />
                      <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#D4A574" strokeWidth={2} dot={{ fill: '#D4A574', r: 3 }} activeDot={{ r: 6 }} yAxisId="right" />
                      <Line type="monotone" dataKey="products" name="Products" stroke="#2E7D32" strokeWidth={2} dot={{ fill: '#2E7D32', r: 3 }} activeDot={{ r: 6 }} yAxisId="left" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="empty-state" style={{ height: 300 }}>
                    <p>Not enough data to show trends yet</p>
                  </div>
                )
              ) : category === 'eggs' ? (
                trend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={trend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E8DDD0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="eggs" name="Eggs Sold" stroke="#8B4513" strokeWidth={2} dot={{ fill: '#8B4513', r: 3 }} activeDot={{ r: 6 }} yAxisId="left" />
                      <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#2E7D32" strokeWidth={2} dot={{ fill: '#2E7D32', r: 3 }} activeDot={{ r: 6 }} yAxisId="right" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="empty-state" style={{ height: 300 }}>
                    <p>Not enough data to show trends yet</p>
                  </div>
                )
              ) : (
                prodTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={prodTrend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E8DDD0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value) => `${value} units`} />
                      <Line type="monotone" dataKey="eggs" name="Products Sold" stroke="#2E7D32" strokeWidth={2} dot={{ fill: '#2E7D32', r: 3 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="empty-state" style={{ height: 300 }}>
                    <p>Not enough data to show trends yet</p>
                  </div>
                )
              )}
            </div>
          )}

          {chartTab === 'revenue' && (
            <div>
              {category === 'eggs' && <h3 style={{ marginBottom: '1rem' }}>Revenue by Egg Size</h3>}
              {category === 'products' && <h3 style={{ marginBottom: '1rem' }}>Revenue by Product</h3>}
              {category === 'both' && <h3 style={{ marginBottom: '1rem' }}>Revenue by Item</h3>}
              {(category === 'eggs' || category === 'both') && (
                revenueBySize.some(r => r.revenue > 0) ? (
                  <ResponsiveContainer width="100%" height={category === 'both' ? 280 : 350}>
                    <BarChart data={revenueBySize} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E8DDD0" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip formatType="peso" />} />
                      <Bar dataKey="revenue" name="Egg Revenue" radius={[4, 4, 0, 0]}>
                        {revenueBySize.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="empty-state" style={{ height: 300 }}>
                    <p>No egg revenue data yet. Set prices and record sales to see revenue breakdown.</p>
                  </div>
                )
              )}
              {category === 'both' && <div style={{ height: '1rem' }} />}
              {(category === 'products' || category === 'both') && (
                prodBySize.some(s => s.revenue > 0) ? (
                  <ResponsiveContainer width="100%" height={category === 'both' ? 280 : 350}>
                    <BarChart data={prodBySize} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E8DDD0" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value) => formatPeso(value)} />
                      <Bar dataKey="revenue" name="Product Revenue" radius={[4, 4, 0, 0]} fill="#2E7D32">
                        {prodBySize.map((_, i) => (
                          <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="empty-state" style={{ height: 300 }}>
                    <p>No product revenue data yet.</p>
                  </div>
                )
              )}
            </div>
          )}

          {chartTab === 'pie' && (
            <div>
              {category === 'eggs' && <h3 style={{ marginBottom: '1rem' }}>Sales Distribution</h3>}
              {category === 'products' && <h3 style={{ marginBottom: '1rem' }}>Product Sales Distribution</h3>}
              {category === 'both' && <h3 style={{ marginBottom: '1rem' }}>Combined Sales Distribution</h3>}
              {(category === 'eggs' || category === 'both') && (
                <ResponsiveContainer width="100%" height={category === 'both' ? 300 : 380}>
                  <PieChart>
                    <Pie
                      data={bySize.filter(d => d.eggs > 0)}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius="70%"
                      innerRadius="35%"
                      dataKey="eggs"
                    >
                      {bySize.filter(d => d.eggs > 0).map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              {category === 'both' && <div style={{ height: '1rem' }} />}
              {(category === 'products' || category === 'both') && (
                <ResponsiveContainer width="100%" height={category === 'both' ? 300 : 380}>
                  <PieChart>
                    <Pie
                      data={prodBySize.filter(d => d.quantity > 0)}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius="70%"
                      innerRadius="35%"
                      dataKey="quantity"
                    >
                      {prodBySize.filter(d => d.quantity > 0).map((_, i) => (
                        <Cell key={i} fill={COLORS[(i + 3) % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value} units`} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

          {chartTab === 'margins' && (
            <div>
              <h3 style={{ marginBottom: '1rem' }}>Profit Margins by Egg Size</h3>
              {loadingMargins ? (
                <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="skeleton" style={{ width: '80%', height: 250 }}>&nbsp;</div>
                </div>
              ) : margins.length === 0 ? (
                <div className="empty-state" style={{ height: 300 }}>
                  <p>Record deliveries and set prices to see profit margins</p>
                </div>
              ) : (
                <>
                  {/* Margin summary cards */}
                  <div className="margin-summary">
                    {margins.filter(m => m.pricePerPiece > 0).map(m => (
                      <div key={m.name} className="margin-card">
                        <div className="margin-card-header">
                          <span className="margin-card-size">{m.name}</span>
                          <span className="margin-card-pct" style={{ color: m.marginPercent >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                            {m.marginPercent > 0 ? '+' : ''}{m.marginPercent}%
                          </span>
                        </div>
                        <div className="margin-card-body">
                          <div className="margin-card-row">
                            <span className="margin-card-label">Selling</span>
                            <span className="margin-card-value">{formatPeso(m.pricePerPiece)}/ea</span>
                          </div>
                          <div className="margin-card-row">
                            <span className="margin-card-label">Cost</span>
                            <span className="margin-card-value margin-card-cost">{formatPeso(m.avgCostPerEgg)}/ea</span>
                          </div>
                          <div className="margin-card-row margin-card-profit">
                            <span className="margin-card-label">Profit</span>
                            <span className="margin-card-value" style={{ color: m.profitPerEgg >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                              {formatPeso(m.profitPerEgg)}/ea
                            </span>
                          </div>
                        </div>
                        <div className="margin-card-footer">
                          <span>{m.totalDelivered.toLocaleString()} eggs delivered ({m.deliveryCount} deliveries)</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Margin bar chart */}
                  {margins.some(m => m.pricePerPiece > 0) && (
                    <div style={{ marginTop: '1.25rem' }}>
                      <h4 style={{ marginBottom: '0.75rem', fontSize: '0.9375rem', color: 'var(--color-text-secondary)' }}>Cost vs Selling Price Comparison</h4>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={margins.filter(m => m.pricePerPiece > 0)} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E8DDD0" />
                          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip
                            formatter={(value) => formatPeso(value)}
                            labelStyle={{ fontWeight: 600 }}
                          />
                          <Bar dataKey="avgCostPerEgg" name="Avg Cost/Egg" fill="#C62828" radius={[4, 4, 0, 0]} opacity={0.8} />
                          <Bar dataKey="pricePerPiece" name="Selling Price/Egg" fill="#2E7D32" radius={[4, 4, 0, 0]} opacity={0.8} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  <p className="chart-hint">
                    Cost per egg is based on your most recent delivery for each size. Compare against your selling price to see profit margins per egg.
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <style>{`
        .analytics-category-filter {
          display: flex;
          gap: 0.375rem;
          margin-bottom: 1.25rem;
        }
        .analytics-cat-btn {
          padding: 0.5rem 1rem;
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-sm);
          background: var(--color-card);
          color: var(--color-text-secondary);
          font-size: 0.8125rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        .analytics-cat-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
        .analytics-cat-btn.active { background: var(--color-primary); border-color: var(--color-primary); color: white; }
        .days-selector {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--color-text-secondary);
        }

        .analytics-stats {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.75rem;
          margin-bottom: 1.25rem;
        }

        @media (min-width: 640px) {
          .analytics-stats {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        .analytics-stat-card {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          background: var(--color-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-sm);
        }

        .analytics-stat-card svg {
          color: var(--color-primary);
          flex-shrink: 0;
        }

        .analytics-stat-value {
          display: block;
          font-weight: 700;
          font-size: 1.0625rem;
        }

        .analytics-stat-label {
          display: block;
          font-size: 0.75rem;
          color: var(--color-text-muted);
        }

        .chart-tabs {
          display: flex;
          gap: 0.375rem;
          margin-bottom: 1rem;
          flex-wrap: wrap;
        }

        .chart-tab {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.5rem 1rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          background: var(--color-card);
          color: var(--color-text-secondary);
          font-size: 0.8125rem;
          font-weight: 500;
          transition: all 0.2s;
          cursor: pointer;
        }

        .chart-tab:hover {
          border-color: var(--color-primary);
          color: var(--color-primary);
        }

        .chart-tab.active {
          background: var(--color-primary);
          border-color: var(--color-primary);
          color: white;
        }

        .chart-card {
          padding: 1.25rem;
          overflow: hidden;
        }

        .chart-hint {
          font-size: 0.8125rem;
          color: var(--color-text-muted);
          margin-top: 0.75rem;
          text-align: center;
        }

        .chart-tooltip {
          background: var(--color-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          padding: 0.625rem 0.875rem;
          box-shadow: var(--shadow-md);
        }

        .chart-tooltip-label {
          font-size: 0.8125rem;
          color: var(--color-text-muted);
          margin-bottom: 0.25rem;
        }

        .margin-summary {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.75rem;
          margin-bottom: 1.25rem;
        }

        @media (min-width: 640px) {
          .margin-summary {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (min-width: 900px) {
          .margin-summary {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        .margin-card {
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          overflow: hidden;
          background: var(--color-card);
          box-shadow: var(--shadow-sm);
        }

        .margin-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          background: var(--color-bg);
          border-bottom: 1px solid var(--color-border);
        }

        .margin-card-size {
          font-weight: 700;
          font-size: 0.9375rem;
        }

        .margin-card-pct {
          font-weight: 800;
          font-size: 1.0625rem;
        }

        .margin-card-body {
          padding: 0.75rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.375rem;
        }

        .margin-card-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.8125rem;
        }

        .margin-card-label {
          color: var(--color-text-muted);
        }

        .margin-card-value {
          font-weight: 600;
          font-variant-numeric: tabular-nums;
        }

        .margin-card-cost {
          color: var(--color-danger);
        }

        .margin-card-profit {
          padding-top: 0.375rem;
          border-top: 1px dashed var(--color-border);
          margin-top: 0.25rem;
        }

        .margin-card-footer {
          padding: 0.5rem 1rem;
          background: var(--color-bg);
          border-top: 1px solid var(--color-border);
          font-size: 0.6875rem;
          color: var(--color-text-muted);
          text-align: center;
        }
      `}</style>
    </div>
  );
}
