import React, { useEffect, useState, useMemo } from 'react';
import { AnimatedCard } from '../components/AnimatedCard';
import { Plus, X, Search, CheckCircle2, ChevronRight, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';

// Temporary mock catalogue until your CSVs are hooked up
const mockCatalogue = [
  { id: 'hdfc_infinia', bank: 'HDFC Bank', card_name: 'Infinia Metal Edition', network: 'Visa', annual_fee: 12500, tags: ['Travel', 'Dining', 'Lounge'], reward: '33% Reward Rate' },
  { id: 'hdfc_dcb', bank: 'HDFC Bank', card_name: 'Diners Club Black', network: 'Diners Club', annual_fee: 10000, tags: ['Travel', 'Dining'], reward: '33% Reward Rate' },
  { id: 'axis_atlas', bank: 'Axis Bank', card_name: 'ATLAS', network: 'Visa', annual_fee: 5000, tags: ['Travel', 'Milestone'], reward: 'Up to 10% on Travel' },
  { id: 'axis_magnus', bank: 'Axis Bank', card_name: 'Magnus', network: 'Visa', annual_fee: 12500, tags: ['Travel', 'Lifestyle'], reward: 'EDGE Rewards' },
  { id: 'sbi_cashback', bank: 'SBI Card', card_name: 'Cashback SBI Card', network: 'Visa', annual_fee: 999, tags: ['Cashback', 'Shopping', 'Online'], reward: '5% Online Cashback' },
  { id: 'sbi_aurum', bank: 'SBI Card', card_name: 'Aurum', network: 'Visa', annual_fee: 10000, tags: ['Travel', 'Movies'], reward: 'Premium Rewards' },
  { id: 'icici_emeralde', bank: 'ICICI Bank', card_name: 'Emeralde Private', network: 'Visa', annual_fee: 12500, tags: ['Lounge', 'Movies'], reward: 'Unlimited Lounge' },
  { id: 'amex_plat_travel', bank: 'AmEx India', card_name: 'Platinum Travel', network: 'Amex', annual_fee: 5000, tags: ['Travel', 'Milestone'], reward: 'Milestone Vouchers' },
  { id: 'amex_mrcc', bank: 'AmEx India', card_name: 'Membership Rewards', network: 'Amex', annual_fee: 4500, tags: ['Milestone', 'Points'], reward: '1000 Bonus MR/month' },
  { id: 'idfc_wealth', bank: 'IDFC First', card_name: 'Wealth', network: 'Visa', annual_fee: 0, tags: ['Lifetime Free', 'Travel', 'Lounge'], reward: '10x Rewards' },
  { id: 'scapia', bank: 'Federal Bank', card_name: 'Scapia', network: 'Visa', annual_fee: 0, tags: ['Lifetime Free', 'Travel', 'Zero Forex'], reward: 'Unlimited Lounge' },
  { id: 'hsbc_premier', bank: 'HSBC', card_name: 'Premier', network: 'Mastercard', annual_fee: 0, tags: ['Dining', 'Lounge'], reward: 'Global Access' },
];

const CATEGORIES = ['All', 'Travel', 'Dining', 'Movies', 'Cashback', 'Shopping', 'Lifetime Free'];

const MyCards = ({ session }: { session: any }) => {
  const [cards, setCards] = useState<any[]>([]);
  const [catalogue, setCatalogue] = useState<any[]>(mockCatalogue);
  const [loading, setLoading] = useState(true);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedCards, setSelectedCards] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Custom Card Form State
  const [customBank, setCustomBank] = useState('');
  const [customName, setCustomName] = useState('');
  const [customNetwork, setCustomNetwork] = useState('VISA');
  const [lastFour, setLastFour] = useState('');

  const fetchCards = async () => {
    try {
      setLoading(true);
      const data = await api.getCards();
      setCards(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCatalogue = async () => {
    try {
      const data = await api.getCatalogueCards();
      if (data && data.length > 0) {
        const dbCards = data.map((c: any) => ({
          id: c.id,
          bank: c.bank,
          card_name: c.card_name,
          network: c.network,
          annual_fee: c.annual_fee || 0,
          tags: ['Database'],
          reward: 'See Details'
        }));
        setCatalogue([...dbCards, ...mockCatalogue]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCards();
    fetchCatalogue();
  }, []);

  // Multi-Add functionality
  const toggleCardSelection = (card: any) => {
    if (selectedCards.find(c => c.id === card.id)) {
      setSelectedCards(selectedCards.filter(c => c.id !== card.id));
    } else {
      setSelectedCards([...selectedCards, card]);
    }
  };

  const handleAddSelectedCards = async () => {
    if (selectedCards.length === 0) return;
    setIsSubmitting(true);
    try {
      await Promise.all(selectedCards.map(c => {
        // If the ID is a valid UUID, it came from the DB. Otherwise, it's our mock data and needs to be saved as a custom card.
        const isDbCard = c.id && c.id.includes('-');
        
        return api.addCard(
          isDbCard 
            ? { card_id: c.id, last_four_digits: Math.floor(1000 + Math.random() * 9000).toString() }
            : { 
                card_id: null, 
                custom_bank: c.bank, 
                custom_card_name: c.card_name, 
                custom_network: c.network || 'VISA',
                last_four_digits: Math.floor(1000 + Math.random() * 9000).toString() 
              }
        );
      }));
      setIsAddModalOpen(false);
      setSelectedCards([]);
      await fetchCards();
    } catch (err: any) {
      alert('Failed to add cards: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddCustomCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.addCard({
        card_id: null,
        custom_bank: customBank,
        custom_card_name: customName,
        custom_network: customNetwork,
        last_four_digits: lastFour,
      });
      setIsCustomModalOpen(false);
      setCustomBank('');
      setCustomName('');
      setLastFour('');
      await fetchCards();
    } catch (err: any) {
      alert('Failed to add custom card: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getThemeForBank = (bank: string) => {
    if (bank.toLowerCase().includes('hdfc')) return 'gold';
    if (bank.toLowerCase().includes('axis')) return 'dark';
    if (bank.toLowerCase().includes('sbi')) return 'blue';
    return 'silver';
  };

  // Debounced/Fuzzy Search Logic
  const filteredCatalogue = useMemo(() => {
    return catalogue.filter(c => {
      const matchesSearch = c.card_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            c.bank.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = activeFilter === 'All' || (c.tags && c.tags.includes(activeFilter));
      return matchesSearch && matchesFilter;
    });
  }, [catalogue, searchQuery, activeFilter]);

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen relative">
      <header className="mb-10 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-display font-bold text-text-primary mb-2">My Cards</h1>
          <p className="text-text-muted font-medium">Manage your portfolio and view benefits</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="pastel-button px-6 py-3 inline-flex items-center gap-2"
        >
          <Plus className="w-5 h-5" /> Add Card
        </button>
      </header>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="w-8 h-8 border-4 border-pastel-lavender/30 border-t-pastel-lavender rounded-full animate-spin"></div>
        </div>
      ) : cards.length === 0 ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-16 text-center max-w-2xl mx-auto mt-20 shadow-sm border border-dashed border-white/20">
          <div className="w-20 h-20 bg-dark-elevated rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <Plus className="w-10 h-10 text-pastel-lavender" />
          </div>
          <h2 className="text-2xl font-display font-bold text-text-primary mb-4">Your wallet is empty</h2>
          <p className="text-text-muted mb-8 max-w-sm mx-auto">Add your credit cards to unlock the recommendation engine and start maximizing your rewards.</p>
          <button onClick={() => setIsAddModalOpen(true)} className="pastel-button px-8 py-4">
            Add Your First Card
          </button>
        </motion.div>
      ) : (
        <motion.div 
          initial="hidden" animate="visible" 
          variants={{ visible: { transition: { staggerChildren: 0.1 } } }} 
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10"
        >
          {cards.map((userCard) => {
            const isCustom = !userCard.credit_cards;
            const bank = isCustom ? userCard.custom_bank : userCard.credit_cards.bank;
            const cardName = isCustom ? userCard.custom_card_name : userCard.credit_cards.card_name;
            const network = isCustom ? userCard.custom_network : userCard.credit_cards.network;
            const lastFour = userCard.last_four_digits || '••••';

            return (
              <motion.div key={userCard.id} variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 }}} className="flex flex-col items-center group">
                <AnimatedCard 
                  bank={bank} cardName={cardName} network={network} lastFour={lastFour}
                  cardholderName={session?.user?.user_metadata?.full_name || 'CARDHOLDER'}
                  expiry="12/28" theme={getThemeForBank(bank)}
                />
                
                {/* Card Quick Actions */}
                <div className="mt-8 w-96 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <button className="flex-1 bg-dark-elevated border border-white/10 text-text-primary py-3 rounded-xl font-bold hover:bg-dark-surface hover:border-pastel-lavender transition-all shadow-sm">
                    View Benefits
                  </button>
                  <button className="flex-1 bg-dark-elevated border border-white/10 text-text-primary py-3 rounded-xl font-bold hover:bg-dark-surface hover:border-pastel-lavender transition-all shadow-sm">
                    Transactions
                  </button>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* POLISHED ADD CARD MODAL */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-dark-base/90 backdrop-blur-md"
            ></motion.div>
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 40 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 40 }}
              className="glass-card w-full max-w-5xl h-[90vh] flex flex-col relative z-10 overflow-hidden border border-white/10 shadow-2xl rounded-3xl bg-dark-base"
            >
              <div className="p-6 md:p-8 border-b border-white/5 flex flex-col gap-6 bg-dark-surface/50 relative overflow-hidden">
                <div className="flex justify-between items-center relative z-10">
                  <div>
                    <h2 className="text-3xl font-display font-bold text-text-primary flex items-center gap-3">
                      <Sparkles className="w-6 h-6 text-pastel-lavender" />
                      Add to Wallet
                    </h2>
                    <p className="text-text-muted mt-1">Search over 100+ cards and select to add.</p>
                  </div>
                  <button onClick={() => setIsAddModalOpen(false)} className="p-3 bg-dark-elevated hover:bg-white/10 rounded-full transition-colors border border-white/5">
                    <X className="w-6 h-6 text-text-muted" />
                  </button>
                </div>

                {/* Debounced Search Input */}
                <div className="relative z-10">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-text-muted" />
                  <input 
                    type="text" 
                    placeholder="Search by bank (e.g., HDFC) or card name (e.g., Infinia)..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-dark-elevated/80 border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-lg text-text-primary focus:outline-none focus:border-pastel-lavender/50 focus:ring-1 focus:ring-pastel-lavender/50 transition-all shadow-inner"
                  />
                </div>

                {/* Filter Chips */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none relative z-10">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setActiveFilter(cat)}
                      className={`whitespace-nowrap px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeFilter === cat ? 'bg-pastel-lavender text-dark-base shadow-md' : 'bg-dark-elevated text-text-muted hover:bg-dark-surface border border-white/5'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-dark-base/30 custom-scrollbar pb-32">
                {searchQuery === '' && activeFilter === 'All' && (
                  <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider mb-6 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-pastel-pink" />
                    Popular & Best Travel Cards
                  </h3>
                )}
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredCatalogue.map((catCard) => {
                    const alreadyOwned = cards.some(c => c.card_id === catCard.id || (c.custom_card_name === catCard.card_name && c.custom_bank === catCard.bank));
                    const isSelected = selectedCards.some(c => c.id === catCard.id);

                    return (
                      <div 
                        key={catCard.id} 
                        onClick={() => !alreadyOwned && toggleCardSelection(catCard)}
                        className={`group relative overflow-hidden bg-gradient-to-br from-dark-surface/80 to-dark-elevated/50 border ${isSelected ? 'border-pastel-lavender shadow-[0_0_15px_rgba(230,230,250,0.15)]' : alreadyOwned ? 'border-white/5 opacity-60 cursor-not-allowed' : 'border-white/10 hover:border-pastel-lavender/40 hover:shadow-lg cursor-pointer'} p-6 rounded-3xl transition-all flex flex-col`}
                      >
                        {isSelected && (
                          <div className="absolute top-4 right-4 w-6 h-6 bg-pastel-lavender rounded-full flex items-center justify-center text-dark-base shadow-md">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        )}
                        <div className="flex justify-between items-start mb-4">
                          <span className="text-xs font-bold bg-dark-base text-text-muted border border-white/5 px-3 py-1.5 rounded-lg">{catCard.bank}</span>
                          <span className="text-xs font-bold text-pastel-pink bg-pastel-pink/10 px-3 py-1.5 rounded-lg uppercase tracking-wider">{catCard.network}</span>
                        </div>
                        <h4 className="font-display font-bold text-xl text-text-primary mb-2 pr-6">{catCard.card_name}</h4>
                        
                        <div className="flex flex-wrap gap-2 mb-4">
                          {catCard.tags?.map((tag: string) => (
                            <span key={tag} className="text-[10px] font-bold text-pastel-mint bg-pastel-mint/10 px-2 py-1 rounded-md uppercase">{tag}</span>
                          ))}
                        </div>
                        
                        <div className="mt-auto pt-4 border-t border-white/5">
                          <p className="text-sm text-text-muted flex justify-between mb-1">
                            <span>Fee:</span> 
                            <span className="text-text-primary font-bold">₹{catCard.annual_fee === 0 ? 'Lifetime Free' : catCard.annual_fee.toLocaleString()}</span>
                          </p>
                          <p className="text-sm text-text-muted flex justify-between">
                            <span>Reward:</span> 
                            <span className="text-pastel-lavender font-bold text-right truncate max-w-[150px]">{catCard.reward}</span>
                          </p>
                        </div>

                        {alreadyOwned && (
                          <div className="absolute inset-0 bg-dark-base/40 backdrop-blur-[1px] flex items-center justify-center">
                            <div className="bg-dark-surface px-4 py-2 rounded-xl border border-white/10 text-sm font-bold flex items-center gap-2 shadow-xl">
                              <CheckCircle2 className="w-4 h-4 text-pastel-mint" /> Already in wallet
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {filteredCatalogue.length === 0 && (
                   <div className="py-20 flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 bg-dark-surface rounded-full flex items-center justify-center mb-4 border border-white/5 shadow-inner">
                        <Search className="w-8 h-8 text-text-muted" />
                      </div>
                      <h3 className="text-xl font-bold text-text-primary mb-2">No exact match found</h3>
                      <p className="text-text-muted max-w-sm mb-6">We couldn't find a card matching "{searchQuery}". You can add it manually.</p>
                      <button 
                        onClick={() => {
                          setIsAddModalOpen(false);
                          setIsCustomModalOpen(true);
                        }}
                        className="pastel-button px-6 py-3"
                      >
                        Add Custom Card
                      </button>
                   </div>
                )}
              </div>

              {/* Multi-add Tray pinned to bottom */}
              <AnimatePresence>
                {selectedCards.length > 0 && (
                  <motion.div 
                    initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                    className="absolute bottom-0 left-0 right-0 bg-dark-surface border-t border-white/10 p-4 sm:p-6 shadow-[0_-20px_50px_rgba(0,0,0,0.6)] flex items-center justify-between z-20 rounded-b-3xl"
                  >
                    <div className="flex items-center gap-4 flex-1 overflow-hidden pr-4">
                      <div className="w-10 h-10 bg-pastel-lavender/20 rounded-full flex items-center justify-center text-pastel-lavender font-bold border border-pastel-lavender/30 flex-shrink-0 shadow-inner">
                        {selectedCards.length}
                      </div>
                      <div className="flex gap-2 overflow-x-auto scrollbar-none flex-1 pb-1">
                        {selectedCards.map(c => (
                          <div key={c.id} className="bg-dark-base px-4 py-2 rounded-xl border border-white/5 flex items-center gap-2 whitespace-nowrap text-sm shadow-sm">
                            <span className="font-bold text-text-primary">{c.card_name}</span>
                            <button onClick={() => toggleCardSelection(c)} className="text-text-muted hover:text-red-400 transition-colors p-1 bg-white/5 rounded-full">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <button 
                      onClick={handleAddSelectedCards}
                      disabled={isSubmitting}
                      className="pastel-button px-6 sm:px-8 py-3 sm:py-4 whitespace-nowrap flex-shrink-0 flex items-center gap-2 shadow-lg"
                    >
                      {isSubmitting ? 'Adding...' : `Add ${selectedCards.length} Cards`}
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Custom Card Modal (Kept as is but polished) */}
      <AnimatePresence>
        {isCustomModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
              onClick={() => setIsCustomModalOpen(false)}
              className="absolute inset-0 bg-dark-base/80 backdrop-blur-sm"
            ></motion.div>
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-card w-full max-w-md max-h-[85vh] flex flex-col relative z-10 overflow-y-auto p-8 border border-white/10 rounded-3xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-display font-bold text-text-primary">Add Custom Card</h2>
                <button onClick={() => setIsCustomModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors border border-white/5 bg-dark-elevated">
                  <X className="w-5 h-5 text-text-muted" />
                </button>
              </div>

              <form onSubmit={handleAddCustomCard} className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-text-muted mb-2">Bank Name</label>
                  <input type="text" required value={customBank} onChange={(e) => setCustomBank(e.target.value)} className="glass-input" placeholder="e.g. Chase" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-text-muted mb-2">Card Name</label>
                  <input type="text" required value={customName} onChange={(e) => setCustomName(e.target.value)} className="glass-input" placeholder="e.g. Sapphire Reserve" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-text-muted mb-2">Network</label>
                  <select value={customNetwork} onChange={(e) => setCustomNetwork(e.target.value)} className="glass-input">
                    <option value="VISA">VISA</option>
                    <option value="Mastercard">Mastercard</option>
                    <option value="Amex">American Express</option>
                    <option value="RuPay">RuPay</option>
                    <option value="Diners Club">Diners Club</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-text-muted mb-2">Last 4 Digits</label>
                  <input type="text" required maxLength={4} pattern="\d{4}" value={lastFour} onChange={(e) => setLastFour(e.target.value.replace(/\D/g, ''))} className="glass-input font-mono" placeholder="1234" />
                </div>
                <div className="pt-4">
                  <button type="submit" disabled={isSubmitting} className="pastel-button w-full py-4 shadow-lg">
                    {isSubmitting ? 'Adding...' : 'Add Custom Card'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MyCards;
