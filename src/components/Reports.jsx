import { useState } from 'react';
import {
  FileText,
  Calendar,
  Clock,
  AlertTriangle,
  RefreshCw,
  Printer,
  Download,
} from 'lucide-react';
import { fetchSalesReport, fetchExpenses, fetchSpoilageWithCost, fetchCustomers, fetchDeliveries, fetchCostsPerEgg, fetchPriceSettings, formatPeso, EGG_SIZES, TRAY_SIZE, getLocalDate, exportAllData, fetchProductSalesReport } from '../lib/api';
import { formatShiftTime } from '../lib/formatters';
import { toast } from '../lib/toastFn';
import { getUserFriendlyError } from '../lib/errors';

const SHIFTS = [
  { label: 'Morning', start: '06:00', end: '14:00', desc: '6:00 AM - 2:00 PM' },
  { label: 'Afternoon', start: '14:00', end: '22:00', desc: '2:00 PM - 10:00 PM' },
  { label: 'Whole Day', start: '00:00', end: '23:59', desc: 'All day' },
  { label: 'Custom', start: '', end: '', desc: 'Set your own times' },
];

function todayStr() {
  return getLocalDate();
}

export default function Reports() {
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [startTime, setStartTime] = useState('06:00');
  const [endTime, setEndTime] = useState('14:00');
  const [activeShift, setActiveShift] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null);
  const [productReport, setProductReport] = useState([]);
  const [category, setCategory] = useState('both');
  const [reportExpenses, setReportExpenses] = useState([]);
  const [reportDeliveries, setReportDeliveries] = useState([]);
  const [priceSettings, setPriceSettings] = useState([]);
  const [costsPerEgg, setCostsPerEgg] = useState({});
  function selectShift(index) {
    setActiveShift(index);
    const shift = SHIFTS[index];
    if (index < 3) {
      setStartTime(shift.start);
      setEndTime(shift.end);
    }
  }

  async function handleGenerate() {
    if (!startDate || !endDate) {
      setError({ message: 'Please select start and end dates.' });
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const promises = [];
      if (category === 'eggs' || category === 'both') {
        promises.push(
          fetchSalesReport({ startDate, endDate, startTime, endTime }),
          fetchExpenses({ startDate, endDate }),
          fetchDeliveries({ startDate, endDate }),
          fetchPriceSettings(),
          fetchCostsPerEgg(),
        );
      } else {
        promises.push(Promise.resolve([]), Promise.resolve([]), Promise.resolve([]), Promise.resolve([]), Promise.resolve({}));
      }
      if (category === 'products' || category === 'both') {
        promises.push(fetchProductSalesReport({ startDate, endDate }));
      } else {
        promises.push(Promise.resolve([]));
      }
      const [salesData, expensesData, deliveriesData, priceData, costData, prodSalesData] = await Promise.all(promises);
      setReport(salesData || []);
      setProductReport(prodSalesData || []);
      setReportExpenses(expensesData || []);
      setReportDeliveries(deliveriesData || []);
      setPriceSettings(priceData || []);
      setCostsPerEgg(costData || {});
    } catch (err) {
      console.error('Report load error:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  function processReport() {
    if (!report || report.length === 0) return null;

    const sizeMap = {};
    EGG_SIZES.forEach(name => {
      sizeMap[name] = { trays: 0, pieces: 0, totalEggs: 0, revenue: 0, salesCount: 0 };
    });

    report.forEach(sale => {
      const name = sale.egg_sizes?.name || 'Unknown';
      if (!sizeMap[name]) {
        sizeMap[name] = { trays: 0, pieces: 0, totalEggs: 0, revenue: 0, salesCount: 0 };
      }
      const entry = sizeMap[name];
      entry.salesCount++;

      if (sale.unit === 'tray') {
        entry.trays += sale.quantity;
        entry.totalEggs += sale.quantity * (sale.tray_size || TRAY_SIZE);
      } else {
        entry.pieces += sale.quantity;
        entry.totalEggs += sale.quantity;
      }
      entry.revenue += parseFloat(sale.total_amount || 0);
    });

    // Convert total eggs into trays + pieces per size
    const rows = EGG_SIZES
      .map(name => {
        const r = sizeMap[name];
        return {
          name,
          totalEggs: r.totalEggs,
          revenue: r.revenue,
          salesCount: r.salesCount,
          trays: Math.floor(r.totalEggs / TRAY_SIZE),
          pieces: r.totalEggs % TRAY_SIZE,
        };
      })
      .filter(r => r.totalEggs > 0 || r.revenue > 0);

    const totals = rows.reduce(
      (acc, r) => ({
        totalEggs: acc.totalEggs + r.totalEggs,
        revenue: acc.revenue + r.revenue,
        salesCount: acc.salesCount + r.salesCount,
        trays: acc.trays + r.trays,
        pieces: acc.pieces + r.pieces,
      }),
      { trays: 0, pieces: 0, totalEggs: 0, revenue: 0, salesCount: 0 }
    );

    // Also normalize totals so pieces are always < TRAY_SIZE
    const totalTraysFromEggs = Math.floor(totals.totalEggs / TRAY_SIZE);
    const totalPiecesFromEggs = totals.totalEggs % TRAY_SIZE;

    return {
      rows,
      totals: {
        ...totals,
        trays: totalTraysFromEggs,
        pieces: totalPiecesFromEggs,
      },
    };
  }

  async function handleExportAll() {
    try {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `M-E-Fresh-Eggs-backup-${getLocalDate()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('All data exported!');
    } catch (err) {
      console.error('Export all error:', err);
      toast('Failed to export data', 'error');
    }
  }

  async function handleExportCSV() {
    if (!processed || !processed.rows.length) return;

    const rows = [
      ['Egg Size', 'Trays', 'Pieces', 'Total Eggs', 'Revenue', 'Transactions'],
      ...processed.rows.map(r => [
        r.name,
        r.trays,
        r.pieces,
        r.totalEggs,
        `₱${r.revenue.toFixed(2)}`,
        r.salesCount,
      ]),
      [],
      ['Total', processed.totals.trays, processed.totals.pieces, processed.totals.totalEggs, `₱${processed.totals.revenue.toFixed(2)}`, processed.totals.salesCount],
    ];

    // Add spoilage section
    try {
      const spoilageData = await fetchSpoilageWithCost({ startDate, endDate });
      if (spoilageData && spoilageData.length > 0) {
        rows.push([], ['=== SPOILAGE ==='], ['Date', 'Size', 'Quantity', 'Reason', 'Cost']);
        spoilageData.forEach(s => {
          rows.push([
            s.spoilage_date,
            s.egg_sizes?.name || 'Unknown',
            s.quantity,
            s.reason,
            `₱${parseFloat(s.cost || 0).toFixed(2)}`,
          ]);
        });
        const totalCost = spoilageData.reduce((sum, s) => sum + parseFloat(s.cost || 0), 0);
        rows.push(['Total', '', '', '', `₱${totalCost.toFixed(2)}`]);
      }
    } catch (e) {
      console.error('Failed to fetch spoilage data for CSV export:', e);
    }

    // Add deliveries section (using already-fetched reportDeliveries)
    if (reportDeliveries && reportDeliveries.length > 0) {
      rows.push([], ['=== DELIVERIES ===']);
      rows.push(['Date', 'Supplier', 'Size', 'Quantity', 'Unit', 'Cost per Tray', 'Total Cost', 'Payment Status', 'Notes']);
      reportDeliveries.forEach(d => {
        rows.push([
          d.delivery_date,
          d.suppliers?.name || 'Unknown',
          d.egg_sizes?.name || 'Unknown',
          d.quantity,
          d.unit,
          `\u20B1${parseFloat(d.cost_per_egg || 0).toFixed(2)}`,
          `\u20B1${parseFloat(d.total_cost || 0).toFixed(2)}`,
          d.payment_status,
          (d.notes || ''),
        ]);
      });
      const totalDelivCost = reportDeliveries.reduce((sum, d) => sum + parseFloat(d.total_cost || 0), 0);
      rows.push(['Total', '', '', '', '', '', `\u20B1${totalDelivCost.toFixed(2)}`, '', '']);
    }

    // Add customers section
    try {
      const customersData = await fetchCustomers();
      if (customersData && customersData.length > 0) {
        rows.push([], ['=== CUSTOMERS ==='], ['Name', 'Phone', 'Notes']);
        customersData.forEach(c => {
          rows.push([c.name, c.phone || '', c.notes || '']);
        });
      }
    } catch (e) {
      console.error('Failed to fetch customers data for CSV export:', e);
    }

    const csvEscape = (val) => {
      let str = String(val ?? '');
      // OWASP CSV-injection mitigation: neutralize formula triggers with a leading quote
      if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = rows.map(row => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `M&E-Fresh-Eggs_Report_${startDate}_${endTime ? endTime.replace(':', '-') : ''}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }

  function handlePrint() {
    window.print();
  }



  const processed = processReport();

  const productRevenue = (productReport || []).reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0);
  const productQty = (productReport || []).reduce((sum, s) => sum + parseFloat(s.quantity || 0), 0);
  const totalDeliveryCost = reportDeliveries.reduce(
    (sum, d) => sum + parseFloat(d.total_cost || 0),
    0
  );

  // Compute profit data per egg size
  const profitData = processed && priceSettings.length > 0 ? (() => {
    const rows = processed.rows.map(row => {
      const price = (priceSettings || []).find(p => p.egg_sizes?.name === row.name);
      const sizeId = price?.egg_size_id;
      const cost = sizeId ? (costsPerEgg || {})[sizeId] : null;
      const costPerEgg = cost?.avgCostPerEgg || 0;
      const costPerTray = cost?.avgCostPerTray || 0;
      const sellPerPiece = parseFloat(price?.price_per_piece || 0);
      const sellPerTray = parseFloat(price?.price_per_tray || 0);
      const profitPerEgg = Math.round((sellPerPiece - costPerEgg) * 100) / 100;
      const profitPerTray = Math.round((sellPerTray - costPerTray) * 100) / 100;
      const marginPercent = sellPerPiece > 0 ? Math.round((profitPerEgg / sellPerPiece) * 1000) / 10 : 0;
      const cogs = Math.round(costPerEgg * row.totalEggs * 100) / 100;
      return { ...row, costPerEgg, costPerTray, sellPerPiece, sellPerTray, profitPerEgg, profitPerTray, marginPercent, cogs };
    });

    const totalCOGS = rows.reduce((sum, r) => sum + r.cogs, 0);
    const totalExpensesAmount = reportExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
    
    // Net profit calculation: Revenue - COGS (Expenses are paid from Operational Funds, not deducted from Net Profit)
    const netProfit = Math.round((processed.totals.revenue - totalCOGS) * 100) / 100;

    return { rows, totalCOGS, totalExpenses: totalExpensesAmount, netProfit };
  })() : null;

  return (
    <div className="fade-in">
      <div className="page-header-row">
        <div>
          <h1>Sales Report</h1>
          <p className="page-subtitle">Generate a shift-based sales report per egg size</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {processed && (
            <>
              <button className="btn btn-secondary btn-sm" onClick={handleExportAll}>
                <Download size={16} />
                Backup
              </button>
              <button className="btn btn-secondary btn-sm" onClick={handleExportCSV}>
                <Download size={16} />
                CSV
              </button>
              <button className="btn btn-secondary btn-sm" onClick={handlePrint}>
                <Printer size={16} />
                Print
              </button>
            </>
          )}
          <button className="btn btn-secondary btn-sm" onClick={handleGenerate}>
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="card report-controls">
        {/* Category Filter */}
        <div className="report-category-filter">
          {[
            { key: 'eggs', label: 'Eggs Only' },
            { key: 'products', label: 'Products Only' },
            { key: 'both', label: 'Both' },
          ].map(v => (
            <button key={v.key} className={`shift-tab ${category === v.key ? 'active' : ''}`} onClick={() => setCategory(v.key)}>{v.label}</button>
          ))}
        </div>

        <div className="report-controls-grid">
          {/* Date range */}
          <div className="input-group">
            <label>
              <Calendar size={14} />
              From
            </label>
            <input
              id="report-start-date"
              name="startDate"
              type="date"
              className="input"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>
          <div className="input-group">
            <label>
              <Calendar size={14} />
              To
            </label>
            <input
              id="report-end-date"
              name="endDate"
              type="date"
              className="input"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>

          {/* Shift selector */}
          <div className="input-group report-shift-group">
            <label>
              <Clock size={14} />
              Shift
            </label>
            <div className="shift-tabs">
              {SHIFTS.map((shift, i) => (
                <button
                  key={shift.label}
                  type="button"
                  className={`shift-tab ${activeShift === i ? 'active' : ''}`}
                  onClick={() => selectShift(i)}
                >
                  {shift.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom time inputs */}
          {activeShift === 3 && (
            <>
              <div className="input-group">
                <label>Start Time</label>
                <input
                  id="report-start-time"
                  name="startTime"
                  type="time"
                  className="input"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label>End Time</label>
                <input
                  id="report-end-time"
                  name="endTime"
                  type="time"
                  className="input"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                />
              </div>
            </>
          )}

          {/* Shift description */}
          {activeShift < 3 && (
            <div className="report-shift-info">
              <Clock size={14} />
              <span>{SHIFTS[activeShift].desc}</span>
            </div>
          )}
        </div>

        <button className="btn btn-primary btn-generate" onClick={handleGenerate} disabled={loading}>
          <FileText size={18} />
          {loading ? 'Generating...' : 'Generate Report'}
        </button>
      </div>

      {/* Error */}
      {error && !loading && (
        <div className="error-banner" style={{ marginBottom: '1rem' }}>
          <AlertTriangle size={20} />
          <div className="error-banner-content">
            <strong>Failed to generate report</strong>
            <p>{getUserFriendlyError(error)}</p>
          </div>
        </div>
      )}

      {/* Report output */}
      {((category !== 'eggs' && productReport.length > 0) || (category !== 'products' && processed)) && (
        <div className="report-output">
          {/* Report header */}
          <div className="report-header">
            <h2 className="report-title">M&E Fresh Eggs — Sales Report</h2>
            <div className="report-meta">
              <span><Calendar size={14} /> {startDate} — {endDate}</span>
              <span><Clock size={14} /> {formatShiftTime(startTime)} — {formatShiftTime(endTime)}</span>
              <span className="report-badge">Shift: {SHIFTS[activeShift].label}</span>
              <span className="report-badge">{category === 'eggs' ? 'Eggs Only' : category === 'products' ? 'Products Only' : 'All Sales'}</span>
            </div>
            <div className="report-summary">
              {(category === 'eggs' || category === 'both') && processed && (
                <>
                  <div className="report-summary-item">
                    <span className="report-summary-value">{processed.totals.totalEggs.toLocaleString()}</span>
                    <span className="report-summary-label">Eggs Sold</span>
                  </div>
                  <div className="report-summary-item">
                    <span className="report-summary-value">{formatPeso(processed.totals.revenue)}</span>
                    <span className="report-summary-label">Egg Revenue</span>
                  </div>
                </>
              )}
              {(category === 'products' || category === 'both') && (
                <>
                  <div className="report-summary-item">
                    <span className="report-summary-value">{productQty.toLocaleString()}</span>
                    <span className="report-summary-label">Products Sold</span>
                  </div>
                  <div className="report-summary-item">
                    <span className="report-summary-value">{formatPeso(productRevenue)}</span>
                    <span className="report-summary-label">Product Revenue</span>
                  </div>
                </>
              )}
              {category === 'both' && (
                <div className="report-summary-item" style={{ background: 'var(--color-primary-light)', borderRadius: 'var(--radius-md)', padding: '0.5rem 1rem' }}>
                  <span className="report-summary-value" style={{ color: 'var(--color-primary)' }}>{formatPeso((processed?.totals?.revenue || 0) + productRevenue)}</span>
                  <span className="report-summary-label">Combined Revenue</span>
                </div>
              )}
            </div>
          </div>

          {/* Egg Report Table */}
          {(category === 'eggs' || category === 'both') && processed && (
            <>
              {processed.rows.length === 0 ? (
                <div className="report-empty">
                  <FileText size={36} />
                  <p>No egg sales found for this period and shift.</p>
                </div>
          ) : (
            <div className="report-table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Egg Size</th>
                    <th className="num">Trays</th>
                    <th className="num">Pieces</th>
                    <th className="num">Total Eggs</th>
                    <th className="num">Revenue</th>
                    <th className="num">Transactions</th>
                  </tr>
                </thead>
                <tbody>
                  {processed.rows.map(row => (
                    <tr key={row.name}>
                      <td className="size-cell">{row.name}</td>
                      <td className="num">{row.trays > 0 ? row.trays : '—'}</td>
                      <td className="num">{row.pieces > 0 ? row.pieces : '—'}</td>
                      <td className="num">{row.totalEggs.toLocaleString()}</td>
                      <td className="num revenue">{formatPeso(row.revenue)}</td>
                      <td className="num">{row.salesCount}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="total-row">
                    <td className="size-cell">Total</td>
                    <td className="num">{processed.totals.trays}</td>
                    <td className="num">{processed.totals.pieces}</td>
                    <td className="num">{processed.totals.totalEggs.toLocaleString()}</td>
                    <td className="num revenue">{formatPeso(processed.totals.revenue)}</td>
                    <td className="num">{processed.totals.salesCount}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
            </>
          )}

          {/* Deliveries section - egg only */}
          {(category === 'eggs' || category === 'both') && reportDeliveries.length > 0 && (
            <div className="report-section" style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '2px solid var(--color-border)' }}>
              <h3 className="report-profit-title">Deliveries ({reportDeliveries.length})</h3>
              <div className="report-table-wrap">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Supplier</th>
                      <th>Size</th>
                      <th className="num">Qty</th>
                      <th>Unit</th>
                      <th className="num">Cost/Tray</th>
                      <th className="num">Total Cost</th>
                      <th>Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportDeliveries.map(d => (
                      <tr key={d.id}>
                        <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>{d.delivery_date}</td>
                        <td className="size-cell">{d.suppliers?.name || 'Unknown'}</td>
                        <td>{d.egg_sizes?.name || 'Unknown'}</td>
                        <td className="num">{d.quantity.toLocaleString()}</td>
                        <td>{d.unit}</td>
                        <td className="num">{formatPeso(d.cost_per_egg)}</td>
                        <td className="num" style={{ color: 'var(--color-danger)', fontWeight: 600 }}>{formatPeso(d.total_cost)}</td>
                        <td>
                          <span className="report-delivery-badge" style={{
                            display: 'inline-block',
                            padding: '0.15rem 0.5rem',
                            borderRadius: 999,
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            background: d.payment_status === 'paid' ? '#E8F5E9' : d.payment_status === 'partial' ? '#FFF8E1' : '#FFF3E0',
                            color: d.payment_status === 'paid' ? '#2E7D32' : d.payment_status === 'partial' ? '#F57F17' : '#E65100',
                          }}>{d.payment_status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="total-row">
                      <td colSpan={6} className="size-cell">Total Delivery Cost</td>
                      <td className="num" style={{ color: 'var(--color-danger)' }}>{formatPeso(totalDeliveryCost)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Profit & Margins - egg only */}
          {(category === 'eggs' || category === 'both') && profitData && profitData.rows.some(r => r.totalEggs > 0) && (
            <div className="report-section" style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '2px solid var(--color-border)' }}>
              <h3 className="report-profit-title">Profit & Margins</h3>
              <div className="report-table-wrap">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Egg Size</th>
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
                        <td className="num">{row.costPerTray > 0 ? formatPeso(row.costPerTray) : '—'}</td>
                        <td className="num">{row.costPerEgg > 0 ? formatPeso(row.costPerEgg) : '—'}</td>
                        <td className="num">{row.sellPerTray > 0 ? formatPeso(row.sellPerTray) : '—'}</td>
                        <td className="num">{row.sellPerPiece > 0 ? formatPeso(row.sellPerPiece) : '—'}</td>
                        <td className="num" style={{ color: row.profitPerTray >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                          {row.sellPerTray > 0 ? formatPeso(row.profitPerTray) : '—'}
                        </td>
                        <td className="num" style={{ color: row.profitPerEgg >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                          {row.sellPerPiece > 0 ? formatPeso(row.profitPerEgg) : '—'}
                        </td>
                        <td className="num" style={{ color: row.marginPercent >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                          {row.sellPerPiece > 0 ? `${row.marginPercent}%` : '—'}
                        </td>
                        <td className="num" style={{ color: 'var(--color-danger)' }}>{row.cogs > 0 ? formatPeso(row.cogs) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="total-row">
                      <td className="size-cell">Total</td>
                      <td colSpan={5}></td>
                      <td className="num" colSpan={2} style={{ fontSize: '0.875rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <span style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                            <span>Revenue:</span>
                            <span className="revenue">{formatPeso(processed.totals.revenue)}</span>
                          </span>
                          <span style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                            <span>Expenses:</span>
                            <span style={{ color: 'var(--color-danger)' }}>{formatPeso(profitData.totalExpenses)}</span>
                          </span>
                          <span style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                            <span>COGS:</span>
                            <span style={{ color: 'var(--color-danger)' }}>{formatPeso(profitData.totalCOGS)}</span>
                          </span>
                          <span style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.25rem' }}>
                            <span style={{ fontWeight: 800 }}>Net Profit:</span>
                            <span style={{ color: profitData.netProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 800 }}>
                              {formatPeso(profitData.netProfit)}
                            </span>
                          </span>
                        </div>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Product Sales section */}
          {(category === 'products' || category === 'both') && productReport.length > 0 && (
            <div className="report-section" style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '2px solid var(--color-border)' }}>
              <h3 className="report-profit-title">Product Sales ({productReport.length})</h3>
              <div className="report-table-wrap">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Category</th>
                      <th className="num">Quantity</th>
                      <th>Unit</th>
                      <th className="num">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const productMap = {};
                      productReport.forEach(sale => {
                        const name = sale.products?.name || 'Unknown';
                        const cat = sale.products?.category || 'Others';
                        if (!productMap[name]) productMap[name] = { name, category: cat, quantity: 0, revenue: 0, unit: sale.products?.unit || 'units' };
                        productMap[name].quantity += parseFloat(sale.quantity || 0);
                        productMap[name].revenue += parseFloat(sale.total_amount || 0);
                      });
                      return Object.values(productMap).map(p => (
                        <tr key={p.name}>
                          <td className="size-cell">{p.name}</td>
                          <td>{p.category}</td>
                          <td className="num">{p.quantity.toLocaleString()}</td>
                          <td>{p.unit}</td>
                          <td className="num revenue">{formatPeso(p.revenue)}</td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                  <tfoot>
                    <tr className="total-row">
                      <td colSpan={2} className="size-cell">Total</td>
                      <td className="num">{productQty.toLocaleString()}</td>
                      <td></td>
                      <td className="num revenue">{formatPeso(productRevenue)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="report-footer">
            Generated on {new Date().toLocaleString('en-US', {
              dateStyle: 'long',
              timeStyle: 'short',
            })}
          </div>
        </div>
      )}

      <style>{`
        .report-controls {
          padding: 1.25rem;
          margin-bottom: 1.25rem;
        }

        .report-category-filter {
          display: flex;
          gap: 0.375rem;
          margin-bottom: 1rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--color-border-light);
        }

        .report-controls-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.875rem;
          margin-bottom: 1rem;
        }

        @media (min-width: 640px) {
          .report-controls-grid {
            grid-template-columns: 1fr 1fr 1fr 1fr;
          }
        }

        .report-shift-group {
          grid-column: 1 / -1;
        }

        @media (min-width: 640px) {
          .report-shift-group {
            grid-column: auto;
          }
        }

        .shift-tabs {
          display: flex;
          gap: 0.375rem;
          flex-wrap: wrap;
        }

        .shift-tab {
          padding: 0.5rem 1rem;
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-sm);
          background: var(--color-card);
          color: var(--color-text-secondary);
          font-size: 0.8125rem;
          font-weight: 500;
          transition: all 0.2s;
          cursor: pointer;
        }

        .shift-tab:hover {
          border-color: var(--color-primary);
          color: var(--color-primary);
        }

        .shift-tab.active {
          background: var(--color-primary);
          border-color: var(--color-primary);
          color: white;
        }

        .report-shift-info {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          padding: 0.5rem 0;
        }

        .btn-generate {
          width: 100%;
        }

        /* Report output */
        .report-output {
          background: white;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 1.5rem;
          box-shadow: var(--shadow-sm);
          animation: fadeIn 0.4s ease-out;
        }

        .report-header {
          text-align: center;
          margin-bottom: 1.5rem;
          padding-bottom: 1rem;
          border-bottom: 2px solid var(--color-primary);
        }

        .report-title {
          font-size: 1.25rem;
          font-weight: 800;
          color: var(--color-primary);
          margin-bottom: 0.5rem;
        }

        .report-meta {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          flex-wrap: wrap;
          font-size: 0.8125rem;
          color: var(--color-text-secondary);
          margin-bottom: 1rem;
        }

        .report-meta span {
          display: flex;
          align-items: center;
          gap: 0.3rem;
        }

        .report-badge {
          background: var(--color-primary);
          color: white;
          padding: 0.15rem 0.6rem;
          border-radius: 999px;
          font-weight: 600;
          font-size: 0.75rem;
        }

        .report-summary {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 0.75rem;
        }

        .report-summary-item {
          background: var(--color-primary-light);
          border-radius: var(--radius-sm);
          padding: 0.625rem 0.75rem;
          text-align: center;
        }

        .report-summary-value {
          display: block;
          font-weight: 700;
          font-size: 1.0625rem;
          color: var(--color-primary);
        }

        .report-summary-label {
          display: block;
          font-size: 0.6875rem;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .report-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          padding: 2.5rem;
          color: var(--color-text-muted);
        }

        .report-table-wrap {
          overflow-x: auto;
          margin-bottom: 1rem;
        }

        .report-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.9375rem;
        }

        .report-table th {
          text-align: left;
          padding: 0.625rem 0.75rem;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-muted);
          background: var(--color-bg);
          border-bottom: 2px solid var(--color-border);
        }

        .report-table th.num,
        .report-table td.num {
          text-align: right;
          white-space: nowrap;
          font-variant-numeric: tabular-nums;
        }

        .report-table td {
          padding: 0.625rem 0.75rem;
          border-bottom: 1px solid var(--color-border);
        }

        .report-table tbody tr:hover {
          background: var(--color-bg);
        }

        .size-cell {
          font-weight: 600;
        }

        .report-table td.revenue,
        .report-table .total-row td.revenue {
          color: var(--color-primary);
          font-weight: 600;
        }

        .total-row td {
          font-weight: 700;
          border-top: 2px solid var(--color-primary);
          border-bottom: none;
          background: var(--color-primary-light);
        }

        .total-row .size-cell {
          font-weight: 800;
        }

        .report-footer {
          text-align: center;
          font-size: 0.75rem;
          color: var(--color-text-muted);
          padding-top: 1rem;
          border-top: 1px solid var(--color-border);
        }

        /* Print styles */
        @media print {
          body { background: white; }
          .sidebar, .mobile-header, .report-controls, .error-banner,
          .page-header-row, .btn { display: none !important; }
          .report-output {
            box-shadow: none;
            border: none;
            padding: 0;
          }
          .report-table th { background: #f5f5f5; }
          .total-row td { background: #f0f0f0; }
        }
      `}</style>
    </div>
  );
}
