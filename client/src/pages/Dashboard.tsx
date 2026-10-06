import React, { useEffect, useState } from 'react';
import { CreditCard, Plane, Wallet, TrendingUp, Sparkles, Award, Plus, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { useNavigate } from 'react-router-dom';

const Dashboard = ({ session }: { session: any }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [travelGoal, setTravelGoal] = useState<any>(null);
  const [recommendation, setRecommendation] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [dashRes, goalsRes, recRes] = await Promise.all([
          api.getDashboard(),
          api.getTravelGoals(),
          api.getRecommendation(5000, 'Travel')
        ]);
        
        setDashboardData(dashRes);
        if (goalsRes && goalsRes.length > 0) {
          setTravelGoal(goalsRes[0]);
        }
        if (recRes && recRes.recommended) {
          setRecommendation(recRes);
        }
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-dark-base">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-pastel-lavender/30 border-t-pastel-lavender rounded-full animate-spin"></div>
          <p className="text-text-muted font-medium">Assembling your portfolio...</p>
        </div>
      </div>
    );
  }

  // --- EMPTY ONBOARDING STATE ---
  if (dashboardData?.totalCards === 0) {
    return (
      <div className="relative p-8 max-w-4xl mx-auto min-h-screen flex flex-col justify-center">
        <div className="absolute top-0 right-0 w-96 h-96 bg-pastel-lavender/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob pointer-events-none"></div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 glass-card p-12 text-center">
          <div className="w-20 h-20 bg-dark-elevated rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <Sparkles className="w-10 h-10 text-pastel-pink" />
          </div>
          <h1 className="text-4xl font-display font-bold text-text-primary mb-4">Welcome to CardIO</h1>
          <p className="text-lg text-text-muted mb-8 max-w-lg mx-auto">Let's set up your rewards strategy. Add your first credit card to unlock personalized recommendations and travel plans.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10 text-left">
            <div className="p-5 bg-dark-base/50 rounded-2xl border border-white/5">
              <div className="font-bold text-pastel-lavender mb-2">Step 1</div>
              <h3 className="font-semibold text-text-primary">Add your cards</h3>
              <p className="text-sm text-text-muted mt-1">Connect the cards you already own.</p>
            </div>
            <div className="p-5 bg-dark-base/30 rounded-2xl border border-white/5 opacity-50">
              <div className="font-bold text-text-muted mb-2">Step 2</div>
              <h3 className="font-semibold text-text-primary">Set a travel goal</h3>
              <p className="text-sm text-text-muted mt-1">Tell us where you want to go.</p>
            </div>
            <div className="p-5 bg-dark-base/30 rounded-2xl border border-white/5 opacity-50">
              <div className="font-bold text-text-muted mb-2">Step 3</div>
              <h3 className="font-semibold text-text-primary">Maximize rewards</h3>
              <p className="text-sm text-text-muted mt-1">Get AI-driven spend advice.</p>
            </div>
          </div>
          
          <button onClick={() => navigate('/cards')} className="pastel-button px-8 py-4 inline-flex items-center gap-2">
            Add Your First Card <ArrowRight className="w-5 h-5" />
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative p-8 max-w-7xl mx-auto min-h-screen">
      {/* Background Animated Blobs */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-pastel-lavender/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob pointer-events-none"></div>
      <div className="absolute top-0 -right-4 w-72 h-72 bg-pastel-pink/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob animation-delay-2000 pointer-events-none"></div>
      <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pastel-blue/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob animation-delay-4000 pointer-events-none"></div>

      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="relative z-10">
        <motion.header variants={itemVariants} className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-dark-elevated border border-pastel-lavender/30 text-pastel-lavender text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            <span>AI-Powered Insights Active</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-text-primary mb-3 tracking-tight">
            Good morning, <span className="text-transparent bg-clip-text bg-gradient-to-r from-pastel-lavender to-pastel-pink">{session?.user?.user_metadata?.full_name?.split(' ')[0] || 'Explorer'}</span>
          </h1>
          <p className="text-lg text-text-muted font-medium">Here's how your rewards are looking today.</p>
        </motion.header>

        {/* Hero Widget: Travel Goal */}
        <motion.section variants={itemVariants} className="mb-14">
          {travelGoal ? (
            <div className="bg-gradient-to-br from-[#232340] via-[#1A1A2E] to-[#0F0F1A] rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden group border border-white/10">
              <div className="absolute top-0 right-0 w-96 h-96 bg-pastel-blue/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3"></div>
              <div className="relative z-10 flex flex-col md:flex-row justify-between gap-8 items-center">
                <div className="flex-1 w-full">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-pastel-blue text-xs font-bold uppercase tracking-wider mb-6">
                    <Plane className="w-4 h-4" /> Active Travel Goal
                  </div>
                  <div className="flex items-end gap-4 mb-4">
                    <h2 className="text-4xl md:text-5xl font-display font-bold">{travelGoal.departure} <span className="text-pastel-lavender">→</span> {travelGoal.destination}</h2>
                  </div>
                  <p className="text-text-muted font-medium text-lg mb-8">{new Date(travelGoal.departure_date).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric'})} • {travelGoal.airline_loyalty_programs?.program_name}</p>
                  
                  <div className="space-y-2 mb-8 max-w-md">
                    <div className="flex justify-between text-sm font-bold">
                      <span className="text-text-muted">Progress</span>
                      <span className="text-text-primary">0 / {travelGoal.target_points.toLocaleString()} pts</span>
                    </div>
                    <div className="h-3 w-full bg-dark-base rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-pastel-lavender to-pastel-pink rounded-full" style={{ width: '5%' }}></div>
                    </div>
                    <p className="text-xs text-text-muted text-right">{travelGoal.target_points.toLocaleString()} points to go</p>
                  </div>

                  <div className="flex gap-4">
                    <button onClick={() => navigate('/travel')} className="pastel-button px-6 py-3">View Execution Plan</button>
                    <button className="bg-white/5 text-text-primary font-bold px-6 py-3 rounded-xl hover:bg-white/10 transition-colors border border-white/10">Update Goal</button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-card p-12 text-center flex flex-col items-center justify-center group hover:bg-dark-surface/80 transition-all cursor-pointer" onClick={() => navigate('/travel')}>
              <div className="w-16 h-16 bg-dark-elevated rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Plane className="w-8 h-8 text-pastel-blue" />
              </div>
              <h3 className="text-2xl font-display font-bold text-text-primary mb-2">Where are you going next?</h3>
              <p className="text-text-muted mb-6 max-w-md">Create a travel goal and let CardIO build your personalized rewards strategy.</p>
              <button className="pastel-button px-6 py-3 inline-flex items-center gap-2">
                <Plus className="w-5 h-5" /> Create Travel Goal
              </button>
            </div>
          )}
        </motion.section>

        {/* Summary Widgets - Using Real API Data */}
        <motion.section variants={containerVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-14">
          {[
            { title: "Total Cards", value: dashboardData?.totalCards || 0, icon: CreditCard, color: "lavender", trend: "Active in Portfolio" },
            { title: "Monthly Spends", value: `₹${(dashboardData?.monthlySpends || 0).toLocaleString()}`, icon: Wallet, color: "mint", trend: "Current Month" },
            { title: "Total Rewards", value: (dashboardData?.totalRewards || 0).toLocaleString(), icon: TrendingUp, color: "peach", trend: "Points Earned" },
            { title: "Airline Miles", value: (dashboardData?.totalMiles || 0).toLocaleString(), icon: Plane, color: "pink", trend: "Total Balance" }
          ].map((stat, i) => (
            <motion.div 
              key={i}
              variants={itemVariants}
              whileHover={{ y: -5, transition: { duration: 0.2 } }}
              className="glass-card p-6 group hover:bg-dark-surface/80 transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="bg-dark-elevated text-text-primary p-3.5 rounded-2xl group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 border border-white/5">
                  <stat.icon className="w-6 h-6" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-text-muted mb-1">{stat.title}</h3>
                <p className="text-3xl font-display font-bold text-text-primary tracking-tight">{stat.value}</p>
                <p className="text-sm font-medium mt-2 text-text-muted opacity-80">
                  {stat.trend}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.section>

        {/* Smart Next Action (Recommendation) */}
        {recommendation && (
          <motion.section variants={itemVariants} className="mb-14">
            <h3 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2"><Award className="w-5 h-5 text-pastel-pink"/> Your next best move</h3>
            <div className="glass-card p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden group">
              <div className="absolute right-0 top-0 w-64 h-64 bg-pastel-pink/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 group-hover:bg-pastel-pink/20 transition-colors pointer-events-none"></div>
              <div className="flex-1 relative z-10">
                <h4 className="text-xl font-bold text-text-primary mb-2">Use <span className="text-transparent bg-clip-text bg-gradient-to-r from-pastel-lavender to-pastel-pink">{recommendation.recommended.cardName}</span> for your next Travel purchase</h4>
                <p className="text-text-muted">{recommendation.explanation}</p>
              </div>
              <div className="flex-shrink-0 text-center md:text-right relative z-10 bg-dark-base/50 p-4 rounded-xl border border-white/5">
                <p className="text-sm font-bold text-pastel-lavender uppercase tracking-wider mb-1">Estimated Value</p>
                <p className="text-3xl font-display font-bold text-pastel-pink">+{recommendation.recommended.expectedReward} {recommendation.recommended.rewardType}</p>
              </div>
            </div>
          </motion.section>
        )}

      </motion.div>
    </div>
  );
};

export default Dashboard;
