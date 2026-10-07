import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coffee, Plane, Film, ShoppingBag, Sparkles, ChevronRight } from 'lucide-react';
import { useDataStore } from '../lib/data/DataContext';

const CATEGORIES = [
  { id: 'TRAVEL', icon: Plane, label: 'Travel & Flights', color: 'text-pastel-lavender', bg: 'bg-pastel-lavender/10' },
  { id: 'DINING', icon: Coffee, label: 'Dining & Food', color: 'text-pastel-pink', bg: 'bg-pastel-pink/10' },
  { id: 'MOVIES', icon: Film, label: 'Entertainment', color: 'text-pastel-mint', bg: 'bg-pastel-mint/10' },
  { id: 'SHOPPING', icon: ShoppingBag, label: 'Shopping', color: 'text-blue-400', bg: 'bg-blue-400/10' },
];

const RewardsHub = () => {
  const { store, loading } = useDataStore();
  const [activeTab, setActiveTab] = useState(CATEGORIES[0].id);

  const displayData = useMemo(() => {
    if (!store) return [];

    if (activeTab === 'MOVIES' || activeTab === 'DINING') {
      const results: any[] = [];
      store.movieDining.forEach(benefit => {
        if (benefit.category === activeTab) {
          const card = store.cardById.get(benefit.card_id);
          if (card) {
            results.push({
              card: card.name,
              benefit: benefit.benefit,
              tags: [benefit.platform || 'General', benefit.confidence],
              source: benefit.source_url
            });
          }
        }
      });
      return results;
    }

    if (activeTab === 'TRAVEL') {
      // Just list premium travel cards based on tier
      const results: any[] = [];
      store.cards.filter(c => c.tier === 'SUPER_PREMIUM' || c.tier === 'PREMIUM').slice(0, 10).forEach(card => {
        if (card.base_reward_rate_pct > 1) {
          results.push({
            card: card.name,
            benefit: `Earns up to ${card.max_points_per_100_inr_derived} points per ₹100. Base reward rate: ${card.base_reward_rate_pct}%.`,
            tags: [card.tier, card.network],
            source: card.source
          });
        }
      });
      return results;
    }

    return []; // For SHOPPING we don't have explicit CSV data mapped yet
  }, [store, activeTab]);

  if (loading) {
    return <div className="flex h-screen items-center justify-center"><div className="animate-spin w-10 h-10 border-4 border-pastel-lavender border-t-transparent rounded-full"></div></div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen">
      <header className="mb-10">
        <h1 className="text-3xl font-display font-bold text-text-primary mb-2 flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-pastel-pink" />
          Rewards Hub
        </h1>
        <p className="text-text-muted font-medium">Discover which card to use where to maximize your benefits.</p>
      </header>

      {/* Category Tabs */}
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-none mb-8">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const isActive = activeTab === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all whitespace-nowrap ${
                isActive 
                  ? 'bg-dark-elevated border border-pastel-lavender shadow-[0_0_20px_rgba(230,230,250,0.1)] text-text-primary' 
                  : 'bg-dark-surface border border-white/5 text-text-muted hover:bg-dark-elevated'
              }`}
            >
              <div className={`p-2 rounded-xl ${isActive ? cat.bg : 'bg-white/5'}`}>
                <Icon className={`w-5 h-5 ${isActive ? cat.color : 'text-text-muted'}`} />
              </div>
              {cat.label}
            </button>
          )
        })}
      </div>

      {/* Cards List for Selected Category */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {displayData.length === 0 ? (
            <div className="col-span-full py-12 text-center border border-dashed border-white/10 rounded-2xl text-text-muted">
              No verified data yet for this category in our current dataset.
            </div>
          ) : (
            displayData.map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: idx * 0.05 }}
                className="glass-card p-6 border border-white/10 rounded-3xl hover:border-pastel-lavender/30 transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-display font-bold text-lg text-text-primary pr-2">{item.card}</h3>
                    <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                      {item.tags.map((tag: string, i: number) => (
                        <span key={i} className="text-[10px] font-bold text-pastel-mint bg-pastel-mint/10 px-2 py-1 rounded-md uppercase tracking-wider">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="text-text-muted text-sm leading-relaxed mb-6">{item.benefit}</p>
                </div>
                {item.source && (
                  <a href={item.source} target="_blank" rel="noreferrer" className="w-full py-3 rounded-xl bg-dark-elevated hover:bg-white/10 text-text-primary font-bold transition-colors flex items-center justify-center gap-2 border border-white/5 text-sm">
                    View Source <ChevronRight className="w-4 h-4 text-text-muted" />
                  </a>
                )}
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default RewardsHub;
