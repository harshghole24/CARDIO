import { useEffect, useState, useMemo } from 'react';
import {
  CreditCard, Plane, Wallet, TrendingUp, Sparkles, Award, Plus, ArrowRight,
  Clock, ChevronRight, BarChart3, BookmarkCheck, ArrowUpRight,
  TrendingDown, Layers
} from 'lucide-react';
import { motion, type Variants } from 'framer-motion';
import { api } from '../lib/api';
import { useDataStore } from '../lib/data/DataContext';
import { useNavigate } from 'react-router-dom';
import {
  computeDashboardKPIs,
  computeCardPerformanceMetrics,
  computeOfferPerformanceMetrics,
  calculateTravelGoalProgress,
  filterTransactions,
  type DateRangePreset,
  type DateFilterOptions,
} from '../lib/engine/dashboardAnalytics';
import type { OfferRedemptionRow } from '../lib/data/schemas';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';

const PALETTE = ['#C3B1E1', '#B8E6D3', '#F4C2D7', '#FFD6BA', '#BFD7ED', '#FDE2E4', '#E2ECE9'];

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

const Dashboard = ({ session }: { session: any }) => {
  const navigate = useNavigate();
  const { store } = useDataStore();
  const [loading, setLoading] = useState(true);

  // Active View Tab: OVERVIEW | SPENDING | PERFORMANCE
  const [dashboardTab, setDashboardTab] = useState<'OVERVIEW' | 'SPENDING' | 'PERFORMANCE'>('OVERVIEW');

  // Real data states from Supabase & API
  const [userCards, setUserCards] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [redemptions, setRedemptions] = useState<OfferRedemptionRow[]>([]);
  const [travelGoals, setTravelGoals] = useState<any[]>([]);
  const [recommendation, setRecommendation] = useState<any>(null);
  const [analyticsSource, setAnalyticsSource] = useState<string>('node_fallback');

  // Spending Filter States
  const [datePreset, setDatePreset] = useState<DateRangePreset>('LAST_30_DAYS');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [cardFilter, setCardFilter] = useState('ALL');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [cardsRes, txnsRes, redempRes, goalsRes, recRes] = await Promise.all([
        api.getCards().catch(() => []),
        api.getTransactions().catch(() => []),
        api.getOfferRedemptions().catch(() => []),
        api.getTravelGoals().catch(() => []),
        api.getRecommendation(5000, 'Travel').catch(() => null),
      ]);

      const enrichedCards = (cardsRes || []).map((c: any) => ({
        ...c,
        credit_cards: store?.cardById.get(c.card_id),
      }));

      const enrichedTxns = (txnsRes || []).map((t: any) => {
        if (t.user_cards) {
          t.user_cards.credit_cards = store?.cardById.get(t.user_cards.card_id);
        }
        return t;
      });

      setUserCards(enrichedCards);
      setTransactions(enrichedTxns);
      setRedemptions(redempRes || []);
      setTravelGoals(goalsRes || []);
      if (recRes && recRes.recommended) {
        setRecommendation(recRes);
      }

      // Try pinging Python analytics proxy
      if (enrichedTxns.length > 0) {
        const pyPayload = enrichedTxns.map((t: any) => ({
          amount: Number(t.amount) || 0,
          category: t.category_id || 'General',
          date: t.date || new Date().toISOString().split('T')[0],
          card: t.user_cards?.credit_cards?.name || t.user_cards?.custom_card_name || 'Card',
          merchant: t.merchant || 'Other',
        }));
        try {
          const summary = await api.getAnalyticsSummary(pyPayload);
          if (summary?.source) {
            setAnalyticsSource(summary.source);
          }
        } catch {
          // Graceful fallback
        }
      }
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (store) fetchData();
  }, [store]);

  // Financial KPI calculations
  const kpis = useMemo(() => {
    return computeDashboardKPIs(
      transactions,
      userCards,
      redemptions,
      store?.cardById || new Map()
    );
  }, [transactions, userCards, redemptions, store]);

  // Card Performance Metrics
  const cardMetrics = useMemo(() => {
    return computeCardPerformanceMetrics(
      userCards,
      transactions,
      redemptions,
      store?.cardById || new Map()
    );
  }, [userCards, transactions, redemptions, store]);

  // Offer Performance Metrics
  const offerMetrics = useMemo(() => {
    return computeOfferPerformanceMetrics(
      redemptions,
      store?.offers || [],
      store?.cardById || new Map()
    );
  }, [redemptions, store]);

  // Travel Goal Progress
  const activeTravelGoal = travelGoals[0] || null;
  const travelGoalProgress = useMemo(() => {
    if (!activeTravelGoal) return null;
    return calculateTravelGoalProgress(activeTravelGoal, kpis.confirmedRewardPoints);
  }, [activeTravelGoal, kpis.confirmedRewardPoints]);

  // Date Filter Options
  const dateFilterOptions: DateFilterOptions = useMemo(() => {
    return {
      preset: datePreset,
      startDate: customStart || undefined,
      endDate: customEnd || undefined,
    };
  }, [datePreset, customStart, customEnd]);

  // Filtered transactions for Spending tab
  const filteredTransactions = useMemo(() => {
    return filterTransactions(transactions, {
      dateFilter: dateFilterOptions,
      category: categoryFilter,
      userCardId: cardFilter,
    });
  }, [transactions, dateFilterOptions, categoryFilter, cardFilter]);

  // Spending Visualizations Data
  const monthlySpendingChartData = useMemo(() => {
    const monthMap = new Map<string, { amount: number; count: number }>();
    for (const t of filteredTransactions) {
      if (t.date) {
        const monthKey = t.date.slice(0, 7); // YYYY-MM
        const curr = monthMap.get(monthKey) || { amount: 0, count: 0 };
        curr.amount += Number(t.amount) || 0;
        curr.count += 1;
        monthMap.set(monthKey, curr);
      }
    }
    return Array.from(monthMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, data]) => ({
        month,
        spend: Math.round(data.amount),
        count: data.count,
      }));
  }, [filteredTransactions]);

  const categorySpendingChartData = useMemo(() => {
    const catMap = new Map<string, number>();
    let total = 0;
    for (const t of filteredTransactions) {
      const cat = t.category_id || 'General';
      const amt = Number(t.amount) || 0;
      catMap.set(cat, (catMap.get(cat) || 0) + amt);
      total += amt;
    }
    return Array.from(catMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({
        name,
        value: Math.round(value),
        pct: total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0,
      }));
  }, [filteredTransactions]);

  const merchantSpendingData = useMemo(() => {
    const merchMap = new Map<string, { spend: number; count: number }>();
    for (const t of filteredTransactions) {
      const merch = (t.merchant || 'Other').trim();
      const curr = merchMap.get(merch) || { spend: 0, count: 0 };
      curr.spend += Number(t.amount) || 0;
      curr.count += 1;
      merchMap.set(merch, curr);
    }
    return Array.from(merchMap.entries())
      .sort((a, b) => b[1].spend - a[1].spend)
      .slice(0, 8)
      .map(([name, data]) => ({
        name,
        spend: Math.round(data.spend),
        count: data.count,
        avg: Math.round(data.spend / data.count),
      }));
  }, [filteredTransactions]);

  const dayOfWeekData = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts = [0, 0, 0, 0, 0, 0, 0];
    const totals = [0, 0, 0, 0, 0, 0, 0];

    for (const t of filteredTransactions) {
      if (t.date) {
        const d = new Date(t.date);
        if (!isNaN(d.getTime())) {
          const idx = d.getDay();
          totals[idx] += Number(t.amount) || 0;
          counts[idx] += 1;
        }
      }
    }
    return days.map((day, i) => ({
      day,
      spend: Math.round(totals[i]),
      count: counts[i],
    }));
  }, [filteredTransactions]);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-dark-base">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-pastel-lavender/30 border-t-pastel-lavender rounded-full animate-spin" />
          <p className="text-text-muted font-medium text-sm">Aggregating portfolio & analytics...</p>
        </div>
      </div>
    );
  }

  // --- EMPTY ONBOARDING STATE ---
  if (userCards.length === 0) {
    return (
      <div className="relative p-8 max-w-4xl mx-auto min-h-screen flex flex-col justify-center">
        <div className="absolute top-0 right-0 w-96 h-96 bg-pastel-lavender/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob pointer-events-none" />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 glass-card p-12 text-center">
          <div className="w-20 h-20 bg-dark-elevated rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border border-white/5">
            <Sparkles className="w-10 h-10 text-pastel-pink" />
          </div>
          <h1 className="text-4xl font-display font-bold text-text-primary mb-4">Welcome to CardIO</h1>
          <p className="text-lg text-text-muted mb-8 max-w-lg mx-auto">
            Let's build your optimized credit card portfolio. Add your first credit card to unlock personalized offer matching, rewards tracking, and analytics.
          </p>
          <button onClick={() => navigate('/cards')} className="pastel-button px-8 py-4 inline-flex items-center gap-2 font-bold">
            Add Your First Card <ArrowRight className="w-5 h-5" />
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative p-6 md:p-8 max-w-7xl mx-auto min-h-screen">
      {/* Ambient background glows */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-pastel-lavender/15 rounded-full filter blur-[100px] pointer-events-none" />
      <div className="absolute top-0 -right-4 w-72 h-72 bg-pastel-pink/15 rounded-full filter blur-[100px] pointer-events-none" />

      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="relative z-10 space-y-8">
        {/* Header with Title and Mode Switcher */}
        <motion.header variants={itemVariants} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-dark-elevated border border-pastel-lavender/30 text-pastel-lavender text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Personal Finance & Rewards Intelligence</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-display font-bold text-text-primary tracking-tight">
              Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-pastel-lavender to-pastel-pink">{session?.user?.user_metadata?.full_name?.split(' ')[0] || 'Explorer'}</span>
            </h1>
            <p className="text-sm text-text-muted font-medium mt-1">
              Real-time portfolio overview, verified savings, and spending performance.
            </p>
          </div>

          {/* Navigation Pill Tabs */}
          <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-dark-elevated border border-white/10 self-start md:self-auto overflow-x-auto">
            <button
              onClick={() => setDashboardTab('OVERVIEW')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                dashboardTab === 'OVERVIEW'
                  ? 'bg-pastel-lavender text-dark-base shadow-[0_0_15px_rgba(230,230,250,0.3)]'
                  : 'text-text-muted hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Overview & KPIs</span>
            </button>

            <button
              onClick={() => setDashboardTab('SPENDING')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                dashboardTab === 'SPENDING'
                  ? 'bg-pastel-mint text-dark-base shadow-[0_0_15px_rgba(182,240,214,0.3)]'
                  : 'text-text-muted hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Spending Analytics</span>
            </button>

            <button
              onClick={() => setDashboardTab('PERFORMANCE')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                dashboardTab === 'PERFORMANCE'
                  ? 'bg-pastel-pink text-dark-base shadow-[0_0_15px_rgba(244,194,215,0.3)]'
                  : 'text-text-muted hover:text-white'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Card & Offer Performance</span>
            </button>
          </div>
        </motion.header>

        {/* ────────────────── PHASE 2: DASHBOARD KPI SUMMARY CARDS ────────────────── */}
        <motion.section variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3.5">
          {/* 1. This Month Spend with MoM comparison */}
          <div className="col-span-2 sm:col-span-1 lg:col-span-2 p-5 rounded-3xl bg-dark-elevated border border-white/10 flex flex-col justify-between group hover:border-pastel-lavender/30 transition-all">
            <div className="flex items-center justify-between text-xs text-text-muted font-bold uppercase tracking-wider mb-2">
              <span>This Month Spend</span>
              <Wallet className="w-4 h-4 text-pastel-lavender" />
            </div>
            <div>
              <div className="text-3xl font-display font-bold text-text-primary tracking-tight">
                ₹{formatINR(kpis.currentMonthSpend)}
              </div>
              <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold">
                {kpis.spendChangeMoM !== null ? (
                  kpis.spendChangeMoM >= 0 ? (
                    <span className="text-pastel-peach flex items-center gap-0.5">
                      <TrendingUp className="w-3 h-3" /> +{kpis.spendChangeMoM}% vs last mo.
                    </span>
                  ) : (
                    <span className="text-pastel-mint flex items-center gap-0.5">
                      <TrendingDown className="w-3 h-3" /> {kpis.spendChangeMoM}% vs last mo.
                    </span>
                  )
                ) : (
                  <span className="text-text-muted">Prev Mo: ₹{formatINR(kpis.prevMonthSpend)}</span>
                )}
              </div>
            </div>
          </div>

          {/* 2. Total Spend This Year */}
          <div className="p-4 rounded-3xl bg-dark-elevated border border-white/10 flex flex-col justify-between">
            <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">
              Spend This Year
            </div>
            <div>
              <div className="text-2xl font-display font-bold text-text-primary">
                ₹{formatINR(kpis.currentYearSpend)}
              </div>
              <p className="text-[10px] text-text-muted mt-1">Calendar Year {new Date().getFullYear()}</p>
            </div>
          </div>

          {/* 3. Confirmed Savings */}
          <div className="p-4 rounded-3xl bg-gradient-to-br from-pastel-mint/15 to-transparent border border-pastel-mint/40 flex flex-col justify-between">
            <div className="text-[11px] font-bold text-pastel-mint uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Confirmed Savings</span>
              <Award className="w-3.5 h-3.5 text-pastel-mint" />
            </div>
            <div>
              <div className="text-2xl font-display font-bold text-pastel-mint">
                ₹{formatINR(kpis.confirmedSavingsINR)}
              </div>
              <p className="text-[10px] text-text-muted mt-1">Discounts, cashback & points</p>
            </div>
          </div>

          {/* 4. Pending Cashback */}
          <div className="p-4 rounded-3xl bg-dark-elevated border border-pastel-peach/30 flex flex-col justify-between">
            <div className="text-[11px] font-bold text-pastel-peach uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Pending Cashback</span>
              <Clock className="w-3.5 h-3.5 text-pastel-peach" />
            </div>
            <div>
              <div className="text-2xl font-display font-bold text-pastel-peach">
                ₹{formatINR(kpis.pendingCashbackINR)}
              </div>
              <p className="text-[10px] text-text-muted mt-1">Awaiting statement credit</p>
            </div>
          </div>

          {/* 5. Confirmed Reward Points */}
          <div className="p-4 rounded-3xl bg-dark-elevated border border-white/10 flex flex-col justify-between">
            <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">
              Confirmed Points
            </div>
            <div>
              <div className="text-2xl font-display font-bold text-pastel-pink">
                +{kpis.confirmedRewardPoints.toLocaleString('en-IN')}
              </div>
              <p className="text-[10px] text-text-muted mt-1">
                ~₹{formatINR(kpis.confirmedRewardPointsValueINR)} valuation
              </p>
            </div>
          </div>

          {/* 6. Active Cards & Redeemed Offers */}
          <div className="p-4 rounded-3xl bg-dark-elevated border border-white/10 flex flex-col justify-between">
            <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Portfolio</span>
              <CreditCard className="w-3.5 h-3.5 text-pastel-lavender" />
            </div>
            <div>
              <div className="text-2xl font-display font-bold text-text-primary">
                {kpis.activeCardsCount} <span className="text-xs font-normal text-text-muted">Cards</span>
              </div>
              <p className="text-[10px] text-text-muted mt-1">
                {kpis.redeemedOffersCount} offers redeemed
              </p>
            </div>
          </div>
        </motion.section>

        {/* ────────────────── TAB 1: OVERVIEW & ACTIVITY ────────────────── */}
        {dashboardTab === 'OVERVIEW' && (
          <div className="space-y-8">
            {/* Travel Goal Hero Widget */}
            {travelGoalProgress ? (
              <motion.div variants={itemVariants} className="bg-gradient-to-br from-[#232340] via-[#1A1A2E] to-[#0F0F1A] rounded-3xl p-6 md:p-8 text-white border border-white/10 relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-96 h-96 bg-pastel-blue/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row justify-between gap-6 items-center">
                  <div className="flex-1 w-full">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-pastel-blue text-xs font-bold uppercase tracking-wider mb-4">
                      <Plane className="w-3.5 h-3.5" /> Active Travel Goal
                    </div>
                    <h2 className="text-3xl md:text-4xl font-display font-bold">
                      {travelGoalProgress.departure} <span className="text-pastel-lavender">→</span> {travelGoalProgress.destination}
                    </h2>
                    <p className="text-text-muted font-medium text-sm mt-1 mb-6">
                      {travelGoalProgress.targetDate ? new Date(travelGoalProgress.targetDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Target Flight'}
                      {travelGoalProgress.cabin ? ` • ${travelGoalProgress.cabin}` : ''}
                      {travelGoalProgress.programName ? ` • ${store?.programById.get(travelGoalProgress.programName)?.name || travelGoalProgress.programName}` : ''}
                    </p>

                    <div className="space-y-2 mb-6 max-w-md">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-text-muted">Goal Progress</span>
                        <span className="text-pastel-mint">
                          {travelGoalProgress.currentPoints.toLocaleString('en-IN')} / {travelGoalProgress.targetPoints.toLocaleString('en-IN')} pts ({travelGoalProgress.progressPct}%)
                        </span>
                      </div>
                      <div className="h-3 w-full bg-dark-base rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-pastel-lavender to-pastel-pink rounded-full transition-all duration-500"
                          style={{ width: `${travelGoalProgress.progressPct}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-text-muted text-right">
                        {travelGoalProgress.remainingPoints > 0
                          ? `${travelGoalProgress.remainingPoints.toLocaleString('en-IN')} points to go`
                          : 'Target reached! Ready for redemption.'}
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <button onClick={() => navigate('/travel')} className="pastel-button px-5 py-2.5 text-xs font-bold">
                        View Travel Execution Plan
                      </button>
                      <button onClick={() => navigate('/travel')} className="bg-white/5 text-text-primary font-bold px-4 py-2.5 rounded-xl hover:bg-white/10 transition-colors border border-white/10 text-xs">
                        Update Goal
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div variants={itemVariants} className="glass-card p-8 text-center flex flex-col items-center justify-center border border-dashed border-white/15 rounded-3xl cursor-pointer hover:border-pastel-lavender/40 transition-all" onClick={() => navigate('/travel')}>
                <div className="w-14 h-14 bg-dark-elevated rounded-full flex items-center justify-center mb-3">
                  <Plane className="w-7 h-7 text-pastel-blue" />
                </div>
                <h3 className="text-xl font-display font-bold text-text-primary mb-1">Set Your Next Travel Goal</h3>
                <p className="text-xs text-text-muted mb-4 max-w-md">
                  Choose your destination and let CardIO map which cards earn points the fastest.
                </p>
                <button className="pastel-button px-5 py-2.5 text-xs font-bold inline-flex items-center gap-1.5">
                  <Plus className="w-4 h-4" /> Create Travel Goal
                </button>
              </motion.div>
            )}

            {/* AI Next Best Move */}
            {recommendation && (
              <motion.div variants={itemVariants} className="glass-card p-6 border border-pastel-lavender/30 rounded-3xl relative overflow-hidden group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-pastel-lavender uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-pastel-lavender" /> Recommended Next Move
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pastel-lavender/15 text-pastel-lavender">
                    AI Spend Advice
                  </span>
                </div>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mt-2">
                  <div>
                    <h4 className="text-lg font-bold text-text-primary">
                      Use <span className="text-transparent bg-clip-text bg-gradient-to-r from-pastel-lavender to-pastel-pink">{recommendation.recommended?.cardName}</span> for Travel & Dining purchases
                    </h4>
                    <p className="text-xs text-text-muted mt-1 leading-relaxed">{recommendation.explanation}</p>
                  </div>
                  <div className="bg-dark-base/60 p-3.5 rounded-2xl border border-white/5 text-right shrink-0">
                    <p className="text-[10px] font-bold text-text-muted uppercase">Expected Reward</p>
                    <p className="text-xl font-display font-bold text-pastel-mint">
                      +{recommendation.recommended?.expectedReward} {recommendation.recommended?.rewardType}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Quick Actions & Recent Activity Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Quick Actions */}
              <div className="glass-card p-6 rounded-3xl border border-white/10 space-y-4">
                <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-pastel-pink" /> Quick Actions
                </h3>
                <div className="space-y-2.5">
                  <button onClick={() => navigate('/transactions')} className="w-full p-3.5 rounded-2xl bg-dark-elevated hover:bg-white/10 border border-white/5 text-left text-xs font-bold flex items-center justify-between transition-colors">
                    <span className="flex items-center gap-2.5">
                      <Wallet className="w-4 h-4 text-pastel-mint" /> Record New Transaction
                    </span>
                    <ChevronRight className="w-4 h-4 text-text-muted" />
                  </button>

                  <button onClick={() => navigate('/rewards')} className="w-full p-3.5 rounded-2xl bg-dark-elevated hover:bg-white/10 border border-white/5 text-left text-xs font-bold flex items-center justify-between transition-colors">
                    <span className="flex items-center gap-2.5">
                      <BookmarkCheck className="w-4 h-4 text-pastel-lavender" /> Explore & Save Offers
                    </span>
                    <ChevronRight className="w-4 h-4 text-text-muted" />
                  </button>

                  <button onClick={() => navigate('/cards')} className="w-full p-3.5 rounded-2xl bg-dark-elevated hover:bg-white/10 border border-white/5 text-left text-xs font-bold flex items-center justify-between transition-colors">
                    <span className="flex items-center gap-2.5">
                      <CreditCard className="w-4 h-4 text-pastel-peach" /> Manage Credit Cards
                    </span>
                    <ChevronRight className="w-4 h-4 text-text-muted" />
                  </button>
                </div>
              </div>

              {/* Recent Transactions Feed */}
              <div className="lg:col-span-2 glass-card p-6 rounded-3xl border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-pastel-mint" /> Recent Transactions
                  </h3>
                  <button onClick={() => navigate('/transactions')} className="text-xs font-bold text-pastel-lavender hover:underline inline-flex items-center gap-1">
                    View All ({transactions.length}) <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {transactions.length === 0 ? (
                  <p className="text-xs text-text-muted py-8 text-center">No transactions recorded yet.</p>
                ) : (
                  <div className="divide-y divide-white/5">
                    {transactions.slice(0, 5).map(t => (
                      <div key={t.id} className="py-3 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-text-primary text-sm">{t.merchant}</div>
                          <div className="text-text-muted text-[11px]">
                            {new Date(t.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} • {t.category_id || 'General'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-text-primary text-sm">₹{formatINR(Number(t.amount))}</div>
                          <div className="text-[11px] font-semibold text-pastel-mint">
                            {Number(t.reward_earned) > 0 ? `+${formatINR(Number(t.reward_earned))} pts` : ''}
                            {Number(t.cashback_earned) > 0 ? `+₹${formatINR(Number(t.cashback_earned))}` : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ────────────────── TAB 2: SPENDING ANALYTICS ────────────────── */}
        {dashboardTab === 'SPENDING' && (
          <div className="space-y-6">
            {/* Filter Controls Bar */}
            <div className="glass-card p-4 rounded-3xl border border-white/10 flex flex-wrap items-center justify-between gap-4">
              {/* Date Presets */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {[
                  { id: 'LAST_7_DAYS', label: '7D' },
                  { id: 'LAST_30_DAYS', label: '30D' },
                  { id: 'LAST_3_MONTHS', label: '3M' },
                  { id: 'LAST_6_MONTHS', label: '6M' },
                  { id: 'THIS_YEAR', label: 'This Year' },
                  { id: 'ALL_TIME', label: 'All Time' },
                  { id: 'CUSTOM', label: 'Custom' },
                ].map(p => (
                  <button
                    key={p.id}
                    onClick={() => setDatePreset(p.id as DateRangePreset)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      datePreset === p.id
                        ? 'bg-pastel-mint text-dark-base shadow-[0_0_10px_rgba(182,240,214,0.3)]'
                        : 'bg-dark-surface text-text-muted hover:text-white border border-white/5'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Custom Date Inputs if Custom is selected */}
              {datePreset === 'CUSTOM' && (
                <div className="flex items-center gap-2 text-xs">
                  <input
                    type="date"
                    value={customStart}
                    onChange={e => setCustomStart(e.target.value)}
                    className="glass-input py-1 px-2.5 text-xs [color-scheme:dark]"
                  />
                  <span className="text-text-muted">to</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={e => setCustomEnd(e.target.value)}
                    className="glass-input py-1 px-2.5 text-xs [color-scheme:dark]"
                  />
                </div>
              )}

              {/* Category & Card Dropdowns */}
              <div className="flex items-center gap-3">
                <select
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  className="glass-input py-1.5 px-3 text-xs"
                >
                  <option value="ALL">All Categories</option>
                  <option value="Travel">Travel</option>
                  <option value="Dining">Dining</option>
                  <option value="Shopping">Shopping</option>
                  <option value="Grocery">Grocery</option>
                  <option value="Fuel">Fuel</option>
                  <option value="Movies">Movies</option>
                  <option value="Utilities">Utilities</option>
                </select>

                <select
                  value={cardFilter}
                  onChange={e => setCardFilter(e.target.value)}
                  className="glass-input py-1.5 px-3 text-xs"
                >
                  <option value="ALL">All Cards</option>
                  {userCards.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.custom_card_name || c.credit_cards?.name || 'Card'}
                    </option>
                  ))}
                </select>

                {/* Analytics Engine Badge */}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  analyticsSource === 'fastapi'
                    ? 'bg-pastel-mint/15 text-pastel-mint border-pastel-mint/30'
                    : 'bg-white/10 text-text-muted border-white/15'
                }`} title="Analytics Calculation Engine">
                  {analyticsSource === 'fastapi' ? '⚡ FastAPI + Pandas' : 'Node Engine'}
                </span>
              </div>
            </div>

            {/* Check if filtered transactions are empty */}
            {filteredTransactions.length === 0 ? (
              <div className="p-16 text-center border border-dashed border-white/10 rounded-3xl text-text-muted">
                <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <h3 className="font-bold text-lg text-text-primary mb-1">No Transactions Found</h3>
                <p className="text-xs max-w-sm mx-auto mb-4">
                  No spending records match the selected date range or category filter. Adjust your filter criteria.
                </p>
                <button
                  onClick={() => { setDatePreset('ALL_TIME'); setCategoryFilter('ALL'); setCardFilter('ALL'); }}
                  className="pastel-button px-5 py-2 text-xs font-bold"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. Monthly Spending Trend */}
                <div className="glass-card p-6 rounded-3xl border border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-text-primary">Monthly Spending Velocity</h3>
                      <p className="text-xs text-text-muted">Spend and transaction volume across months</p>
                    </div>
                    <span className="text-xs font-bold text-pastel-lavender">
                      {monthlySpendingChartData.length} Months
                    </span>
                  </div>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlySpendingChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2D2D42" vertical={false} />
                        <XAxis dataKey="month" stroke="#A5A3B8" fontSize={11} />
                        <YAxis stroke="#A5A3B8" fontSize={11} tickFormatter={v => `₹${v >= 1000 ? `${v/1000}k` : v}`} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="spend" name="Spend" fill="#C3B1E1" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* 2. Category Distribution */}
                <div className="glass-card p-6 rounded-3xl border border-white/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-text-primary">Category Distribution</h3>
                      <p className="text-xs text-text-muted">Breakdown by purchase category</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="h-56 w-56 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categorySpendingChartData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={80}
                            paddingAngle={4}
                          >
                            {categorySpendingChartData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="flex-1 space-y-2 w-full text-xs">
                      {categorySpendingChartData.slice(0, 5).map((cat, idx) => (
                        <div key={cat.name} className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PALETTE[idx % PALETTE.length] }} />
                            <span className="text-text-muted">{cat.name}</span>
                          </span>
                          <span className="font-bold text-text-primary">
                            ₹{formatINR(cat.value)} ({cat.pct}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3. Top Merchants Breakdown */}
                <div className="glass-card p-6 rounded-3xl border border-white/10 space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-text-primary">Top Merchants by Spend</h3>
                    <p className="text-xs text-text-muted">Where your money goes most frequently</p>
                  </div>

                  <div className="space-y-3">
                    {merchantSpendingData.map((m, i) => (
                      <div key={m.name} className="p-3 rounded-2xl bg-dark-surface/60 border border-white/5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5">
                          <span className="w-5 h-5 rounded-lg bg-white/5 flex items-center justify-center font-bold text-[10px] text-text-muted">
                            #{i + 1}
                          </span>
                          <div>
                            <div className="font-bold text-text-primary">{m.name}</div>
                            <div className="text-[10px] text-text-muted">{m.count} transaction{m.count > 1 ? 's' : ''}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-pastel-lavender">₹{formatINR(m.spend)}</div>
                          <div className="text-[10px] text-text-muted">Avg: ₹{formatINR(m.avg)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Day of Week Velocity */}
                <div className="glass-card p-6 rounded-3xl border border-white/10 space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-text-primary">Day of Week Spending Pattern</h3>
                    <p className="text-xs text-text-muted">Spending concentration by day</p>
                  </div>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dayOfWeekData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2D2D42" vertical={false} />
                        <XAxis dataKey="day" stroke="#A5A3B8" fontSize={11} />
                        <YAxis stroke="#A5A3B8" fontSize={11} tickFormatter={v => `₹${v >= 1000 ? `${v/1000}k` : v}`} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area type="monotone" dataKey="spend" stroke="#B8E6D3" fill="#B8E6D3" fillOpacity={0.15} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ────────────────── TAB 3: CARD & OFFER PERFORMANCE ────────────────── */}
        {dashboardTab === 'PERFORMANCE' && (
          <div className="space-y-8">
            {/* 1. Card Performance Matrix */}
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-display font-bold text-text-primary">Credit Card Performance Comparison</h3>
                <p className="text-xs text-text-muted">Spend, transaction volume, and verified return rate per card</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {cardMetrics.map(card => (
                  <div key={card.cardId} className="glass-card p-6 rounded-3xl border border-white/10 flex flex-col justify-between space-y-4 hover:border-pastel-lavender/30 transition-all">
                    <div>
                      {/* Badges for highlights */}
                      <div className="flex flex-wrap gap-1.5 mb-2.5">
                        {card.isMostUsed && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pastel-lavender/20 text-pastel-lavender border border-pastel-lavender/30">
                            ★ Most Frequently Used
                          </span>
                        )}
                        {card.isHighestSpend && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-400/20 text-blue-400 border border-blue-400/30">
                            ★ Highest Spend
                          </span>
                        )}
                        {card.isHighestSavings && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pastel-mint/20 text-pastel-mint border border-pastel-mint/30">
                            ★ Highest Confirmed Savings
                          </span>
                        )}
                        {card.isBestReturnRate && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pastel-pink/20 text-pastel-pink border border-pastel-pink/30">
                            ★ Best Return Rate
                          </span>
                        )}
                      </div>

                      <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{card.issuer}</span>
                      <h4 className="font-display font-bold text-lg text-text-primary mt-0.5">{card.cardName}</h4>

                      {/* Financials Grid */}
                      <div className="grid grid-cols-2 gap-2 mt-4 p-3 rounded-2xl bg-dark-surface/60 border border-white/5 text-xs">
                        <div>
                          <span className="text-text-muted block text-[10px]">Total Spend</span>
                          <span className="font-bold text-text-primary">₹{formatINR(card.totalSpend)}</span>
                        </div>
                        <div>
                          <span className="text-text-muted block text-[10px]">Transactions</span>
                          <span className="font-bold text-text-primary">{card.transactionCount} txns</span>
                        </div>
                        <div>
                          <span className="text-text-muted block text-[10px]">Confirmed Savings</span>
                          <span className="font-bold text-pastel-mint">₹{formatINR(card.confirmedSavingsINR)}</span>
                        </div>
                        <div>
                          <span className="text-text-muted block text-[10px]">Return Rate</span>
                          <span className="font-bold text-pastel-lavender">{card.effectiveReturnRatePct}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/5 text-[11px] text-text-muted flex justify-between items-center">
                      <span>Reward Points: <strong>+{card.confirmedRewardPoints.toLocaleString('en-IN')}</strong></span>
                      {card.estimatedSavingsINR > 0 && (
                        <span>Est. Potential: ₹{formatINR(card.estimatedSavingsINR)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Offer Lifecycle Performance */}
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-display font-bold text-text-primary">Offer Lifecycle & Redemption Intelligence</h3>
                  <p className="text-xs text-text-muted">Promotion conversion rates and merchant savings</p>
                </div>
                <button onClick={() => navigate('/rewards')} className="pastel-button px-4 py-2 text-xs font-bold inline-flex items-center gap-1.5">
                  Rewards Hub <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-3xl bg-dark-elevated border border-white/10 text-center">
                  <div className="text-xs text-text-muted font-bold uppercase mb-1">Offers Saved</div>
                  <div className="text-3xl font-display font-bold text-pastel-lavender">{offerMetrics.savedCount}</div>
                  <p className="text-[10px] text-text-muted mt-0.5">Bookmarked promotions</p>
                </div>

                <div className="p-4 rounded-3xl bg-dark-elevated border border-white/10 text-center">
                  <div className="text-xs text-text-muted font-bold uppercase mb-1">Offers Applied</div>
                  <div className="text-3xl font-display font-bold text-blue-400">{offerMetrics.appliedCount}</div>
                  <p className="text-[10px] text-text-muted mt-0.5">Used in transactions</p>
                </div>

                <div className="p-4 rounded-3xl bg-dark-elevated border border-white/10 text-center">
                  <div className="text-xs text-text-muted font-bold uppercase mb-1">Offers Redeemed</div>
                  <div className="text-3xl font-display font-bold text-pastel-mint">{offerMetrics.redeemedCount}</div>
                  <p className="text-[10px] text-text-muted mt-0.5">Verified savings received</p>
                </div>

                <div className="p-4 rounded-3xl bg-dark-elevated border border-white/10 text-center">
                  <div className="text-xs text-text-muted font-bold uppercase mb-1">Success Rate</div>
                  <div className="text-3xl font-display font-bold text-pastel-pink">{offerMetrics.redemptionSuccessRatePct}%</div>
                  <p className="text-[10px] text-text-muted mt-0.5">Conversion to confirmed benefit</p>
                </div>
              </div>

              {/* Savings by Merchant Breakdown */}
              {offerMetrics.confirmedSavingsByMerchant.length > 0 && (
                <div className="glass-card p-6 rounded-3xl border border-white/10 space-y-3">
                  <h4 className="text-sm font-bold text-text-primary">Confirmed Savings by Merchant</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {offerMetrics.confirmedSavingsByMerchant.map(m => (
                      <div key={m.merchant} className="p-3.5 rounded-2xl bg-dark-surface/60 border border-white/5 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-text-primary">{m.merchant}</div>
                          <div className="text-[10px] text-text-muted">{m.count} redemption{m.count > 1 ? 's' : ''}</div>
                        </div>
                        <div className="font-bold text-pastel-mint text-sm">
                          ₹{formatINR(m.savingsINR)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Dashboard;
