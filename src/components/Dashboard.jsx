import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  Wallet,
  Award,
  BarChart3,
  Plus,
  Egg,
  Calendar,
} from 'lucide-react';
import { fetchInventory, fetchTodayExpenses, fetchExpenses, fetchOperationalFunds, fetchDeliveries, fetchCostsPerEgg, fetchCostsPerProduct, getOperationalBalance, fetchSales, fetchSalesTrend, incrementInventory, getEggCount, formatInventory, formatPeso, getLocalDate, TRAY_SIZE, fetchProducts, fetchProductSales, fetchPriceSettings } from '../lib/api';
import { fetchProductSalesBySize } from '../lib/analytics';
import { PERIODS, getPeriodRange } from '../lib/utils';
import { toast } from '../lib/toastFn';
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
  const [priceSettings, setPriceSettings] = useState([]);
  const [todayDeliveries, setTodayDeliveries] = useState([]);
  const [costsPerEgg, setCostsPerEgg] = useState({});
  const [opexBalance, setOpexBalance] = useState({ totalFunds: 0, totalExpenses: 0, balance: 0 });
  const [yesterdaySales, setYesterdaySales] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [quickAdding, setQuickAdding] = useState(null);
  const [quickAddPopover, setQuickAddPopover] = useState(null);
  const [customTrayInput, setCustomTrayInput] = useState({});
  const [opexWhyOpen, setOpexWhyOpen] = useState(false);
  const [opexRecentExpenses, setOpexRecentExpenses] = useState([]);
  const [opexRecentFunds, setOpexRecentFunds] = useState([]);
  const scrollRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [productCount, setProductCount] = useState(0);
  const [products, setProducts] = useState([]);
  const [todayProductSales, setTodayProductSales] = useState([]);
  const [costsPerProduct, setCostsPerProduct] = useState({});
  const [yesterdayProductSales, setYesterdayProductSales] = useState([]);
  const [productTrendData, setProductTrendData] = useState([]);
  const [prevBaselineEggRevenue, setPrevBaselineEggRevenue] = useState(0);
  const [prevBaselineProductRevenue, setPrevBaselineProductRevenue] = useState(0);
  const [viewFilter, setViewFilter] = useState('all'); // 'all' | 'eggs' | 'products'
  const [period, setPeriod] = useState('today');
  const [startDate, setStartDate] = useState(getPeriodRange('today').startDate);
  const [endDate, setEndDate] = useState(getPeriodRange('today').endDate);
  const [customStart, setCustomStart] = useState(getPeriodRange('today').startDate);
  const [customEnd, setCustomEnd] = useState(getPeriodRange('today').endDate);

  const loadData = useCallback(async (start, end) => {
    try {
      setLoading(true);
      setError(null);
      const s = start || startDate;
      const e = end || endDate;
      const today = getLocalDate();
      const trendStart = new Date();
      trendStart.setDate(trendStart.getDate() - 7);
      const trendStartStr = getLocalDate(trendStart);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = getLocalDate(yesterday);
      // Prior same-length window for period-over-period comparison.
      const cmpStart = new Date(s + 'T00:00:00');
      const cmpEnd = new Date(e + 'T00:00:00');
      const span = Math.max(cmpEnd - cmpStart, 0);
      const prevStart = getLocalDate(new Date(cmpStart.getTime() - span - 86400000));
      const prevEnd = getLocalDate(new Date(cmpStart.getTime() - 86400000));
      const [inv, sales, expenses, prices, deliveries, costs, opex, ySales, trend, prods, prodSales, costsProd, yProdSales, prodTrend, prevEgg, prevProd] = await Promise.all([
        fetchInventory(),
        fetchSales({ startDate: s, endDate: e }),
        fetchTodayExpenses(),
        fetchPriceSettings(),
        fetchDeliveries({ startDate: today, endDate: today }),
        fetchCostsPerEgg(),
        getOperationalBalance(),
        fetchSales({ startDate: yesterdayStr, endDate: yesterdayStr, limit: 500 }),
        fetchSalesTrend(7),
        fetchProducts(),
        fetchProductSales({ startDate: s, endDate: e }),
        fetchCostsPerProduct(),
        fetchProductSales({ startDate: yesterdayStr, endDate: yesterdayStr }),
        fetchProductSalesBySize(trendStartStr, e),
        period === 'today' ? Promise.resolve([]) : fetchSales({ startDate: prevStart, endDate: prevEnd }),
        period === 'today' ? Promise.resolve([]) : fetchProductSales({ startDate: prevStart, endDate: prevEnd }),
      ]);
      setInventory(inv || []);
      setTodaySales(sales || []);
      setTodayExpenses(expenses || []);
      setPriceSettings(prices || []);
      setTodayDeliveries(deliveries || []);
      setCostsPerEgg(costs || {});
      setOpexBalance(opex || { totalFunds: 0, totalExpenses: 0, balance: 0 });
      setYesterdaySales(ySales || []);
      setTrendData(trend || []);
      setProductTrendData(prodTrend || []);
      setPrevBaselineEggRevenue((prevEgg || []).reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0));
      setPrevBaselineProductRevenue((prevProd || []).reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0));
      setProductCount((prods || []).length);
      setProducts(prods || []);
      setTodayProductSales(prodSales || []);
      setCostsPerProduct(costsProd || {});
      setYesterdayProductSales(yProdSales || []);
    } catch (err) {
      console.error('Dashboard load error:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, period]);

  function changePeriod(key) {
    setPeriod(key);
    if (key !== 'custom') {
      const range = getPeriodRange(key);
      setStartDate(range.startDate);
      setEndDate(range.endDate);
      loadData(range.startDate, range.endDate);
    } else {
      setStartDate(customStart);
      setEndDate(customEnd);
      loadData(customStart, customEnd);
    }
  }

  function applyCustom() {
    setStartDate(customStart);
    setEndDate(customEnd);
    setPeriod('custom');
    loadData(customStart, customEnd);
  }

  // Visibility-aware auto-refresh: poll only when tab is visible
  useEffect(() => {
    scrollRef.current = window.scrollY;
    Promise.resolve().then(() => loadData());

    let interval = setInterval(() => {
      scrollRef.current = window.scrollY;
      loadData();
    }, 30000);

    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        scrollRef.current = window.scrollY;
        loadData();
        interval = setInterval(() => {
          scrollRef.current = window.scrollY;
          loadData();
        }, 30000);
      } else {
        clearInterval(interval);
      }
    }

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadData]);

  // Restore scroll position after data refreshes
  useEffect(() => {
    if (!loading && scrollRef.current > 0) {
      requestAnimationFrame(() => window.scrollTo(0, scrollRef.current));
    }
  }, [loading]);

  const todayDeliveryCount = useMemo(() => todayDeliveries.length, [todayDeliveries]);

  const totalEggsSoldToday = useMemo(() =>
    todaySales.reduce((sum, s) => sum + getEggCount(s), 0),
    [todaySales]
  );

  const todayRevenue = useMemo(() =>
    todaySales.reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0),
    [todaySales]
  );

  const todayProductRevenue = useMemo(() =>
    todayProductSales.reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0),
    [todayProductSales]
  );

  const combinedRevenue = todayRevenue + todayProductRevenue;

  // View-aware revenue: which total does the selected view report?
  const viewRevenue = viewFilter === 'eggs'
    ? todayRevenue
    : viewFilter === 'products'
      ? todayProductRevenue
      : combinedRevenue;

  const todayExpenseTotal = useMemo(() =>
    todayExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0),
    [todayExpenses]
  );

  const todayCOGS = useMemo(() =>
    todaySales.reduce((sum, s) => {
      const cost = costsPerEgg[s.egg_size_id];
      const eggCount = getEggCount(s);
      // cost.avgCostPerEgg is now full precision (no 2-decimal rounding)
      return sum + (cost?.avgCostPerEgg || 0) * eggCount;
    }, 0),
    [todaySales, costsPerEgg]
  );

  const todayProductCOGS = useMemo(() =>
    todayProductSales.reduce((sum, s) => {
      const costPerUnit = costsPerProduct[s.product_id] || 0;
      return sum + costPerUnit * parseFloat(s.quantity || 0);
    }, 0),
    [todayProductSales, costsPerProduct]
  );

  const viewCOGS = viewFilter === 'eggs'
    ? todayCOGS
    : viewFilter === 'products'
      ? todayProductCOGS
      : todayCOGS + todayProductCOGS;

  // Cut = 10% of NET INCOME (viewRevenue − viewCOGS − today's expenses).
  // Same rule as Profits and the daily operational-fund cut; nothing is cut
  // on a loss day. Money set aside out of profit, so netProfit = netIncome − cut.
  const viewExpense = viewFilter === 'all' ? todayExpenseTotal : 0;
  const netIncome = viewRevenue - viewCOGS - viewExpense;
  const dailyRevenueCut = Math.round(Math.max(0, netIncome) * 0.10 * 100) / 100;
  const adjustedRevenue = viewRevenue - dailyRevenueCut;
  const netProfit = netIncome - dailyRevenueCut;

  const totalStock = useMemo(() =>
    inventory.reduce((sum, item) => sum + (item.quantity_on_hand || 0), 0),
    [inventory]
  );

  // Compute inventory value from already-fetched data (avoids redundant fetchInventoryValue call)
  const inventoryValue = useMemo(() => {
    let eggValue = 0;
    inventory.forEach(item => {
      const qty = item.quantity_on_hand || 0;
      const costPerEgg = costsPerEgg[item.egg_size_id]?.avgCostPerEgg || 0;
      eggValue += qty * costPerEgg;
    });
    let productValue = 0;
    products.forEach(p => {
      const qty = parseFloat(p.quantity_on_hand || 0);
      const price = parseFloat(p.price || 0);
      productValue += qty * price;
    });
    return { eggValue, productValue, totalValue: eggValue + productValue };
  }, [inventory, products]);

  // Yesterday comparison (combined)
  const yesterdayCombinedRevenue = useMemo(() => {
    const yRev = yesterdaySales.reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0);
    const yProdRev = yesterdayProductSales.reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0);
    return yRev + yProdRev;
  }, [yesterdaySales, yesterdayProductSales]);

  // Revenue change vs the immediately preceding period: yesterday's full
  // revenue for the 'today' view, or the prior same-length window otherwise
  // (fetched alongside in loadData as prevBaseline*).
  const comparisonRevenue = period === 'today'
    ? yesterdayCombinedRevenue
    : prevBaselineEggRevenue + prevBaselineProductRevenue;

  const revenueChange = comparisonRevenue > 0
    ? Math.round(((viewRevenue - comparisonRevenue) / comparisonRevenue) * 100)
    : viewRevenue > 0 ? 100 : 0;

  // Best-selling size today
  const { bestSeller, bestSellerPercent } = useMemo(() => {
    const sizeSalesMap = {};
    todaySales.forEach(s => {
      const name = s.egg_sizes?.name || 'Unknown';
      const eggs = getEggCount(s);
      sizeSalesMap[name] = (sizeSalesMap[name] || 0) + eggs;
    });
    const entries = Object.entries(sizeSalesMap).sort((a, b) => b[1] - a[1]);
    const best = entries[0] || null;
    const pct = best && totalEggsSoldToday > 0
      ? Math.round((best[1] / totalEggsSoldToday) * 100)
      : 0;
    return { bestSeller: best, bestSellerPercent: pct };
  }, [todaySales, totalEggsSoldToday]);

  // Top product today
  const { topProduct, topProductPercent } = useMemo(() => {
    const productSalesMap = {};
    todayProductSales.forEach(s => {
      const name = s.products?.name || 'Unknown';
      productSalesMap[name] = (productSalesMap[name] || 0) + parseFloat(s.quantity || 0);
    });
    const entries = Object.entries(productSalesMap).sort((a, b) => b[1] - a[1]);
    const top = entries[0] || null;
    const totalUnits = todayProductSales.reduce((sum, s) => sum + parseFloat(s.quantity || 0), 0);
    const pct = top && totalUnits > 0
      ? Math.round((top[1] / totalUnits) * 100)
      : 0;
    return { topProduct: top, topProductPercent: pct };
  }, [todayProductSales]);

  // Profit margin (view-aware via adjustedRevenue/netProfit)
  const marginPercent = adjustedRevenue > 0
    ? Math.round((netProfit / adjustedRevenue) * 100)
    : 0;

  // Unified chronological sales feed: egg + product sales tagged by kind,
  // filtered by viewFilter, sorted by time (newest first).
  const feedItems = useMemo(() => {
    const eggs = viewFilter === 'products' ? [] : todaySales.map(s => ({
      kind: 'egg',
      id: `egg-${s.id}`,
      name: s.egg_sizes?.name || 'Unknown',
      detail: s.quantity + ' ' + (s.unit === 'tray'
        ? `tray${s.quantity > 1 ? 's' : ''}`
        : `egg${s.quantity > 1 ? 's' : ''}`),
      amount: s.total_amount,
      time: s.sale_time?.slice(0, 5),
    }));
    const prods = viewFilter === 'eggs' ? [] : todayProductSales.map(s => ({
      kind: 'product',
      id: `prod-${s.id}`,
      name: s.products?.name || 'Unknown',
      detail: `${s.quantity} ${s.products?.unit || 'units'}`,
      amount: s.total_amount,
      time: s.sale_time?.slice(0, 5),
    }));
    return [...eggs, ...prods]
      .sort((a, b) => (b.time || '').localeCompare(a.time || ''))
      .slice(0, 10);
  }, [todaySales, todayProductSales, viewFilter]);

  
  // 7-day sparkline data — egg (egg count) and product (revenue) series,
  // selected by viewFilter so the trend always matches the chosen stream.
  const { sparklineValues, maxSpark } = useMemo(() => {
    const eggDaily = {};
    trendData.forEach(s => {
      eggDaily[s.sale_date] = (eggDaily[s.sale_date] || 0) + getEggCount(s);
    });
    const eggValues = Object.entries(eggDaily)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, eggs]) => eggs);

    const prodDaily = {};
    productTrendData.forEach(s => {
      prodDaily[s.sale_date] = (prodDaily[s.sale_date] || 0) + parseFloat(s.total_amount || 0);
    });
    const prodValues = Object.entries(prodDaily)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, rev]) => rev);

    const values = viewFilter === 'products' ? prodValues : eggValues;
    return { sparklineValues: values, maxSpark: Math.max(...values, 1) };
  }, [trendData, productTrendData, viewFilter]);

  // Multi-tray quick-add to inventory
  const handleQuickAdd = useCallback(async (item, trays) => {
    setQuickAddPopover(null);
    setQuickAdding(item.egg_size_id);
    try {
      const qty = trays * TRAY_SIZE;
      await incrementInventory(item.egg_size_id, qty);
      toast(`Added ${trays} tray${trays > 1 ? 's' : ''} (${qty} eggs) to ${item.egg_sizes?.name}`);
      loadData();
    } catch (err) {
      console.error('Quick add error:', err);
      toast('Failed to add stock', 'error');
    } finally {
      setQuickAdding(null);
    }
  }, [loadData]);

  const handleCustomTrayAdd = useCallback(async (item) => {
    const val = parseInt(customTrayInput[item.egg_size_id], 10);
    if (isNaN(val) || val <= 0) {
      toast('Enter a valid number of trays', 'error');
      return;
    }
    await handleQuickAdd(item, val);
    setCustomTrayInput(prev => ({ ...prev, [item.egg_size_id]: '' }));
  }, [customTrayInput, handleQuickAdd]);

  // Load recent opex entries for the "Why?" popover
  const loadOpexDetails = useCallback(async () => {
    try {
      const [expenses, funds] = await Promise.all([
        fetchExpenses({ limit: 3 }),
        fetchOperationalFunds({ limit: 3 }),
      ]);
      setOpexRecentExpenses(expenses || []);
      setOpexRecentFunds(funds || []);
    } catch (err) {
      console.error('Failed to load opex details:', err);
    }
  }, []);

  const lowStockItems = useMemo(() =>
    inventory.filter(item => (item.quantity_on_hand || 0) <= (item.reorder_level ?? 30) && item.quantity_on_hand > 0),
    [inventory]
  );

  const outOfStockItems = useMemo(() =>
    inventory.filter(item => item.quantity_on_hand === 0),
    [inventory]
  );

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="dashboard fade-in">
      {/* Welcome Header */}
      <div className="welcome-section">
        <div className="welcome-text">
          <h1 className="welcome-title">{getGreeting()} {getGreetingEmoji()}</h1>
          <p className="welcome-date">{dateStr}</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadData}>
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="error-banner">
          <AlertTriangle size={20} />
          <div className="error-banner-content">
            <strong>Failed to load dashboard</strong>
            <p>{getUserFriendlyError(error)}</p>
          </div>
          <button className="btn btn-sm btn-secondary" onClick={loadData}>
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      )}

      {/* Quick Action Bar */}
      <div className="quick-actions">
        <button className="qa-btn qa-sale" onClick={() => navigate('/sales/new')}>
          <ShoppingCart size={18} />
          <span>New Sale</span>
        </button>
        <button className="qa-btn qa-stock" onClick={() => navigate('/inventory')}>
          <Package size={18} />
          <span>Stock</span>
        </button>
        <button className="qa-btn qa-delivery" onClick={() => navigate('/deliveries')}>
          <Truck size={18} />
          <span>Delivery</span>
        </button>
        <button className="qa-btn qa-product-delivery" onClick={() => navigate('/product-deliveries')}>
          <Truck size={18} />
          <span>Prod. Delivery</span>
        </button>
        <button className="qa-btn qa-expense" onClick={() => navigate('/expenses-funds')}>
          <TrendingDown size={18} />
          <span>Expense</span>
        </button>
      </div>

      {/* Period Selector + View Filter — controls the sales section below */}
      <div className="dash-filter-bar">
        <div className="dash-period-btns">
          {PERIODS.map(p => (
            <button
              key={p.key}
              className={`dash-period-btn ${period === p.key ? 'active' : ''}`}
              onClick={() => changePeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="dash-custom-inputs">
            <input type="date" className="dash-date-input" value={customStart} onChange={e => setCustomStart(e.target.value)} />
            <span className="dash-date-sep">—</span>
            <input type="date" className="dash-date-input" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
            <button className="btn btn-primary btn-sm" onClick={applyCustom}>Go</button>
          </div>
        )}
        <div className="dash-period-range">
          <Calendar size={12} /> {startDate} — {endDate}
        </div>
      </div>

      <div className="dash-view-filter">
        {[
          { key: 'all', label: 'All' },
          { key: 'eggs', label: 'Eggs Only' },
          { key: 'products', label: 'Products Only' },
        ].map(v => (
          <button key={v.key} className={`dash-view-btn ${viewFilter === v.key ? 'active' : ''}`} onClick={() => setViewFilter(v.key)}>{v.label}</button>
        ))}
      </div>

      {/* Primary Stats */}
      <div className="primary-stats">
        <div className="primary-stat primary-stat-revenue">
          <div className="primary-stat-icon">
            <DollarSign size={20} />
          </div>
          <div className="primary-stat-info">
            <span className="primary-stat-label">Revenue</span>
            <span className="primary-stat-value stat-value-anim" data-animated="true">{loading ? <span className="skeleton" style={{ display: 'inline-block', width: 80, height: 28 }}>&nbsp;</span> : formatPeso(viewRevenue)}</span>
            {!loading && viewFilter === 'all' && (
              <span className="primary-stat-sub">Eggs {formatPeso(todayRevenue)} · Products {formatPeso(todayProductRevenue)}</span>
            )}
            {!loading && viewFilter === 'eggs' && (
              <span className="primary-stat-sub">Eggs only — Products {formatPeso(todayProductRevenue)} in this period</span>
            )}
            {!loading && viewFilter === 'products' && (
              <span className="primary-stat-sub">Products only — Eggs {formatPeso(todayRevenue)} in this period</span>
            )}
            {!loading && (
              <span className={`primary-stat-change ${revenueChange >= 0 ? 'change-up' : 'change-down'}`}>
                {revenueChange >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {Math.abs(revenueChange)}% {period === 'today' ? 'vs yesterday' : 'vs prev. period'}
              </span>
            )}
          </div>
        </div>
        <div className="primary-stat primary-stat-profit" data-positive={netProfit >= 0}>
          <div className="primary-stat-icon">
            {netProfit >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
          </div>
          <div className="primary-stat-info">
            <span className="primary-stat-label">Net Profit (after 10% cut)</span>
            <span className="primary-stat-value stat-value-anim" data-animated="true">{loading ? <span className="skeleton" style={{ display: 'inline-block', width: 80, height: 28 }}>&nbsp;</span> : formatPeso(netProfit)}</span>
            {!loading && dailyRevenueCut > 0 && (
              <span className="primary-stat-sub">Net income ₱{formatPeso(netIncome).replace('₱','')} − 10% cut ₱{formatPeso(dailyRevenueCut).replace('₱','')} = ₱{formatPeso(netProfit).replace('₱','')}</span>
            )}
            {!loading && dailyRevenueCut === 0 && netIncome > 0 && (
              <span className="primary-stat-sub">Net income ₱{formatPeso(netIncome).replace('₱','')} (no cut taken)</span>
            )}
          </div>
        </div>
      </div>

      {/* Secondary Stats Grid */}
      <div className="stat-cards-grid">
        <div className="stat-card-item">
          <div className="stat-card-icon" style={{ background: '#E3F2FD', color: '#1565C0' }}>
            <Package size={18} />
          </div>
          <div className="stat-card-content">
            <span className="stat-card-value">
              {loading ? <span className="skeleton" style={{ display: 'inline-block', width: 50, height: 24 }}>&nbsp;</span> : <span className="stat-value-anim" data-animated="true">{Math.round(totalStock).toLocaleString()}</span>}
            </span>
            <span className="stat-card-label">{inventory.length} size{inventory.length !== 1 ? 's' : ''} in stock</span>
          </div>
        </div>

        <div className="stat-card-item">
          <div className="stat-card-icon" style={{ background: '#E8F5E9', color: '#2E7D32' }}>
            <DollarSign size={18} />
          </div>
          <div className="stat-card-content">
            <span className="stat-card-value">
              {loading ? '—' : formatPeso(inventoryValue.eggValue)}
            </span>
            <span className="stat-card-label">Egg Stock Value</span>
          </div>
        </div>

        <div className="stat-card-item">
          <div className="stat-card-icon" style={{ background: '#F3E5F5', color: '#7B1FA2' }}>
            <DollarSign size={18} />
          </div>
          <div className="stat-card-content">
            <span className="stat-card-value">
              {loading ? '—' : formatPeso(inventoryValue.productValue)}
            </span>
            <span className="stat-card-label">Product Stock Value</span>
          </div>
        </div>

        <div className="stat-card-item">
          <div className="stat-card-icon" style={{ background: '#F3E5F5', color: '#7B1FA2' }}>
            <ShoppingCart size={18} />
          </div>
          <div className="stat-card-content">
            <span className="stat-card-value">
              {loading ? '—' : formatPeso(viewRevenue)}
            </span>
            <span className="stat-card-label">Total Sales {viewFilter === 'all' ? '' : `(${viewFilter === 'eggs' ? 'Eggs' : 'Products'})`}</span>
          </div>
        </div>

        <div
          className="stat-card-item stat-card-opex"
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('/expenses-funds')}
          title={opexBalance.balance < 0 ? `Expenses exceed funds by ${formatPeso(Math.abs(opexBalance.balance))}. Add funds or review recent expenses.` : `Funds: ${formatPeso(opexBalance.totalFunds)} · Expenses: ${formatPeso(opexBalance.totalExpenses)}`}
        >
          <div className="stat-card-icon" style={{ background: opexBalance.balance >= 0 ? '#E8F5E9' : '#FFEBEE', color: opexBalance.balance >= 0 ? '#2E7D32' : '#C62828' }}>
            <Wallet size={18} />
          </div>
          <div className="stat-card-content">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span className="stat-card-value" style={{ color: opexBalance.balance >= 0 ? 'inherit' : 'var(--color-danger)' }}>
                {loading ? '—' : formatPeso(opexBalance.balance)}
              </span>
              {!loading && (
                <button
                  className="opex-why-btn"
                  onClick={e => { e.stopPropagation(); loadOpexDetails(); setOpexWhyOpen(!opexWhyOpen); }}
                  title="Why?"
                >
                  Why?
                </button>
              )}
            </div>
            <span className="stat-card-label">Operational Funds</span>
            {!loading && opexBalance.totalFunds > 0 && (
              <div className="opex-bar-wrap">
                <div className="opex-bar">
                  <div
                    className="opex-bar-fill"
                    style={{
                      width: `${Math.max(0, Math.min(100, (opexBalance.balance / opexBalance.totalFunds) * 100))}%`,
                      background: opexBalance.balance >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
                    }}
                  />
                </div>
              </div>
            )}
            {opexWhyOpen && !loading && (
              <div className="opex-why-popover" onClick={e => e.stopPropagation()}>
                <div className="opex-why-section">
                  <span className="opex-why-section-title">Recent Expenses</span>
                  {opexRecentExpenses.length === 0 ? (
                    <span className="opex-why-empty">No recent expenses</span>
                  ) : (
                    opexRecentExpenses.map(e => (
                      <div key={e.id} className="opex-why-row">
                        <span>{e.description || e.category || 'Expense'}</span>
                        <span className="opex-why-amount">-{formatPeso(e.amount)}</span>
                      </div>
                    ))
                  )}
                </div>
                <div className="opex-why-section">
                  <span className="opex-why-section-title">Recent Funds</span>
                  {opexRecentFunds.length === 0 ? (
                    <span className="opex-why-empty">No recent funds added</span>
                  ) : (
                    opexRecentFunds.map(f => (
                      <div key={f.id} className="opex-why-row">
                        <span>{f.source || 'Funds added'}</span>
                        <span className="opex-why-amount opex-why-amount-add">+{formatPeso(f.amount)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="stat-card-item">
          <div className="stat-card-icon" style={{ background: todayExpenseTotal > 0 ? '#FFEBEE' : '#E8F5E9', color: todayExpenseTotal > 0 ? '#C62828' : '#2E7D32' }}>
            <TrendingDown size={18} />
          </div>
          <div className="stat-card-content">
            <span className="stat-card-value">
              {loading ? '—' : formatPeso(todayExpenseTotal)}
            </span>
            <span className="stat-card-label">Expenses</span>
          </div>
        </div>

        <div className="stat-card-item">
          <div className="stat-card-icon" style={{ background: '#E0F2F1', color: '#00695C' }}>
            <Truck size={18} />
          </div>
          <div className="stat-card-content">
            <span className="stat-card-value">
              {loading ? '—' : todayDeliveryCount}
            </span>
            <span className="stat-card-label">Deliveries Today</span>
          </div>
        </div>

        {!loading && dailyRevenueCut > 0 && (
        <div className="stat-card-item">
          <div className="stat-card-icon" style={{ background: '#E8F5E9', color: '#2E7D32' }}>
            <Wallet size={18} />
          </div>
          <div className="stat-card-content">
            <span className="stat-card-value">
              {formatPeso(dailyRevenueCut)}
            </span>
            <span className="stat-card-label">10% Daily Cut</span>
          </div>
        </div>
        )}

        <div className="stat-card-item">
          <div className="stat-card-icon" style={{ background: '#FFF3E0', color: '#E65100' }}>
            <Package size={18} />
          </div>
          <div className="stat-card-content">
            <span className="stat-card-value">
              {loading ? '—' : productCount}
            </span>
            <span className="stat-card-label">Product Catalog</span>
          </div>
        </div>
      </div>

      {/* Insight Cards Row */}
      <div className="insight-row">
        {/* Top Egg Size (hidden on Products view) */}
        {viewFilter !== 'products' && (
        <div className="insight-card">
          <div className="insight-icon-box" style={{ background: '#E8F5E9', color: '#2E7D32' }}>
            <Award size={18} />
          </div>
          <div className="insight-content">
            <span className="insight-label">Top Egg Size</span>
            {loading ? (
              <span className="skeleton" style={{ display: 'inline-block', width: 80, height: 20 }}>&nbsp;</span>
            ) : bestSeller ? (
              <span className="insight-value">{bestSeller[0]}</span>
            ) : (
              <span className="insight-value" style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>No sales yet</span>
            )}
            {bestSeller && !loading && (
              <span className="insight-sub">{bestSeller[1].toLocaleString()} eggs ({bestSellerPercent}%)</span>
            )}
          </div>
        </div>
        )}

        {/* Top Product (hidden on Eggs view) */}
        {viewFilter !== 'eggs' && (
        <div className="insight-card">
          <div className="insight-icon-box" style={{ background: '#F3E5F5', color: '#7B1FA2' }}>
            <Package size={18} />
          </div>
          <div className="insight-content">
            <span className="insight-label">Top Product</span>
            {loading ? (
              <span className="skeleton" style={{ display: 'inline-block', width: 80, height: 20 }}>&nbsp;</span>
            ) : topProduct ? (
              <span className="insight-value">{topProduct[0]}</span>
            ) : (
              <span className="insight-value" style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>No sales yet</span>
            )}
            {topProduct && !loading && (
              <span className="insight-sub">{topProduct[1].toLocaleString()} units ({topProductPercent}%)</span>
            )}
          </div>
        </div>
        )}

        {/* Profit Margin */}
        <div className="insight-card">
          <div className="insight-icon-box" style={{ background: marginPercent >= 0 ? '#E8F5E9' : '#FFEBEE', color: marginPercent >= 0 ? '#2E7D32' : '#C62828' }}>
            <BarChart3 size={18} />
          </div>
          <div className="insight-content">
            <span className="insight-label">Profit Margin</span>
            {loading ? (
              <span className="skeleton" style={{ display: 'inline-block', width: 60, height: 20 }}>&nbsp;</span>
            ) : (
              <span className="insight-value" style={{ color: marginPercent >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {marginPercent > 0 ? '+' : ''}{marginPercent}%
              </span>
            )}
            {!loading && (
              <span className="insight-sub">{formatPeso(netProfit)} on {formatPeso(adjustedRevenue)}</span>
            )}
          </div>
        </div>

        {/* 7-Day Sparkline */}
        <div className="insight-card insight-spark-card">
          <div className="insight-icon-box" style={{ background: '#E3F2FD', color: '#1565C0' }}>
            <TrendingUp size={18} />
          </div>
          <div className="insight-content">
            <span className="insight-label">7-Day {viewFilter === 'products' ? 'Product' : viewFilter === 'eggs' ? 'Egg' : 'Sales'} Trend</span>
            {loading ? (
              <span className="skeleton" style={{ display: 'inline-block', width: '100%', height: 32 }}>&nbsp;</span>
            ) : sparklineValues.length > 1 ? (
              <div className="sparkline-wrap">
                <svg width="100%" height="32" viewBox={`0 0 ${sparklineValues.length * 24} 32`} preserveAspectRatio="none">
                  <polyline
                    fill="none"
                    stroke="var(--color-primary)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={sparklineValues.map((v, i) => `${i * 24 + 4},${32 - (v / maxSpark) * 28}`).join(' ')}
                  />
                  <polyline
                    fill="var(--color-primary-100)"
                    stroke="none"
                    points={`0,32 ${sparklineValues.map((v, i) => `${i * 24 + 4},${32 - (v / maxSpark) * 28}`).join(' ')} ${(sparklineValues.length - 1) * 24 + 4},32`}
                  />
                </svg>
              </div>
            ) : (
              <span className="insight-sub" style={{ fontSize: '0.8125rem' }}>Not enough data</span>
            )}
          </div>
        </div>
      </div>

      {/* Low Stock Alert */}
      {(lowStockItems.length > 0 || outOfStockItems.length > 0) && (
        <div className="alert-card">
          <div className="alert-icon">
            <AlertTriangle size={18} />
          </div>
          <div className="alert-content">
            <span className="alert-title">
              {outOfStockItems.length > 0
                ? `${outOfStockItems.length} size${outOfStockItems.length > 1 ? 's' : ''} out of stock`
                : `${lowStockItems.length} size${lowStockItems.length > 1 ? 's' : ''} running low`
              }
            </span>
            <span className="alert-subtitle">
              {outOfStockItems.length > 0 && lowStockItems.length > 0
                ? `Also ${lowStockItems.length} size${lowStockItems.length > 1 ? 's' : ''} low on stock`
                : outOfStockItems.length > 0
                  ? 'Restock immediately'
                  : 'Consider restocking soon'
              }
            </span>
          </div>
          <button className="btn btn-sm btn-secondary" onClick={() => navigate('/inventory')}>
            Manage
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Content Grid */}
      <div className="grid-2">
        {/* Stock Levels */}
        <div className="card">
          <div className="card-header">
            <h2>Stock Levels</h2>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => navigate('/inventory')}
            >
              Manage <ArrowRight size={14} />
            </button>
          </div>
          <div className="stock-list">
            {loading
              ? Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="stock-item">
                    <span className="skeleton" style={{ width: 80, height: 18 }}>&nbsp;</span>
                    <span className="skeleton" style={{ width: 60, height: 18 }}>&nbsp;</span>
                  </div>
                ))
              : inventory.map((item, i) => {
                  const qty = item.quantity_on_hand || 0;
                  let statusClass = 'badge-success';
                  let label = 'In Stock';
                  if (qty === 0) {
                    statusClass = 'badge-danger';
                    label = 'Out';
                  } else if (qty <= (item.reorder_level ?? 30)) {
                    statusClass = 'badge-warning';
                    label = 'Low';
                  }
                  const isAdding = quickAdding === item.egg_size_id;
                  return (
                    <div
                      key={item.id || i}
                      className="stock-item"
                      style={{ animationDelay: `${i * 0.03}s` }}
                    >
                      <span className="stock-name">
                        {item.egg_sizes?.name || `Size ${i + 1}`}
                      </span>
                      <div className="stock-right">
                        <span className="stock-breakdown">
                          {formatInventory(qty)}
                        </span>
                        <span className={`badge ${statusClass}`}>{label}</span>
                        <div className="stock-quick-add-wrap">
                          <button
                            className="btn-icon btn-icon-quick stock-add-btn"
                            onClick={() => setQuickAddPopover(quickAddPopover === item.egg_size_id ? null : item.egg_size_id)}
                            disabled={isAdding}
                            title="Quick add trays"
                          >
                            {isAdding ? <span className="spinner-sm" /> : <Plus size={14} />}
                          </button>
                          {quickAddPopover === item.egg_size_id && (
                            <div className="stock-quick-popover">
                              <button className="stock-qp-btn" onClick={() => handleQuickAdd(item, 1)}>+1</button>
                              <button className="stock-qp-btn" onClick={() => handleQuickAdd(item, 5)}>+5</button>
                              <button className="stock-qp-btn" onClick={() => handleQuickAdd(item, 10)}>+10</button>
                              <div className="stock-qp-custom">
                                <input
                                  type="number"
                                  min="1"
                                  className="stock-qp-input"
                                  placeholder="Custom"
                                  value={customTrayInput[item.egg_size_id] || ''}
                                  onChange={e => setCustomTrayInput(prev => ({ ...prev, [item.egg_size_id]: e.target.value }))}
                                  onKeyDown={e => { if (e.key === 'Enter') handleCustomTrayAdd(item); }}
                                />
                                <button className="stock-qp-go" onClick={() => handleCustomTrayAdd(item)}>Go</button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
          </div>
        </div>

        {/* Sales Feed */}
        <div className="card">
          <div className="card-header">
            <h2>Sales <span className="sale-period-label">{PERIODS.find(p => p.key === period)?.label || startDate}</span></h2>
            <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
              <span className="sale-count-note">
                {todaySales.length + todayProductSales.length} in this period
              </span>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/sales')}>
                Eggs <ArrowRight size={14} />
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/product-sales')}>
                Products <ArrowRight size={14} />
              </button>
            </div>
          </div>
          {loading ? (
            <div className="stock-list">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="stock-item">
                  <span className="skeleton" style={{ width: 70, height: 18 }}>&nbsp;</span>
                  <span className="skeleton" style={{ width: 50, height: 18 }}>&nbsp;</span>
                </div>
              ))}
            </div>
          ) : feedItems.length === 0 ? (
            <div className="empty-state">
              <ShoppingCart size={32} />
              <p>
                {viewFilter === 'eggs' ? 'No egg sales' : viewFilter === 'products' ? 'No product sales' : 'No sales'}{' '}
                {period === 'today' ? 'today' : `in this period`}
              </p>
              {viewFilter !== 'products' && (
                <button className="btn btn-primary btn-sm" onClick={() => navigate('/sales/new')}>
                  Record a Sale
                </button>
              )}
            </div>
          ) : (
            <div className="stock-list">
              {feedItems.map((item, i) => (
                <div
                  key={item.id}
                  className="stock-item"
                  style={{ animationDelay: `${i * 0.03}s` }}
                >
                  <div className="sale-info">
                    <div className="sale-name-row">
                      <span className={`sale-kind-badge ${item.kind === 'egg' ? 'sale-kind-egg' : 'sale-kind-product'}`}>
                        {item.kind === 'egg' ? <Egg size={11} /> : <Package size={11} />}
                      </span>
                      <span className="stock-name">
                        {item.name}
                      </span>
                    </div>
                    <span className="sale-qty-detail">
                      {item.detail}
                    </span>
                  </div>
                  <div className="stock-right">
                    <span className="sale-amount-small">
                      {formatPeso(item.amount)}
                    </span>
                    <span className="sale-time">
                      <Clock size={11} />
                      {item.time}
                    </span>
                  </div>
                </div>
              ))}
              {(todaySales.length + todayProductSales.length) > 10 && (
                <div className="stock-item" style={{ justifyContent: 'center', padding: '0.5rem' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                    +{(todaySales.length + todayProductSales.length) - 10} more sales
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Today's Deliveries */}
        <div className="card">
          <div className="card-header">
            <h2>Today's Deliveries</h2>
            <div style={{ display: 'flex', gap: '0.375rem' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/deliveries')}>
                Eggs <ArrowRight size={14} />
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/product-deliveries')}>
                Products <ArrowRight size={14} />
              </button>
            </div>
          </div>
          {loading ? (
            <div className="stock-list">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="stock-item">
                  <span className="skeleton" style={{ width: 70, height: 18 }}>&nbsp;</span>
                  <span className="skeleton" style={{ width: 50, height: 18 }}>&nbsp;</span>
                </div>
              ))}
            </div>
          ) : todayDeliveries.length === 0 ? (
            <div className="empty-state">
              <Truck size={32} />
              <p>No deliveries today</p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-primary btn-sm" onClick={() => navigate('/deliveries')}>
                  Record Egg Delivery
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate('/product-deliveries')}>
                  Record Product Delivery
                </button>
              </div>
            </div>
          ) : (
            <div className="stock-list">
              {todayDeliveries.slice(0, 6).map((delivery, i) => (
                <div
                  key={delivery.id}
                  className="stock-item"
                  style={{ animationDelay: `${i * 0.03}s` }}
                >
                  <div className="sale-info">
                    <span className="stock-name">
                      {delivery.egg_sizes?.name || 'Unknown'}
                    </span>
                    <span className="sale-qty-detail">
                      {delivery.suppliers?.name || 'Unknown'}
                      {' · '}{delivery.quantity}{' '}
                      {delivery.unit === 'tray'
                        ? `tray${delivery.quantity > 1 ? 's' : ''}`
                        : `egg${delivery.quantity > 1 ? 's' : ''}`}
                    </span>
                  </div>
                  <div className="stock-right">
                    <span className="delivery-cost-small">
                      {formatPeso(delivery.total_cost)}
                    </span>
                    <span className="sale-time">
                      <span className="delivery-payment-status" style={{
                        display: 'inline-block',
                        padding: '0.1rem 0.35rem',
                        borderRadius: 999,
                        fontSize: '0.6rem',
                        fontWeight: 600,
                        background: delivery.payment_status === 'paid' ? '#E8F5E9' : delivery.payment_status === 'partial' ? '#FFF8E1' : '#FFF3E0',
                        color: delivery.payment_status === 'paid' ? '#2E7D32' : delivery.payment_status === 'partial' ? '#F57F17' : '#E65100',
                      }}>{delivery.payment_status}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .dashboard {
          max-width: 100%;
        }

        .welcome-section {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: var(--space-xl);
          gap: var(--space-lg);
        }

        .welcome-title {
          font-size: 1.625rem;
          font-weight: var(--font-weight-bold);
          letter-spacing: -0.02em;
          margin-bottom: 0.125rem;
        }

        .welcome-date {
          color: var(--color-text-muted);
          font-size: 0.9375rem;
        }

        /* Primary Stats */
        .primary-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
          margin-bottom: var(--space-lg);
        }

        .primary-stat {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1.125rem 1.25rem;
          background: var(--color-card);
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
          transition: all var(--transition-base);
          animation: fadeIn 0.35s ease-out forwards;
        }

        .primary-stat:hover {
          box-shadow: var(--shadow-md);
          transform: translateY(-1px);
        }

        .primary-stat-icon {
          width: 44px;
          height: 44px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .primary-stat-revenue .primary-stat-icon {
          background: var(--color-success-bg);
          color: var(--color-success);
        }

        .primary-stat-profit[data-positive="true"] .primary-stat-icon {
          background: var(--color-success-bg);
          color: var(--color-success);
        }

        .primary-stat-profit[data-positive="false"] .primary-stat-icon {
          background: var(--color-danger-bg);
          color: var(--color-danger);
        }

        .primary-stat-info {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
          min-width: 0;
        }

        .primary-stat-label {
          font-size: 0.75rem;
          font-weight: var(--font-weight-medium);
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .primary-stat-value {
          font-size: 1.5rem;
          font-weight: var(--font-weight-bold);
          line-height: 1.2;
          letter-spacing: -0.02em;
          font-variant-numeric: tabular-nums;
        }

        .primary-stat-profit[data-positive="false"] .primary-stat-value {
          color: var(--color-danger);
        }

        /* Secondary Stats Grid */
        .stat-cards-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.75rem;
          margin-bottom: var(--space-xl);
        }

        .stat-card-item {
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

        .stat-card-item:hover {
          box-shadow: var(--shadow-sm);
        }

        .stat-card-icon {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .stat-card-content {
          display: flex;
          flex-direction: column;
          gap: 0.0625rem;
          min-width: 0;
        }

        .stat-card-value {
          font-size: 1.125rem;
          font-weight: var(--font-weight-bold);
          line-height: 1.2;
          font-variant-numeric: tabular-nums;
        }

        .stat-card-label {
          font-size: 0.6875rem;
          font-weight: var(--font-weight-medium);
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        /* Alert Card */
        .alert-card {
          display: flex;
          align-items: center;
          gap: 0.875rem;
          padding: 0.875rem 1.125rem;
          background: var(--color-warning-bg);
          border: 1px solid var(--color-warning);
          border-radius: var(--radius-md);
          margin-bottom: var(--space-xl);
        }

        .alert-icon {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(230, 81, 0, 0.15);
          color: var(--color-warning);
          flex-shrink: 0;
        }

        .alert-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.0625rem;
        }

        .alert-title {
          font-weight: var(--font-weight-semibold);
          font-size: 0.875rem;
          color: var(--color-warning);
        }

        .alert-subtitle {
          font-size: 0.75rem;
          color: var(--color-text-secondary);
        }

        /* Stock List */
        .card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1rem;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid var(--color-border-light);
        }

        .card-header h2 {
          font-size: 1rem;
        }

        .stock-list {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .stock-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem 0.75rem;
          border-radius: var(--radius-sm);
          background: var(--color-bg-subtle);
          animation: fadeIn 0.3s ease-out forwards;
          opacity: 0;
          transition: background var(--transition-fast);
        }

        .stock-item:hover {
          background: var(--color-primary-50);
        }

        .stock-name {
          font-weight: var(--font-weight-medium);
          font-size: 0.9375rem;
        }

        .stock-right {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .stock-breakdown {
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
          font-weight: var(--font-weight-semibold);
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }

        .sale-info {
          display: flex;
          flex-direction: column;
          gap: 0.0625rem;
        }

        .sale-qty-detail {
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
          font-weight: 500;
        }

        .sale-amount-small {
          font-weight: var(--font-weight-semibold);
          font-size: 0.875rem;
          color: var(--color-success);
          font-variant-numeric: tabular-nums;
        }

        .sale-time {
          display: flex;
          align-items: center;
          gap: 0.2rem;
          font-size: 0.6875rem;
          color: var(--color-text-muted);
          font-variant-numeric: tabular-nums;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          padding: 2rem;
          color: var(--color-text-muted);
          text-align: center;
        }

        @media (max-width: 640px) {
          .primary-stats {
            grid-template-columns: 1fr;
          }

          .primary-stat-value {
            font-size: 1.25rem;
          }

          .stat-cards-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 0.5rem;
          }

          .stat-card-item {
            padding: 0.75rem;
          }

          .stat-card-icon {
            width: 32px;
            height: 32px;
          }

          .stat-card-icon svg {
            width: 16px;
            height: 16px;
          }

          .stat-card-value {
            font-size: 0.9375rem;
          }

          .alert-card {
            flex-wrap: wrap;
          }

          .welcome-title {
            font-size: 1.35rem;
          }
        }

        /* Quick Action Bar */
        .quick-actions {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
          margin-bottom: var(--space-lg);
        }

        .qa-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.3rem;
          padding: 0.625rem 0.25rem;
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-md);
          background: var(--color-card);
          color: var(--color-text-secondary);
          font-size: 0.65rem;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition-fast);
          min-height: 64px;
          text-decoration: none;
        }

        .qa-btn:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }

        .qa-btn svg {
          transition: transform var(--transition-spring);
        }

        .qa-btn:hover svg {
          transform: scale(1.15);
        }

        .qa-sale { border-color: var(--color-primary); color: var(--color-primary); }
        .qa-sale:hover { background: var(--color-primary-light); border-color: var(--color-primary); }
        .qa-product-sale { border-color: #7B1FA2; color: #7B1FA2; }
        .qa-product-sale:hover { background: #F3E5F5; border-color: #7B1FA2; }
        .qa-stock { border-color: #1565C0; color: #1565C0; }
        .qa-stock:hover { background: #E3F2FD; border-color: #1565C0; }
        .qa-expense { border-color: var(--color-danger); color: var(--color-danger); }
        .qa-expense:hover { background: var(--color-danger-bg); border-color: var(--color-danger); }
        .qa-delivery { border-color: #00695C; color: #00695C; }
        .qa-delivery:hover { background: #E0F2F1; border-color: #00695C; }
        .qa-product-delivery { border-color: #F57F17; color: #F57F17; }
        .qa-product-delivery:hover { background: #FFF8E1; border-color: #F57F17; }

        /* Primary Stat Change Badge */
        .primary-stat-change {
          display: inline-flex;
          align-items: center;
          gap: 0.2rem;
          font-size: 0.6875rem;
          font-weight: 600;
          margin-top: 0.125rem;
          padding: 0.1rem 0.4rem;
          border-radius: var(--radius-full);
        }

        .primary-stat-change.change-up {
          color: var(--color-success);
          background: var(--color-success-bg);
        }

        .primary-stat-change.change-down {
          color: var(--color-danger);
          background: var(--color-danger-bg);
        }

        .primary-stat-sub {
          font-size: 0.9375rem;
          color: var(--color-text-secondary);
          font-weight: 500;
          margin-top: 0.0625rem;
        }

        /* Insight Cards Row */
        .insight-row {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.625rem;
          margin-bottom: var(--space-xl);
        }

        @media (min-width: 640px) {
          .insight-row {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (min-width: 900px) {
          .insight-row {
            grid-template-columns: repeat(4, 1fr);
          }
        }

        .insight-card {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 0.875rem 1rem;
          background: var(--color-card);
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-xs);
          transition: all var(--transition-base);
        }

        .insight-card:hover {
          box-shadow: var(--shadow-sm);
        }

        .insight-icon-box {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .insight-content {
          flex: 1;
          min-width: 0;
        }

        .insight-label {
          font-size: 0.6875rem;
          font-weight: var(--font-weight-medium);
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          display: block;
          margin-bottom: 0.125rem;
        }

        .insight-value {
          font-weight: var(--font-weight-bold);
          font-size: 1.0625rem;
          display: block;
          line-height: 1.3;
        }

        .insight-sub {
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
          font-weight: 500;
          display: block;
          margin-top: 0.0625rem;
        }

        .insight-spark-card .insight-content {
          display: flex;
          flex-direction: column;
        }

        /* Sparkline */
        .sparkline-wrap {
          width: 100%;
          margin-top: 0.25rem;
        }

        .sparkline-wrap svg {
          display: block;
        }

        /* Opex Progress Bar */
        .opex-bar-wrap {
          margin-top: 0.375rem;
        }

        .opex-bar {
          height: 4px;
          background: var(--color-border);
          border-radius: var(--radius-full);
          overflow: hidden;
        }

        .opex-bar-fill {
          height: 100%;
          border-radius: var(--radius-full);
          transition: width 0.5s ease;
        }

        .stock-add-btn {
          width: 28px !important;
          height: 28px !important;
          border: 1px solid var(--color-border) !important;
          border-radius: var(--radius-sm) !important;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stock-add-btn:hover {
          border-color: var(--color-primary) !important;
          background: var(--color-primary-light) !important;
          color: var(--color-primary) !important;
        }

        .stock-add-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        @media (max-width: 640px) {
          .quick-actions {
            grid-template-columns: repeat(3, 1fr);
            gap: 0.375rem;
          }

          .qa-btn {
            min-height: 56px;
            font-size: 0.6rem;
            padding: 0.5rem 0.125rem;
          }

          .insight-row {
            gap: 0.5rem;
          }
        }

        .stock-quick-add-wrap {
          position: relative;
          display: inline-flex;
        }

        .stock-quick-popover {
          position: absolute;
          top: calc(100% + 4px);
          right: 0;
          z-index: 50;
          background: var(--color-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-lg);
          padding: 0.375rem;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          min-width: 120px;
          animation: fadeIn 0.15s ease-out;
        }

        .stock-qp-btn {
          padding: 0.375rem 0.75rem;
          border: none;
          border-radius: var(--radius-sm);
          background: transparent;
          color: var(--color-text);
          font-size: 0.8125rem;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition-fast);
          text-align: left;
        }

        .stock-qp-btn:hover {
          background: var(--color-primary-light);
          color: var(--color-primary);
        }

        .stock-qp-custom {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.25rem 0.375rem;
          border-top: 1px solid var(--color-border-light);
          margin-top: 0.125rem;
          padding-top: 0.375rem;
        }

        .stock-qp-input {
          flex: 1;
          min-width: 0;
          width: 50px;
          padding: 0.25rem 0.375rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          font-size: 0.75rem;
          color: var(--color-text);
          background: var(--color-bg);
          outline: none;
        }
        .stock-qp-input:focus { border-color: var(--color-primary); }

        .stock-qp-go {
          padding: 0.25rem 0.5rem;
          border: none;
          border-radius: var(--radius-sm);
          background: var(--color-primary);
          color: white;
          font-size: 0.6875rem;
          font-weight: 700;
          cursor: pointer;
        }
        .stock-qp-go:hover { opacity: 0.9; }

        .opex-why-btn {
          padding: 0.0625rem 0.375rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-full);
          background: var(--color-bg);
          color: var(--color-text-muted);
          font-size: 0.6rem;
          font-weight: 600;
          cursor: pointer;
          transition: all var(--transition-fast);
          line-height: 1.3;
        }
        .opex-why-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }

        .opex-why-popover {
          margin-top: 0.5rem;
          padding: 0.5rem 0.625rem;
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          animation: fadeIn 0.15s ease-out;
        }

        .opex-why-section {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .opex-why-section:not(:last-child) {
          margin-bottom: 0.5rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px dashed var(--color-border);
        }

        .opex-why-section-title {
          font-size: 0.625rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-muted);
        }

        .opex-why-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.75rem;
          color: var(--color-text-secondary);
        }

        .opex-why-amount {
          font-weight: 600;
          font-variant-numeric: tabular-nums;
        }
        .opex-why-amount-add { color: var(--color-success); }

        .opex-why-empty {
          font-size: 0.6875rem;
          color: var(--color-text-muted);
          font-style: italic;
        }

        .spinner-sm {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid var(--color-border);
          border-top-color: var(--color-primary);
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        /* Period selector + view filter (sales section controls) */
        .dash-filter-bar {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          padding: 0.875rem 1rem;
          background: var(--color-card);
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-md);
          margin-bottom: 0.625rem;
          box-shadow: var(--shadow-xs);
        }
        .dash-period-btns { display: flex; gap: 0.25rem; flex-wrap: wrap; }
        .dash-period-btn {
          min-height: 40px;
          padding: 0.4rem 1rem;
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-sm);
          background: var(--color-card);
          color: var(--color-text-secondary);
          font-size: 0.8125rem;
          font-weight: 500;
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .dash-period-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
        .dash-period-btn.active { background: var(--color-primary); border-color: var(--color-primary); color: white; }
        .dash-custom-inputs { display: flex; align-items: center; gap: 0.375rem; flex-wrap: wrap; }
        .dash-date-input {
          padding: 0.375rem 0.5rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          background: var(--color-input-bg, var(--color-card));
          color: var(--color-text);
          font-size: 0.8125rem;
        }
        .dash-date-sep { color: var(--color-text-muted); }
        .dash-period-range { font-size: 0.75rem; color: var(--color-text-muted); display: flex; align-items: center; gap: 0.25rem; }

        .dash-view-filter { display: flex; gap: 0.25rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
        .dash-view-btn {
          min-height: 36px;
          padding: 0.375rem 1rem;
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-sm);
          background: var(--color-card);
          color: var(--color-text-secondary);
          font-size: 0.8125rem;
          font-weight: 500;
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .dash-view-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
        .dash-view-btn.active { background: var(--color-primary); border-color: var(--color-primary); color: white; }

        .sale-kind-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border-radius: var(--radius-sm);
          flex-shrink: 0;
        }
        .sale-kind-egg { background: #E8F5E9; color: #2E7D32; }
        .sale-kind-product { background: #E3F2FD; color: #1565C0; }
        .sale-count-note { font-size: 0.75rem; color: var(--color-text-muted); white-space: nowrap; }
        .sale-name-row { display: flex; align-items: center; gap: 0.375rem; }
        .sale-period-label { font-size: 0.75rem; font-weight: 500; color: var(--color-text-muted); }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
