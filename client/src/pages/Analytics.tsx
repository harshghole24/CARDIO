import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Upload, DollarSign, PieChart as PieChartIcon, TrendingUp, Download, CreditCard, Award } from 'lucide-react';
import { api } from '../lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#C3B1E1', '#F4C2D7', '#B8E6D3', '#FFD6BA', '#BFD7ED', '#A5A3B8'];

const Analytics = () => {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dash, txns] = await Promise.all([
          api.getDashboard(),
          api.getTransactions()
        ]);
        setDashboardData(dash);
        setTransactions(txns || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleExport = () => {
    if (transactions.length === 0) return alert("No data to export");
    const headers = ['Date', 'Merchant', 'Amount', 'Reward Earned', 'Cashback Earned'];
    const rows = transactions.map(t => [
      new Date(t.date).toLocaleDateString(),
      t.merchant,
      t.amount,
      t.reward_earned,
      t.cashback_earned
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "cardio_spends.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = () => {
    alert("CSV Import: To keep this demo simple, please use the Add Transaction button in the Transactions tab to add data manually.");
  };

  // Process data for charts
  const monthlyDataMap = new Map<string, number>();
  const categoryDataMap = new Map<string, number>();

  transactions.forEach(t => {
    // Month
    const date = new Date(t.date);
    const month = date.toLocaleString('default', { month: 'short' });
    monthlyDataMap.set(month, (monthlyDataMap.get(month) || 0) + Number(t.amount));

    // Category
    const cat = t.merchant; // In a real app we'd map merchant to category
    categoryDataMap.set(cat, (categoryDataMap.get(cat) || 0) + Number(t.amount));
  });

  const barData = Array.from(monthlyDataMap.entries()).map(([name, spend]) => ({ name, spend })).reverse();
  const pieData = Array.from(categoryDataMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5); // top 5 merchants/categories

  // Fallback demo data
  const finalBarData = barData.length > 0 ? barData : [
    { name: 'Jan', spend: 40000 }, { name: 'Feb', spend: 30000 }, { name: 'Mar', spend: 55000 },
    { name: 'Apr', spend: 20000 }, { name: 'May', spend: 45000 }, { name: 'Jun', spend: 35000 }
  ];
  const finalPieData = pieData.length > 0 ? pieData : [
    { name: 'Travel', value: 400 }, { name: 'Dining', value: 300 }, { name: 'Shopping', value: 300 }, { name: 'Grocery', value: 200 }
  ];

  const stats = [
    { label: 'Monthly Spends', value: `₹${(dashboardData?.monthlySpends || 0).toLocaleString()}`, icon: DollarSign, color: 'text-pastel-lavender' },
    { label: 'Points Accrued', value: (dashboardData?.totalRewards || 0).toLocaleString(), icon: TrendingUp, color: 'text-pastel-mint' },
    { label: 'Total Cashback', value: `₹${(dashboardData?.totalCashback || 0).toLocaleString()}`, icon: Award, color: 'text-pastel-pink' },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen">
      <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-text-primary mb-2 flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-pastel-mint" />
            Spend Analytics
          </h1>
          <p className="text-text-muted font-medium">Track your credit card expenses and reward accrual.</p>
        </div>
        <div className="flex gap-4">
          <button onClick={handleImport} className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-dark-elevated text-text-primary border border-white/10 hover:border-pastel-lavender transition-all">
            <Upload className="w-4 h-4" /> Import CSV
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold pastel-button">
            <Download className="w-4 h-4" /> Export Report
          </button>
        </div>
      </header>

      {/* KPI Cards */}
      {loading ? (
        <div className="flex justify-center my-10"><div className="animate-spin w-8 h-8 border-4 border-pastel-lavender border-t-transparent rounded-full"></div></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="glass-card p-6 rounded-3xl border border-white/10"
            >
              <div className="flex items-center justify-between mb-4">
                <p className="text-text-muted font-bold uppercase tracking-wider text-sm">{stat.label}</p>
                <div className={`p-3 rounded-2xl bg-dark-surface border border-white/5`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
              <h2 className="text-4xl font-display font-black text-text-primary">{stat.value}</h2>
            </motion.div>
          )
        })}
      </div>
      )}

      {/* Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="lg:col-span-2 glass-card p-8 rounded-3xl border border-white/10 flex flex-col min-h-[400px]"
        >
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-pastel-lavender" /> 
            Monthly Spend {barData.length === 0 && <span className="text-xs bg-white/10 px-2 py-1 rounded text-text-muted">Demo Data</span>}
          </h3>
          <div className="flex-1 w-full h-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={finalBarData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                <XAxis dataKey="name" stroke="#A5A3B8" tick={{fill: '#A5A3B8'}} axisLine={false} tickLine={false} />
                <YAxis stroke="#A5A3B8" tick={{fill: '#A5A3B8'}} axisLine={false} tickLine={false} tickFormatter={(val) => `₹${val/1000}k`} />
                <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{backgroundColor: '#1A1A2E', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px'}} />
                <Bar dataKey="spend" fill="#C3B1E1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="glass-card p-8 rounded-3xl border border-white/10 flex flex-col min-h-[400px]"
        >
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <PieChartIcon className="w-5 h-5 text-pastel-pink" /> 
            Top Categories {pieData.length === 0 && <span className="text-xs bg-white/10 px-2 py-1 rounded text-text-muted">Demo Data</span>}
          </h3>
          <div className="flex-1 w-full h-full min-h-[300px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={finalPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {finalPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{backgroundColor: '#1A1A2E', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px'}} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            {finalPieData.map((entry, index) => (
              <div key={index} className="flex items-center gap-2 text-xs">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                <span className="text-text-muted">{entry.name}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Analytics;
