import { useState } from 'react';
import {
  FileText,
  Calendar,
  Clock,
  AlertTriangle,
  RefreshCw,
  Printer,
  Download,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { fetchSalesReport, fetchExpenses, fetchSpoilageWithCost, fetchCustomers, formatPeso, EGG_SIZES, TRAY_SIZE } from '../lib/api';
import { getUserFriendlyError } from '../lib/errors';

const SHIFTS = [
  { label: 'Morning', start: '06:00', end: '14:00', desc: '6:00 AM - 2:00 PM' },
  { label: 'Afternoon', start: '14:00', end: '22:00', desc: '2:00 PM - 10:00 PM' },
  { label: 'Whole Day', start: '00:00', end: '23:59', desc: 'All day' },
  { label: 'Custom', start: '', end: '', desc: 'Set your own times' },
];

function todayStr() {
  return new Date().toISOString().split('T')[0];
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
  const [reportExpenses, setReportExpenses] = useState([]);
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
      const [salesData, expensesData] = await Promise.all([
        fetchSalesReport({ startDate, endDate, startTime, endTime }),
        fetchExpenses({ startDate, endDate }),
      ]);
      setReport(salesData || []);
      setReportExpenses(expensesData || []);
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
      const spoilageData = await fetchSpoilageWithCost({ startDate, endDate, limit: 500 });
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
    } catch {
      // skip spoilage data if fetch fails
    }

    // Add customers section
    try {
      const customersData = await fetchCustomers();
      if (customersData && customersData.length > 0) {
        rows.push([], ['=== CUSTOMERS ==='], ['Name', 'Phone', 'Notes']);
        customersData.forEach(c => {
          rows.push([c.name, c.phone || '', (c.notes || '').replace(/,/g, ';')]);
        });
      }
    } catch {
      // skip customers data if fetch fails
    }

    const csvContent = rows.map(row => row.join(',')).join('\n');
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

  function formatTime(t) {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  }

  const processed = processReport();

  const totalExpenses = reportExpenses.reduce(
    (sum, e) => sum + parseFloat(e.amount || 0),
    0
  );
  const netProfit = processed ? processed.totals.revenue - totalExpenses : 0;

  const expenseByCategory = {};
  reportExpenses.forEach(e => {
    const cat = e.category;
    expenseByCategory[cat] = (expenseByCategory[cat] || 0) + parseFloat(e.amount || 0);
  });

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
      {processed && (
        <div className="report-output">
          {/* Report header */}
          <div className="report-header">
            <h2 className="report-title">M&E Fresh Eggs — Sales Report</h2>
            <div className="report-meta">
              <span><Calendar size={14} /> {startDate} — {endDate}</span>
              <span><Clock size={14} /> {formatTime(startTime)} — {formatTime(endTime)}</span>
              <span className="report-badge">Shift: {SHIFTS[activeShift].label}</span>
            </div>
            <div className="report-summary">
              <div className="report-summary-item">
                <span className="report-summary-value">{processed.totals.totalEggs.toLocaleString()}</span>
                <span className="report-summary-label">Total Eggs Sold</span>
              </div>
              <div className="report-summary-item">
                <span className="report-summary-value">{formatPeso(processed.totals.revenue)}</span>
                <span className="report-summary-label">Total Revenue</span>
              </div>
              <div className="report-summary-item">
                <span className="report-summary-value">{processed.totals.salesCount}</span>
                <span className="report-summary-label">Transactions</span>
              </div>
              <div className="report-summary-item">
                <span className="report-summary-value">{processed.totals.trays}</span>
                <span className="report-summary-label">Trays Sold</span>
              </div>
              <div className="report-summary-item">
                <span className="report-summary-value">{processed.totals.pieces}</span>
                <span className="report-summary-label">Pieces Sold</span>
              </div>
            </div>
          </div>

          {/* Report table */}
          {processed.rows.length === 0 ? (
            <div className="report-empty">
              <FileText size={36} />
              <p>No sales found for this period and shift.</p>
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

          {/* Expense vs Revenue */}
          {reportExpenses.length > 0 && (
            <div className="report-profit-section">
              <h3 className="report-profit-title">Revenue vs Expenses</h3>
              <div className="report-profit-grid">
                <div className="report-profit-card report-profit-revenue">
                  <TrendingUp size={20} />
                  <div>
                    <span className="report-profit-value">{formatPeso(processed.totals.revenue)}</span>
                    <span className="report-profit-label">Total Revenue</span>
                  </div>
                </div>
                <div className="report-profit-card report-profit-expense">
                  <TrendingDown size={20} />
                  <div>
                    <span className="report-profit-value">{formatPeso(totalExpenses)}</span>
                    <span className="report-profit-label">Total Expenses</span>
                  </div>
                </div>
                <div className="report-profit-card report-profit-net">
                  <span className="report-profit-icon">{netProfit >= 0 ? '📈' : '📉'}</span>
                  <div>
                    <span className="report-profit-value" style={{ color: netProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {formatPeso(netProfit)}
                    </span>
                    <span className="report-profit-label">Net Profit</span>
                  </div>
                </div>
              </div>

              {/* Expense breakdown */}
              {Object.keys(expenseByCategory).length > 0 && (
                <div className="report-expense-breakdown">
                  <h4 style={{ fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--color-text-secondary)' }}>Expense Breakdown</h4>
                  <div className="report-expense-grid">
                    {Object.entries(expenseByCategory).map(([cat, total]) => (
                      <div key={cat} className="report-expense-item">
                        <span className="report-expense-cat">{cat}</span>
                        <span className="report-expense-amount">{formatPeso(total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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

        /* Revenue vs Expenses */
        .report-profit-section {
          margin-top: 1.5rem;
          padding-top: 1.5rem;
          border-top: 2px solid var(--color-border);
        }

        .report-profit-title {
          font-size: 1.0625rem;
          font-weight: 700;
          color: var(--color-text);
          margin-bottom: 0.75rem;
        }

        .report-profit-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 0.75rem;
          margin-bottom: 1rem;
        }

        .report-profit-card {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.875rem 1rem;
          background: var(--color-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
        }

        .report-profit-card svg { flex-shrink: 0; }
        .report-profit-revenue svg { color: var(--color-success); }
        .report-profit-expense svg { color: var(--color-danger); }
        .report-profit-icon { font-size: 1.25rem; }

        .report-profit-value {
          display: block;
          font-weight: 700;
          font-size: 1.0625rem;
        }

        .report-profit-label {
          display: block;
          font-size: 0.6875rem;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .report-expense-breakdown {
          background: var(--color-bg);
          border-radius: var(--radius-sm);
          padding: 1rem;
        }

        .report-expense-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .report-expense-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.4rem 0.75rem;
          background: var(--color-card);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-sm);
          font-size: 0.8125rem;
        }

        .report-expense-cat {
          font-weight: 500;
          color: var(--color-text-secondary);
        }

        .report-expense-amount {
          font-weight: 700;
          color: var(--color-danger);
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
