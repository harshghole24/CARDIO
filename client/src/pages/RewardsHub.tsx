import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coffee, Plane, Film, ShoppingBag, Sparkles, ChevronRight } from 'lucide-react';

const CATEGORIES = [
  { id: 'travel', icon: Plane, label: 'Travel & Flights', color: 'text-pastel-lavender', bg: 'bg-pastel-lavender/10' },
  { id: 'dining', icon: Coffee, label: 'Dining & Food', color: 'text-pastel-pink', bg: 'bg-pastel-pink/10' },
  { id: 'movies', icon: Film, label: 'Entertainment', color: 'text-pastel-mint', bg: 'bg-pastel-mint/10' },
  { id: 'shopping', icon: ShoppingBag, label: 'Shopping', color: 'text-blue-400', bg: 'bg-blue-400/10' },
];

const REWARDS_DATA: Record<string, any[]> = {
  travel: [
    { card: 'Axis ATLAS', benefit: '5 EDGE Miles per ₹100 on direct airline/hotel bookings.', tags: ['High Reward'] },
    { card: 'HDFC Infinia', benefit: '33% Reward Rate via SmartBuy Portal for Flights.', tags: ['Premium'] },
    { card: 'Scapia', benefit: 'Zero Forex Markup on International spends.', tags: ['Forex'] },
  ],
  dining: [
    { card: 'HDFC Diners Black', benefit: '2x Rewards on Weekend Dining.', tags: ['Weekend'] },
    { card: 'HSBC Premier', benefit: '30% off on EazyDiner bookings.', tags: ['Discount'] },
  ],
  movies: [
    { card: 'ICICI Emeralde', benefit: 'Buy 1 Get 1 Free on BookMyShow (up to ₹750).', tags: ['BOGO'] },
    { card: 'SBI Aurum', benefit: '4 Free tickets per month.', tags: ['Quota'] },
  ],
  shopping: [
    { card: 'SBI Cashback', benefit: '5% flat cashback on all online spends without restrictions.', tags: ['Online', 'Cashback'] },
    { card: 'AmEx MRCC', benefit: '1000 Bonus MR points on completing 4 transactions of ₹1500+.', tags: ['Milestone'] },
  ]
};

const RewardsHub = () => {
  const [activeTab, setActiveTab] = useState(CATEGORIES[0].id);

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
          {REWARDS_DATA[activeTab].map((item, idx) => (
            <motion.div
              key={item.card}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: idx * 0.05 }}
              className="glass-card p-6 border border-white/10 rounded-3xl hover:border-pastel-lavender/30 transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-display font-bold text-xl text-text-primary">{item.card}</h3>
                  <div className="flex gap-2">
                    {item.tags.map((tag: string) => (
                      <span key={tag} className="text-[10px] font-bold text-pastel-mint bg-pastel-mint/10 px-2 py-1 rounded-md uppercase tracking-wider">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-text-muted text-sm leading-relaxed mb-6">{item.benefit}</p>
              </div>
              <button className="w-full py-3 rounded-xl bg-dark-elevated hover:bg-white/10 text-text-primary font-bold transition-colors flex items-center justify-center gap-2 border border-white/5">
                View Card Details <ChevronRight className="w-4 h-4 text-text-muted" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default RewardsHub;
