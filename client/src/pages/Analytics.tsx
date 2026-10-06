
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Upload, DollarSign, PieChart, TrendingUp, Download, CreditCard, Award } from 'lucide-react';
import { api } from '../lib/api';

const Analytics = () => {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const data = await api.getDashboard();
        setDashboardData(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

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
          <button className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-dark-elevated text-text-primary border border-white/10 hover:border-pastel-lavender transition-all">
            <Upload className="w-4 h-4" /> Import CSV
          </button>
          <button className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold pastel-button">
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

      {/* Charts Area (Mocked for now) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="lg:col-span-2 glass-card p-8 rounded-3xl border border-white/10 flex flex-col items-center justify-center min-h-[400px]"
        >
          <BarChart3 className="w-16 h-16 text-white/10 mb-4" />
          <p className="text-text-muted font-bold">Monthly Spend Chart</p>
          <p className="text-sm text-text-muted/50">(Import data to visualize your spends)</p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="glass-card p-8 rounded-3xl border border-white/10 flex flex-col items-center justify-center min-h-[400px]"
        >
          <PieChart className="w-16 h-16 text-white/10 mb-4" />
          <p className="text-text-muted font-bold">Category Breakdown</p>
        </motion.div>
      </div>
    </div>
  );
};

export default Analytics;
