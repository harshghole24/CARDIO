import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plane, ArrowRight, MapPin, Calculator, Sparkles, Navigation, Ticket } from 'lucide-react';
import { calculateRequiredSpend } from '../lib/travelCalculator';
import { api } from '../lib/api';

// Fallback rates if the card doesn't have it defined
const FALLBACK_EARN_RATE = { base_rate: 1, base_spend: 100 };

const MOCK_PARTNERS = [
  { partner_id: 'krisflyer', name: 'Singapore KrisFlyer', ratio_from: 1, ratio_to: 2 }, // 1 EDGE Mile = 2 KrisFlyer (Atlas)
  { partner_id: 'club_vistara', name: 'Club Vistara CV Points', ratio_from: 1, ratio_to: 1 }, // 1 RP = 1 CV (Infinia)
  { partner_id: 'qmiles', name: 'Qatar Airways Privilege Club', ratio_from: 5, ratio_to: 4 },
];

// Destinations removed, will be custom user input

const TravelGoals = () => {
  const [userCards, setUserCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCardId, setSelectedCardId] = useState('');
  const [selectedPartnerId, setSelectedPartnerId] = useState(MOCK_PARTNERS[0].partner_id);
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [milesNeeded, setMilesNeeded] = useState(25000);

  useEffect(() => {
    const fetchCards = async () => {
      try {
        const cards = await api.getCards();
        setUserCards(cards || []);
        if (cards && cards.length > 0) {
          setSelectedCardId(cards[0].id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCards();
  }, []);

  const selectedCardData = userCards.find(c => c.id === selectedCardId);
  
  // Extract earn rate from the database if available, otherwise use fallback
  const cardEarnRate = useMemo(() => {
    if (selectedCardData && selectedCardData.credit_cards && selectedCardData.credit_cards.reward_rate) {
      // Very basic parsing for demo
      const base = selectedCardData.credit_cards.reward_rate.base || 1;
      return { base_rate: base, base_spend: 100 };
    }
    // If it's a custom mock card like Scapia, it won't have credit_cards populated from the DB
    return FALLBACK_EARN_RATE;
  }, [selectedCardData]);

  const selectedPartner = MOCK_PARTNERS.find(p => p.partner_id === selectedPartnerId)!;

  // The math engine kicking in!
  const requiredSpend = useMemo(() => {
    return calculateRequiredSpend(
      milesNeeded,
      selectedPartner,
      cardEarnRate
    );
  }, [cardEarnRate, selectedPartner, milesNeeded]);

  const bankPointsNeeded = Math.ceil((milesNeeded / selectedPartner.ratio_to) * selectedPartner.ratio_from);

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><div className="animate-spin w-8 h-8 border-4 border-pastel-lavender border-t-transparent rounded-full"></div></div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen">
      <header className="mb-10">
        <h1 className="text-3xl font-display font-bold text-text-primary mb-2 flex items-center gap-3">
          <Plane className="w-8 h-8 text-pastel-lavender" />
          Travel Goals Engine
        </h1>
        <p className="text-text-muted font-medium">Reverse calculate exact card spends needed for your dream flights.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Left Col: The Calculator Inputs */}
        <div className="lg:col-span-5 space-y-8">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="glass-card p-6 border border-white/10 rounded-3xl">
            <h2 className="text-xl font-display font-bold text-text-primary mb-6 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-pastel-pink" /> Planning Params
            </h2>

            <div className="space-y-6">
              {/* Target Flight */}
              <div>
                <label className="block text-sm font-bold text-text-muted mb-2">1. Where to?</label>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-pastel-lavender" />
                    <input 
                      type="text"
                      placeholder="Origin (e.g. BLR)"
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value)}
                      className="w-full bg-dark-elevated border border-white/10 rounded-xl py-3 pl-10 pr-4 text-text-primary focus:outline-none focus:border-pastel-lavender/50 shadow-inner"
                    />
                  </div>
                  <div className="relative">
                    <Plane className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-pastel-pink" />
                    <input 
                      type="text"
                      placeholder="Destination (e.g. SIN)"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      className="w-full bg-dark-elevated border border-white/10 rounded-xl py-3 pl-10 pr-4 text-text-primary focus:outline-none focus:border-pastel-pink/50 shadow-inner"
                    />
                  </div>
                </div>
                <div className="relative">
                  <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-pastel-mint" />
                  <input 
                    type="number"
                    placeholder="Estimated Miles Needed"
                    value={milesNeeded || ''}
                    onChange={(e) => setMilesNeeded(parseInt(e.target.value) || 0)}
                    className="w-full bg-dark-elevated border border-white/10 rounded-xl py-4 pl-12 pr-4 text-text-primary focus:outline-none focus:border-pastel-mint/50 shadow-inner"
                  />
                </div>
              </div>

              {/* Loyalty Program */}
              <div>
                <label className="block text-sm font-bold text-text-muted mb-2">2. Loyalty Program</label>
                <div className="relative">
                  <Navigation className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-pastel-mint" />
                  <select 
                    value={selectedPartnerId}
                    onChange={(e) => setSelectedPartnerId(e.target.value)}
                    className="w-full bg-dark-elevated border border-white/10 rounded-xl py-4 pl-12 pr-4 text-text-primary focus:outline-none focus:border-pastel-lavender/50 appearance-none shadow-inner"
                  >
                    {MOCK_PARTNERS.map(p => (
                      <option key={p.partner_id} value={p.partner_id}>
                        {p.name} ({p.ratio_from} Card Pts = {p.ratio_to} Miles)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Credit Card */}
              <div>
                <label className="block text-sm font-bold text-text-muted mb-2">3. Using Which Card?</label>
                <div className="relative">
                  <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-pastel-pink" />
                  <select 
                    value={selectedCardId}
                    onChange={(e) => setSelectedCardId(e.target.value)}
                    className="w-full bg-dark-elevated border border-white/10 rounded-xl py-4 pl-12 pr-4 text-text-primary focus:outline-none focus:border-pastel-lavender/50 appearance-none shadow-inner"
                  >
                    {userCards.length === 0 && <option value="">No cards in wallet</option>}
                    {userCards.map(c => {
                      const name = c.credit_cards?.card_name || c.custom_card_name;
                      const bank = c.credit_cards?.bank || c.custom_bank;
                      return (
                        <option key={c.id} value={c.id}>
                          {bank} {name}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Col: Boarding Pass & Results */}
        <div className="lg:col-span-7">
          <motion.div 
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="w-full overflow-hidden"
          >
            {/* BOARDING PASS UI */}
            <div className="flex flex-col md:flex-row shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
              
              {/* Left Ticket Part */}
              <div className="bg-gradient-to-br from-pastel-lavender/10 to-pastel-pink/10 backdrop-blur-xl border border-white/20 p-8 rounded-t-3xl md:rounded-l-3xl md:rounded-tr-none flex-1 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Plane className="w-32 h-32 rotate-45" />
                </div>
                
                <div className="flex justify-between items-center mb-10 relative z-10">
                  <span className="text-xs font-bold uppercase tracking-widest text-text-muted border border-white/10 px-3 py-1 rounded-full bg-dark-base/50">Award Flight</span>
                  <span className="font-display font-bold text-pastel-lavender">{origin && destination ? 'Custom Flight' : 'Select Route'}</span>
                </div>

                <div className="flex justify-between items-center relative z-10">
                  <div>
                    <h3 className="text-5xl font-display font-black text-text-primary">{origin || 'XXX'}</h3>
                    <p className="text-text-muted mt-2 text-sm uppercase tracking-wider">Departure</p>
                  </div>
                  
                  {/* Animated Plane Track */}
                  <div className="flex-1 px-6 flex flex-col items-center justify-center relative">
                    <div className="w-full border-t-2 border-dashed border-pastel-lavender/30 absolute top-1/2 -translate-y-1/2"></div>
                    <motion.div 
                      animate={{ x: [0, 150, 0] }} 
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                      className="bg-dark-base p-2 rounded-full z-10 border border-pastel-lavender/20 shadow-[0_0_15px_rgba(230,230,250,0.3)]"
                    >
                      <Plane className="w-5 h-5 text-pastel-lavender" />
                    </motion.div>
                  </div>

                  <div className="text-right">
                    <h3 className="text-5xl font-display font-black text-text-primary">{destination || 'XXX'}</h3>
                    <p className="text-text-muted mt-2 text-sm uppercase tracking-wider">Arrival</p>
                  </div>
                </div>

                <div className="mt-10 grid grid-cols-2 gap-4 relative z-10">
                  <div>
                    <p className="text-xs text-text-muted uppercase mb-1">Miles Required</p>
                    <p className="text-2xl font-bold text-text-primary">{milesNeeded.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-muted uppercase mb-1">Loyalty Program</p>
                    <p className="font-bold text-text-primary truncate">{selectedPartner.name}</p>
                  </div>
                </div>
              </div>

              {/* Ticket Divider */}
              <div className="bg-dark-surface flex flex-row md:flex-col items-center justify-center relative border-y md:border-y-0 md:border-x border-white/10 overflow-hidden">
                <div className="absolute top-0 w-4 h-4 rounded-full bg-dark-base -translate-y-1/2"></div>
                <div className="w-full h-full border-t md:border-l md:border-t-0 border-dashed border-white/20 mx-auto"></div>
                <div className="absolute bottom-0 w-4 h-4 rounded-full bg-dark-base translate-y-1/2"></div>
              </div>

              {/* Right Ticket Part (The Math) */}
              <div className="bg-dark-elevated border border-white/10 p-8 rounded-b-3xl md:rounded-r-3xl md:rounded-bl-none md:w-64 flex flex-col justify-center items-center text-center">
                <Sparkles className="w-8 h-8 text-pastel-mint mb-4" />
                <p className="text-xs text-text-muted uppercase tracking-wider mb-2">Spend Required on<br/>{selectedCardData ? (selectedCardData.credit_cards?.card_name || selectedCardData.custom_card_name) : 'Selected Card'}</p>
                <h3 className="text-3xl font-black text-pastel-mint">₹{requiredSpend.toLocaleString()}</h3>
                
                <div className="mt-6 w-full p-4 bg-dark-base rounded-xl border border-white/5 text-sm">
                  <p className="text-text-muted mb-1">Bank Points Needed</p>
                  <p className="font-bold text-text-primary">{bankPointsNeeded.toLocaleString()}</p>
                </div>
              </div>
              
            </div>
            {/* END BOARDING PASS */}

            <div className="mt-8 flex justify-end">
              <button className="pastel-button px-8 py-4 shadow-lg flex items-center gap-2">
                Save as Goal <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        </div>

      </div>
    </div>
  );
};

export default TravelGoals;
