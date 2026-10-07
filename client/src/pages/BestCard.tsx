import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, CreditCard, ArrowRight, Sparkles, ShoppingBag, Utensils, Plane, Fuel, ShoppingCart, Wifi, Film, Lightbulb, Plus } from 'lucide-react';
import { useDataStore } from '../lib/data/DataContext';
import { api } from '../lib/api';
import { useNavigate } from 'react-router-dom';

const CATEGORIES = [
  { id: 'travel', label: 'Travel', icon: Plane },
  { id: 'dining', label: 'Dining', icon: Utensils },
  { id: 'movies', label: 'Movies', icon: Film },
  { id: 'grocery', label: 'Grocery', icon: ShoppingCart },
  { id: 'fuel', label: 'Fuel', icon: Fuel },
  { id: 'online', label: 'Online Shopping', icon: Wifi },
  { id: 'shopping', label: 'Shopping', icon: ShoppingBag },
  { id: 'utilities', label: 'Utilities', icon: Lightbulb },
];

// Format number in Indian number system
function formatINR(n: number): string {
  if (!isFinite(n)) return '∞';
  return n.toLocaleString('en-IN');
}

interface UserCard {
  id: string;
  card_id: string;
  credit_cards?: any;
  custom_card_name?: string;
  custom_bank?: string;
}

const BestCard = ({ session }: { session: any }) => {
  const { store, loading: dataLoading } = useDataStore();
  const navigate = useNavigate();

  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('travel');
  const [userCards, setUserCards] = useState<UserCard[]>([]);
  const [cardsLoaded, setCardsLoaded] = useState(false);
  const [loadingCards, setLoadingCards] = useState(false);
  const [result, setResult] = useState<null | 'calculated'>(null);

  // Lazily load user's cards on first render
  const loadCards = async () => {
    if (cardsLoaded) return;
    setLoadingCards(true);
    try {
      const cards = await api.getCards();
      setUserCards(cards || []);
      setCardsLoaded(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCards(false);
    }
  };

  useMemo(() => { loadCards(); }, []);

  // The core calculation — pure, derived from CSV data
  const recommendation = useMemo(() => {
    if (!store || !amount || isNaN(Number(amount)) || Number(amount) <= 0 || !category) return null;

    const amt = Number(amount);

    // Evaluate owned cards
    const ownedResults = userCards.map(uc => {
      const dbCard = store.cardById.get(uc.card_id);
      if (!dbCard) return null;

      // Look for category-specific earn rate in movieDining benefits, else base rate
      const movieDiningBenefits = store.movieDiningByCard.get(dbCard.card_id) || [];
      const matchingBenefit = movieDiningBenefits.find(b => 
        b.category?.toLowerCase().includes(category) || 
        (category === 'movies' && b.category?.toLowerCase().includes('movie')) ||
        (category === 'dining' && b.category?.toLowerCase().includes('dining'))
      );

      // Use max rate for known accelerated categories, base rate otherwise
      const rateMultiplier = (['travel', 'dining', 'movies', 'fuel'].includes(category))
        ? dbCard.max_reward_rate_pct
        : dbCard.base_reward_rate_pct;

      const pointsPer100 = (['travel', 'dining', 'movies', 'fuel'].includes(category))
        ? dbCard.max_points_per_100_inr_derived
        : dbCard.base_points_per_100_inr_derived;

      const pointsEarned = Math.floor((amt / 100) * pointsPer100);
      const currency = store.currencyById.get(dbCard.reward_currency_id);
      const pointValuePaise = dbCard.point_value_paise || 50;
      const valueInr = (pointsEarned * pointValuePaise) / 100;

      return {
        userCard: uc,
        dbCard,
        rateMultiplier,
        pointsPer100,
        pointsEarned,
        currency,
        valueInr,
        matchingBenefit,
        isOwned: true,
      };
    }).filter(Boolean).sort((a, b) => (b!.valueInr - a!.valueInr));

    // Best card in wallet
    const best = ownedResults[0] || null;

    // Search all 280 cards for materially better alternatives
    const MATERIALLY_BETTER_THRESHOLD = 1.25; // 25% better
    const topAlternatives = store.cards
      .filter(c => !userCards.some(uc => uc.card_id === c.card_id)) // not already owned
      .map(dbCard => {
        const pointsPer100 = (['travel', 'dining', 'movies', 'fuel'].includes(category))
          ? dbCard.max_points_per_100_inr_derived
          : dbCard.base_points_per_100_inr_derived;

        const pointsEarned = Math.floor((amt / 100) * pointsPer100);
        const currency = store.currencyById.get(dbCard.reward_currency_id);
        const pointValuePaise = dbCard.point_value_paise || 50;
        const valueInr = (pointsEarned * pointValuePaise) / 100;

        return { dbCard, pointsPer100, pointsEarned, currency, valueInr, isOwned: false };
      })
      .filter(c => {
        // Only show if materially better than best owned card, or if no owned card
        if (!best) return c.valueInr > 0;
        return c.valueInr >= best.valueInr * MATERIALLY_BETTER_THRESHOLD;
      })
      .sort((a, b) => b.valueInr - a.valueInr)
      .slice(0, 3);

    return { ownedResults, best, topAlternatives };
  }, [store, amount, category, userCards]);

  const handleCalculate = () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      alert('Please enter a valid amount.');
      return;
    }
    setResult('calculated');
  };

  if (dataLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="w-8 h-8 border-4 border-pastel-lavender border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto min-h-screen">
      <header className="mb-10">
        <h1 className="text-3xl font-display font-bold text-text-primary mb-2 flex items-center gap-3">
          <Zap className="w-8 h-8 text-pastel-peach" />
          Which Card Should I Use?
        </h1>
        <p className="text-text-muted font-medium">Get the optimal card for any purchase, instantly.</p>
      </header>

      {/* Input Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-8 rounded-3xl border border-white/10 mb-8"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-bold text-text-muted mb-2 uppercase tracking-wider">Purchase Amount (₹)</label>
            <input
              type="number"
              value={amount}
              onChange={e => { setAmount(e.target.value); setResult(null); }}
              placeholder="e.g. 5000"
              className="glass-input text-xl font-bold"
              min="1"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-text-muted mb-2 uppercase tracking-wider">Category</label>
            <select
              value={category}
              onChange={e => { setCategory(e.target.value); setResult(null); }}
              className="glass-input text-lg"
            >
              {CATEGORIES.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Category quick-select pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          {CATEGORIES.map(cat => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => { setCategory(cat.id); setResult(null); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                  category === cat.id 
                    ? 'bg-pastel-lavender text-dark-base shadow-md' 
                    : 'bg-dark-elevated border border-white/10 text-text-muted hover:border-pastel-lavender/30 hover:text-text-primary'
                }`}
              >
                <Icon className="w-4 h-4" />
                {cat.label}
              </button>
            );
          })}
        </div>

        <button
          onClick={handleCalculate}
          className="pastel-button px-8 py-4 w-full text-lg font-bold flex items-center justify-center gap-3"
        >
          <Zap className="w-5 h-5" /> Find Best Card
        </button>
      </motion.div>

      {/* Results */}
      <AnimatePresence>
        {result === 'calculated' && recommendation && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Best Owned Card */}
            {recommendation.best ? (
              <div>
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-pastel-mint" />
                  Best Card in Your Wallet
                </h2>
                <div className="glass-card p-6 rounded-3xl border border-pastel-mint/30 bg-pastel-mint/5">
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="bg-pastel-mint text-dark-base text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">Best Match</span>
                        <span className="text-text-muted text-sm">{recommendation.best.dbCard.issuer}</span>
                      </div>
                      <h3 className="text-2xl font-display font-bold text-text-primary mb-1">
                        {recommendation.best.dbCard.name}
                      </h3>
                      <p className="text-text-muted">
                        {recommendation.best.pointsPer100} {recommendation.best.currency?.name || 'points'} per ₹100 on {CATEGORIES.find(c => c.id === category)?.label}
                      </p>
                    </div>
                    <div className="text-center md:text-right bg-dark-base/50 p-4 rounded-2xl border border-white/5 flex-shrink-0">
                      <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">You Earn</p>
                      <p className="text-3xl font-black text-pastel-mint">
                        {formatINR(recommendation.best.pointsEarned)}
                      </p>
                      <p className="text-sm text-text-muted mt-1">{recommendation.best.currency?.name || 'Points'}</p>
                      <p className="text-xs text-pastel-lavender font-bold mt-2">≈ ₹{formatINR(Math.round(recommendation.best.valueInr))}</p>
                    </div>
                  </div>

                  {/* Transparent math */}
                  <div className="mt-6 pt-4 border-t border-white/5 grid grid-cols-3 gap-3 text-center text-sm">
                    <div className="bg-dark-elevated p-3 rounded-xl">
                      <p className="text-text-muted text-xs uppercase mb-1">Spend</p>
                      <p className="font-bold text-text-primary">₹{formatINR(Number(amount))}</p>
                    </div>
                    <div className="bg-dark-elevated p-3 rounded-xl">
                      <p className="text-text-muted text-xs uppercase mb-1">× Rate</p>
                      <p className="font-bold text-pastel-mint">{recommendation.best.pointsPer100} per ₹100</p>
                    </div>
                    <div className="bg-dark-elevated p-3 rounded-xl">
                      <p className="text-text-muted text-xs uppercase mb-1">= Points</p>
                      <p className="font-bold text-pastel-lavender">{formatINR(recommendation.best.pointsEarned)}</p>
                    </div>
                  </div>

                  {recommendation.best.matchingBenefit && (
                    <div className="mt-4 p-3 bg-pastel-peach/10 border border-pastel-peach/20 rounded-xl text-sm">
                      <Sparkles className="w-4 h-4 inline text-pastel-peach mr-2" />
                      <span className="font-bold text-pastel-peach">Bonus benefit:</span>
                      <span className="text-text-muted ml-2">{recommendation.best.matchingBenefit.benefit}</span>
                    </div>
                  )}
                </div>

                {/* All owned cards ranked */}
                {recommendation.ownedResults.length > 1 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-bold text-text-muted mb-3 uppercase tracking-wider">All Your Cards Ranked</h3>
                    <div className="space-y-2">
                      {recommendation.ownedResults.slice(1).map((r, idx) => r && (
                        <div key={r.dbCard.card_id} className="flex items-center justify-between px-5 py-3 bg-dark-elevated rounded-2xl border border-white/5">
                          <div>
                            <span className="text-xs text-text-muted mr-2">#{idx + 2}</span>
                            <span className="font-bold text-text-primary">{r.dbCard.name}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-text-muted">{formatINR(r.pointsEarned)} pts</span>
                            <span className="text-xs text-text-muted ml-2">≈ ₹{formatINR(Math.round(r.valueInr))}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="glass-card p-8 text-center border border-dashed border-white/20 rounded-3xl">
                <CreditCard className="w-10 h-10 text-text-muted mx-auto mb-4" />
                <h3 className="text-xl font-bold text-text-primary mb-2">No cards in your wallet yet</h3>
                <p className="text-text-muted mb-6">Add your credit cards to get personalised recommendations.</p>
                <button onClick={() => navigate('/cards')} className="pastel-button px-6 py-3 inline-flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Add Cards
                </button>
              </div>
            )}

            {/* Better alternatives from the full catalogue */}
            {recommendation.topAlternatives.length > 0 && (
              <div>
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <ArrowRight className="w-5 h-5 text-pastel-peach" />
                  {recommendation.best ? 'Optional Upgrade (≥25% better)' : 'Top Cards for This Purchase'}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {recommendation.topAlternatives.map((alt, idx) => (
                    <motion.div
                      key={alt.dbCard.card_id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="glass-card p-5 rounded-2xl border border-pastel-peach/20 bg-pastel-peach/5 flex flex-col"
                    >
                      <span className="bg-white/10 text-text-muted text-xs font-bold px-2 py-1 rounded-full w-fit mb-3 uppercase tracking-wider">Not in wallet</span>
                      <h3 className="font-display font-bold text-text-primary mb-1">{alt.dbCard.name}</h3>
                      <p className="text-xs text-text-muted mb-4">{alt.dbCard.issuer} • ₹{formatINR(alt.dbCard.annual_fee_inr || 0)} annual fee</p>

                      <div className="mt-auto">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-text-muted">Earn rate</span>
                          <span className="font-bold text-pastel-peach">{alt.pointsPer100} per ₹100</span>
                        </div>
                        <div className="flex justify-between text-sm mb-4">
                          <span className="text-text-muted">You'd earn</span>
                          <span className="font-bold text-pastel-mint">{formatINR(alt.pointsEarned)} pts ≈ ₹{formatINR(Math.round(alt.valueInr))}</span>
                        </div>
                        <button
                          onClick={() => navigate('/cards')}
                          className="w-full py-2 rounded-xl font-bold text-sm border border-pastel-peach/40 text-pastel-peach hover:bg-pastel-peach/10 transition-colors"
                        >
                          Add to My Cards
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {result === 'calculated' && !recommendation && (
          <div className="glass-card p-8 text-center rounded-3xl border border-dashed border-white/20">
            <p className="text-text-muted">Enter a valid amount to see recommendations.</p>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BestCard;
