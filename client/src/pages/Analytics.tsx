import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, Upload, DollarSign, PieChart as PieChartIcon, TrendingUp,
  Download, Award, Sparkles, Filter, Calendar
} from 'lucide-react';
import { api } from '../lib/api';
import { parseCSV } from '../lib/data/csvParser';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import {
  filterTransactionsByDateRange,
  type DateRangePreset,
} from '../lib/engine/dashboardAnalytics';
import { useNavigate } from 'react-router-dom';

const COLORS = ['#C3B1E1', '#B8E6D3', '#F4C2D7', '#FFD6BA', '#BFD7ED', '#FDE2E4', '#E2ECE9'];

function formatINR(n: number) {
  return Math.round(n || 0).toLocaleString('en-IN');
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-dark-surface p-3 rounded-2xl border border-white/10 shadow-2xl text-xs space-y-1">
        <p className="font-bold text-text-primary border-b border-white/5 pb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={`item-${index}`} className="font-semibold flex items-center justify-between gap-3" style={{ color: entry.color || '#C3B1E1' }}>
            <span>{entry.name}:</span>
            <span>₹{Number(entry.value).toLocaleString('en-IN')}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const Analytics = () => {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [engineSource, setEngineSource] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState<DateRangePreset>('ALL_TIME');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [dash, txns] = await Promise.all([
        api.getDashboard().catch(() => null),
        api.getTransactions().catch(() => []),
      ]);
      setDashboardData(dash);
      setTransactions(txns || []);

      if (txns && txns.length > 0) {
        const pyPayload = txns.map((t: any) => ({
          amount: Number(t.amount) || 0,
          category: t.category_id || 'General',
          date: t.date || new Date().toISOString().split('T')[0],
          card: t.user_cards?.credit_cards?.name || t.user_cards?.custom_card_name || 'Card',
          merchant: t.merchant || 'Other',
        }));
        try {
          const summary = await api.getAnalyticsSummary(pyPayload);
          if (summary?.source) {
            setEngineSource(summary.source);
          }
        } catch {
          // fallback handled gracefully
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleExport = () => {
    if (transactions.length === 0) return alert('No transaction data to export');
    const headers = ['Date', 'Merchant', 'Category', 'Amount', 'Reward Earned', 'Cashback Earned'];
    const rows = transactions.map(t => [
      new Date(t.date).toLocaleDateString('en-IN'),
      `"${t.merchant}"`,
      `"${t.category_id || 'General'}"`,
      t.amount,
      t.reward_earned,
      t.cashback_earned,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `cardio_spending_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const parsed = parseCSV(text);
        if (!parsed || parsed.length === 0) {
          alert('Could not parse transactions from CSV. Format: Date, Merchant, Amount, Category');
          setImporting(false);
          return;
        }

        let importedCount = 0;
        for (const row of parsed) {
          const amtKey = Object.keys(row).find(k => k.toLowerCase().includes('amount') || k.toLowerCase().includes('spend'));
          const merchantKey = Object.keys(row).find(k => k.toLowerCase().includes('merchant') || k.toLowerCase().includes('name') || k.toLowerCase().includes('description'));
          const catKey = Object.keys(row).find(k => k.toLowerCase().includes('category'));
          const dateKey = Object.keys(row).find(k => k.toLowerCase().includes('date'));

          const amountVal = amtKey ? Number(row[amtKey]) : NaN;
          const merchantVal = merchantKey ? row[merchantKey] : 'Imported Purchase';
          const catVal = catKey ? row[catKey] : 'Shopping';
          const dateVal = dateKey && row[dateKey] ? row[dateKey] : new Date().toISOString().split('T')[0];

          if (!isNaN(amountVal) && amountVal > 0) {
            await api.addTransaction({
              merchant: merchantVal,
              amount: amountVal,
              category_id: catVal,
              date: dateVal,
            });
            importedCount++;
          }
        }

        alert(`Successfully imported ${importedCount} transactions!`);
        fetchData();
      } catch (err: any) {
        alert('Import failed: ' + err.message);
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsText(file);
  };

  // Filtered transactions by selected date preset
  const filteredTxns = useMemo(() => {
    return filterTransactionsByDateRange(transactions, { preset: datePreset });
  }, [transactions, datePreset]);

  // Process data for charts using actual user transactions
  const barData = useMemo(() => {
    const monthlyDataMap = new Map<string, { spend: number; count: number }>();
    filteredTxns.forEach(t => {
      if (t.date) {
        const month = t.date.slice(0, 7); // YYYY-MM
        const curr = monthlyDataMap.get(month) || { spend: 0, count: 0 };
        curr.spend += Number(t.amount) || 0;
        curr.count += 1;
        monthlyDataMap.set(month, curr);
      }
    });

    return Array.from(monthlyDataMap.entries())
      .map(([name, data]) => ({ name, spend: Math.round(data.spend), count: data.count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredTxns]);

  const pieData = useMemo(() => {
    const categoryDataMap = new Map<string, number>();
    let total = 0;
    filteredTxns.forEach(t => {
      const cat = t.category_id || 'General';
      const amt = Number(t.amount) || 0;
      categoryDataMap.set(cat, (categoryDataMap.get(cat) || 0) + amt);
      total += amt;
    });

    return Array.from(categoryDataMap.entries())
      .map(([name, value]) => ({
        name,
        value: Math.round(value),
        pct: total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTxns]);

  const topMerchantsData = useMemo(() => {
    const merchMap = new Map<string, { spend: number; count: number }>();
    filteredTxns.forEach(t => {
      const merch = (t.merchant || 'Other').trim();
      const curr = merchMap.get(merch) || { spend: 0, count: 0 };
      curr.spend += Number(t.amount) || 0;
      curr.count += 1;
      merchMap.set(merch, curr);
    });

    return Array.from(merchMap.entries())
      .map(([name, data]) => ({ name, spend: Math.round(data.spend), count: data.count }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 6);
  }, [filteredTxns]);

  const stats = [
    { label: 'Current Month Spend', value: `₹${formatINR(dashboardData?.currentMonthSpend || dashboardData?.monthlySpends || 0)}`, icon: DollarSign, color: 'text-pastel-lavender' },
    { label: 'Yearly Spend', value: `₹${formatINR(dashboardData?.currentYearSpend || 0)}`, icon: Calendar, color: 'text-pastel-mint' },
    { label: 'Confirmed Points', value: `+${(dashboardData?.confirmedPoints || dashboardData?.totalRewards || 0).toLocaleString('en-IN')}`, icon: TrendingUp, color: 'text-pastel-pink' },
    { label: 'Confirmed Savings', value: `₹${formatINR(dashboardData?.confirmedSavings || 0)}`, icon: Award, color: 'text-pastel-peach' },
  ];

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto min-h-screen space-y-8">
      {/* Top Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-display font-bold text-text-primary flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-pastel-mint" />
              Spending Analytics
            </h1>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
              engineSource === 'fastapi'
                ? 'bg-pastel-mint/15 text-pastel-mint border border-pastel-mint/30'
                : 'bg-white/10 text-text-muted border border-white/10'
            }`}>
              <Sparkles className="w-3.5 h-3.5" />
              {engineSource === 'fastapi' ? 'Python FastAPI + Pandas Active' : 'Node Fallback Engine'}
            </span>
          </div>
          <p className="text-text-muted font-medium text-sm mt-1">
            Historical transaction analysis, category distribution, and statement importing.
          </p>
        </div>

        {/* Action Buttons: Import / Export */}
        <div className="flex gap-3 items-center">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv"
            className="hidden"
          />
          <button
            onClick={handleImportClick}
            disabled={importing}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold bg-dark-elevated text-text-primary border border-white/10 hover:border-pastel-lavender transition-all disabled:opacity-50 text-xs"
          >
            <Upload className="w-4 h-4" /> {importing ? 'Importing CSV...' : 'Import Statement'}
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold pastel-button text-xs"
          >
            <Download className="w-4 h-4" /> Export CSV Report
          </button>
        </div>
      </header>

      {/* KPI Cards Row */}
      {loading ? (
        <div className="flex justify-center my-10">
          <div className="animate-spin w-8 h-8 border-4 border-pastel-lavender border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, idx) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08 }}
                className="glass-card p-5 rounded-3xl border border-white/10 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-text-muted font-bold uppercase tracking-wider text-[11px]">{stat.label}</p>
                  <div className="p-2.5 rounded-2xl bg-dark-surface border border-white/5">
                    <Icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                </div>
                <h2 className="text-2xl md:text-3xl font-display font-bold text-text-primary">{stat.value}</h2>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Date Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-xs font-bold text-text-muted mr-1 flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5" /> Date Range:
        </span>
        {[
          { id: 'LAST_7_DAYS', label: 'Last 7 Days' },
          { id: 'LAST_30_DAYS', label: 'Last 30 Days' },
          { id: 'LAST_3_MONTHS', label: 'Last 3 Months' },
          { id: 'LAST_6_MONTHS', label: 'Last 6 Months' },
          { id: 'THIS_YEAR', label: 'This Year' },
          { id: 'ALL_TIME', label: 'All Time' },
        ].map(p => (
          <button
            key={p.id}
            onClick={() => setDatePreset(p.id as DateRangePreset)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              datePreset === p.id
                ? 'bg-pastel-mint text-dark-base shadow-[0_0_10px_rgba(182,240,214,0.3)]'
                : 'bg-dark-surface text-text-muted hover:text-white border border-white/5'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Main Charts Area */}
      {transactions.length === 0 ? (
        <div className="p-16 text-center border border-dashed border-white/10 rounded-3xl text-text-muted space-y-4">
          <BarChart3 className="w-12 h-12 mx-auto opacity-30 text-pastel-mint" />
          <h3 className="text-xl font-bold text-text-primary">No Transactions Recorded Yet</h3>
          <p className="text-xs max-w-md mx-auto">
            Add transactions in the Transactions module or import a CSV statement above to generate personal spending charts and insights.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <button onClick={() => navigate('/transactions')} className="pastel-button px-6 py-2.5 text-xs font-bold">
              Add Transaction →
            </button>
            <button onClick={handleImportClick} className="bg-dark-elevated text-text-primary border border-white/10 px-5 py-2.5 rounded-xl text-xs font-bold">
              Import CSV File
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Monthly Spend Bar Chart */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="lg:col-span-2 glass-card p-6 md:p-8 rounded-3xl border border-white/10 flex flex-col justify-between min-h-[380px]"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-pastel-lavender" />
                  Monthly Spending Velocity
                </h3>
                <p className="text-xs text-text-muted">Calculated from actual user transactions</p>
              </div>
              <span className="text-xs font-bold text-pastel-lavender">
                {barData.length} Months
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2D2D42" vertical={false} />
                  <XAxis dataKey="name" stroke="#A5A3B8" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#A5A3B8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `₹${v >= 1000 ? `${v / 1000}k` : v}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="spend" name="Spend" fill="#C3B1E1" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Category Distribution Donut Chart */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card p-6 md:p-8 rounded-3xl border border-white/10 flex flex-col justify-between min-h-[380px]"
          >
            <div>
              <h3 className="text-base font-bold text-text-primary flex items-center gap-2 mb-1">
                <PieChartIcon className="w-5 h-5 text-pastel-pink" />
                Category Distribution
              </h3>
              <p className="text-xs text-text-muted">Percentage of total spend</p>
            </div>

            <div className="h-52 w-full flex items-center justify-center my-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-1.5 text-xs">
              {pieData.slice(0, 4).map((entry, index) => (
                <div key={entry.name} className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-text-muted">{entry.name}</span>
                  </span>
                  <span className="font-bold text-text-primary">₹{formatINR(entry.value)} ({entry.pct}%)</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Top Merchants Table */}
          {topMerchantsData.length > 0 && (
            <div className="col-span-full glass-card p-6 rounded-3xl border border-white/10 space-y-4">
              <h3 className="text-base font-bold text-text-primary">Top Merchants Concentration</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {topMerchantsData.map((m, i) => (
                  <div key={m.name} className="p-3.5 rounded-2xl bg-dark-surface/60 border border-white/5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center font-bold text-[10px] text-text-muted">
                        #{i + 1}
                      </span>
                      <div>
                        <div className="font-bold text-text-primary text-sm">{m.name}</div>
                        <div className="text-[10px] text-text-muted">{m.count} transaction{m.count > 1 ? 's' : ''}</div>
                      </div>
                    </div>
                    <div className="font-bold text-pastel-mint text-sm">
                      ₹{formatINR(m.spend)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Analytics;
