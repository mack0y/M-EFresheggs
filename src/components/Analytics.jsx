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
  Legend,
} from 'recharts';
import {
  TrendingUp,
  Clock,
  BarChart3,
  PieChart as PieChartIcon,
  Download,
  Calendar,
} from 'lucide-react';
import { fetchSalesBySize, fetchSalesByHour, fetchSalesTrend, EGG_SIZES } from '../lib/api';
import { toast } from './Toast';
import { fetchInventory } from '../lib/api';

const COLORS = [
  '#8B4513', '#A0522D', '#D4A574', '#F5DEB3',
  '#CD853F', '#DEB887', '#8B7355',
];

export default function Analytics() {
  const [bySize, setBySize] = useState([]);
  const [byHour, setByHour] = useState([]);
  const [trend, setTrend] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [chartTab, setChartTab] = useState('size');

  useEffect(() => {
    loadAnalytics();
  }, [days]);

  async function loadAnalytics() {
    try {
      setLoading(true);
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const [sizeData, hourData, trendData, invData] = await Promise.all([
        fetchSalesBySize(startDate.toISOString().split('T')[0], endDate),
        fetchSalesByHour(),
        fetchSalesTrend(days),
        fetchInventory(),
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
        if (!dailyMap[sale.sale_date]) dailyMap[sale.sale_date] = 0;
        let count = sale.quantity;
        if (sale.unit === 'tray') count *= sale.tray_size || 30;
        dailyMap[sale.sale_date] += count;
      });

      const sortedTrend = Object.entries(dailyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, eggs]) => ({
          date: formatDate(date),
          eggs,
        }));

      setTrend(sortedTrend);
      setInventory(invData || []);
    } catch (err) {
      console.error('Analytics load error:', err);
      toast('Failed to load analytics', 'error');
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function formatHour(h) {
    if (h === 12) return '12 PM';
    if (h === 0) return '12 AM';
    if (h < 12) return `${h} AM`;
    return `${h - 12} PM`;
  }

  const totalEggsSold = bySize.reduce((sum, s) => sum + s.eggs, 0);
  const bestSize = bySize.reduce(
    (best, curr) => (curr.eggs > (best?.eggs || 0) ? curr : best),
    null
  );
  const peakHour = byHour.reduce(
    (best, curr) => (curr.eggs > (best?.eggs || 0) ? curr : best),
    null
  );

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="chart-tooltip">
          <p className="chart-tooltip-label">{label}</p>
          {payload.map((entry, i) => (
            <p key={i} style={{ color: entry.color, fontWeight: 600 }}>
              {entry.name}: {entry.value.toLocaleString()} eggs
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

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

      {/* Summary stats */}
      <div className="analytics-stats">
        <div className="analytics-stat-card">
          <TrendingUp size={20} />
          <div>
            <span className="analytics-stat-value">
              {totalEggsSold.toLocaleString()}
            </span>
            <span className="analytics-stat-label">eggs sold</span>
          </div>
        </div>
        {bestSize && (
          <div className="analytics-stat-card">
            <BarChart3 size={20} />
            <div>
              <span className="analytics-stat-value">{bestSize.name}</span>
              <span className="analytics-stat-label">best-selling size</span>
            </div>
          </div>
        )}
        {peakHour && (
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
              <h3 style={{ marginBottom: '1rem' }}>Sales by Egg Size</h3>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={bySize} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8DDD0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="eggs" name="Sold" radius={[4, 4, 0, 0]}>
                    {bySize.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {chartTab === 'hour' && (
            <div>
              <h3 style={{ marginBottom: '1rem' }}>Sales by Time of Day</h3>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={byHour} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8DDD0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="eggs" name="Sold" radius={[4, 4, 0, 0]} fill="#D4A574" />
                </BarChart>
              </ResponsiveContainer>
              <p className="chart-hint">
                Shows what times of day most eggs are sold. Peak hours help you plan staffing and restocking.
              </p>
            </div>
          )}

          {chartTab === 'trend' && (
            <div>
              <h3 style={{ marginBottom: '1rem' }}>Sales Trend (Last {days} Days)</h3>
              {trend.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={trend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8DDD0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="eggs"
                      name="Eggs Sold"
                      stroke="#8B4513"
                      strokeWidth={2}
                      dot={{ fill: '#8B4513', r: 3 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state" style={{ height: 300 }}>
                  <p>Not enough data to show trends yet</p>
                </div>
              )}
            </div>
          )}

          {chartTab === 'pie' && (
            <div>
              <h3 style={{ marginBottom: '1rem' }}>Sales Distribution</h3>
              <ResponsiveContainer width="100%" height={380}>
                <PieChart>
                  <Pie
                    data={bySize.filter(d => d.eggs > 0)}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, percent }) =>
                      `${name} (${(percent * 100).toFixed(0)}%)`
                    }
                    outerRadius={120}
                    innerRadius={50}
                    dataKey="eggs"
                  >
                    {bySize
                      .filter(d => d.eggs > 0)
                      .map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      <style>{`
        .page-header-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 1.5rem;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .page-subtitle {
          color: var(--color-text-secondary);
          font-size: 0.9375rem;
          margin-top: 0.25rem;
        }

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

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: var(--color-text-muted);
        }
      `}</style>
    </div>
  );
}
