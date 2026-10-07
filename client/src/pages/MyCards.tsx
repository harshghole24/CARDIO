import React, { useEffect, useState, useMemo } from 'react';
import { AnimatedCard } from '../components/AnimatedCard';
import { Plus, X, Search, CheckCircle2, ChevronRight, Sparkles, ExternalLink, ShieldCheck, ShieldAlert, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';
import { useDataStore } from '../lib/data/DataContext';
import { useNavigate } from 'react-router-dom';

const CATEGORIES = ['All', 'Travel', 'Dining', 'Movies', 'Cashback', 'Shopping', 'Lifetime Free'];

const MyCards = ({ session }: { session: any }) => {
  const navigate = useNavigate();
  const { store, loading: dataLoading } = useDataStore();
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedCards, setSelectedCards] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Benefits Modal State
  const [selectedCardForBenefits, setSelectedCardForBenefits] = useState<any>(null);

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

  useEffect(() => {
    fetchCards();
  }, []);

  const handleRemoveCard = async (userCardId: string) => {
    if (!window.confirm("Are you sure you want to remove this card?")) return;
    
    // Optimistic UI
    const previousCards = [...cards];
    setCards(cards.filter(c => c.id !== userCardId));
    setSelectedCardForBenefits(null);
    
    try {
      await api.deleteCard(userCardId);
    } catch (err) {
      alert("Failed to remove card: " + (err as Error).message);
      setCards(previousCards); // Rollback
      console.error(err);
    }
  };

  // Debounced/Fuzzy Search Logic for Catalogue
  const catalogue = useMemo(() => {
    if (!store) return [];
    return store.cards.map(c => ({
      id: c.card_id,
      bank: c.issuer,
      card_name: c.name,
      network: c.network,
      annual_fee: c.annual_fee_inr,
      tags: [], 
      reward: `${c.base_reward_rate_pct}% Base Reward`,
      data: c 
    }));
  }, [store]);

  const filteredCatalogue = useMemo(() => {
    return catalogue.filter(c => {
      const matchesSearch = c.card_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            c.bank.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [catalogue, searchQuery]);

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
    
    // Check for duplicates before hitting server
    const duplicates = selectedCards.filter(c => cards.some(existing => existing.card_id === c.id));
    if (duplicates.length > 0) {
      alert(`You already have ${duplicates.map(d => d.card_name).join(', ')} in your wallet.`);
      setIsSubmitting(false);
      return;
    }

    try {
      const addedCards = await Promise.all(selectedCards.map(c => {
        return api.addCard({ 
          card_id: c.id, 
          last_four_digits: Math.floor(1000 + Math.random() * 9000).toString() 
        });
      }));
      
      // Update state with newly added cards mapping to full data using store
      const enrichedAddedCards = addedCards.map(newCard => ({
        ...newCard,
        credit_cards: store?.cardById.get(newCard.card_id)
      }));
      
      setCards([...cards, ...enrichedAddedCards]);
      setIsAddModalOpen(false);
      setSelectedCards([]);
    } catch (err: any) {
      alert('Failed to add cards: ' + (err.message || 'Error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getThemeForBank = (bank: string) => {
    if (bank?.toLowerCase().includes('hdfc')) return 'gold';
    if (bank?.toLowerCase().includes('axis')) return 'dark';
    if (bank?.toLowerCase().includes('sbi')) return 'blue';
    if (bank?.toLowerCase().includes('amex')) return 'silver';
    return 'silver';
  };

  if (dataLoading) {
    return <div className="flex h-screen items-center justify-center"><div className="animate-spin w-10 h-10 border-4 border-pastel-lavender border-t-transparent rounded-full"></div></div>;
  }

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
            const bank = isCustom ? userCard.custom_bank : userCard.credit_cards.bank || userCard.credit_cards.issuer;
            const cardName = isCustom ? userCard.custom_card_name : userCard.credit_cards.card_name || userCard.credit_cards.name;
            const network = isCustom ? userCard.custom_network : userCard.credit_cards.network;
            const lastFour = userCard.last_four_digits || '••••';

            return (
              <motion.div key={userCard.id} variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 }}} className="flex flex-col items-center group">
                <AnimatedCard 
                  bank={bank} cardName={cardName} network={network || 'VISA'} lastFour={lastFour}
                  cardholderName={session?.user?.user_metadata?.full_name || 'CARDHOLDER'}
                  expiry="12/28" theme={getThemeForBank(bank)}
                />
                
                {/* Card Quick Actions */}
                <div className="mt-8 w-96 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <button 
                    onClick={() => setSelectedCardForBenefits(userCard)}
                    className="flex-1 bg-dark-elevated border border-white/10 text-text-primary py-3 rounded-xl font-bold hover:bg-dark-surface hover:border-pastel-lavender transition-all shadow-sm"
                  >
                    View Benefits
                  </button>
                  <button 
                    onClick={() => navigate('/transactions')}
                    className="flex-1 bg-dark-elevated border border-white/10 text-text-primary py-3 rounded-xl font-bold hover:bg-dark-surface hover:border-pastel-lavender transition-all shadow-sm"
                  >
                    Transactions
                  </button>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Benefits Drawer/Modal */}
      <AnimatePresence>
        {selectedCardForBenefits && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
              onClick={() => setSelectedCardForBenefits(null)}
              className="absolute inset-0 bg-dark-base/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-lg h-full bg-dark-surface border-l border-white/10 relative z-10 overflow-y-auto shadow-2xl flex flex-col"
            >
              {(() => {
                const uc = selectedCardForBenefits;
                const dbCard = store?.cardById.get(uc.card_id);
                const isCustom = !dbCard;
                
                if (isCustom) {
                  return (
                    <div className="p-8">
                      <div className="flex justify-between items-start mb-6">
                        <h2 className="text-2xl font-bold">Custom Card</h2>
                        <button onClick={() => setSelectedCardForBenefits(null)} className="p-2 hover:bg-white/10 rounded-full"><X/></button>
                      </div>
                      <p className="text-text-muted">Benefits engine not available for custom cards.</p>
                      <button onClick={() => handleRemoveCard(uc.id)} className="mt-8 text-red-400 font-bold flex items-center gap-2 hover:bg-red-400/10 p-3 rounded-xl"><Trash2 className="w-4 h-4"/> Remove Card</button>
                    </div>
                  );
                }

                // Render real data
                const transferPartners = store?.ratiosByCard.get(dbCard.card_id) || [];
                const movieDining = store?.movieDiningByCard.get(dbCard.card_id) || [];

                return (
                  <>
                    <div className="p-8 border-b border-white/5 bg-dark-base relative sticky top-0 z-20">
                      <button onClick={() => setSelectedCardForBenefits(null)} className="absolute top-8 right-8 p-2 hover:bg-white/10 rounded-full"><X/></button>
                      <h2 className="text-2xl font-bold text-text-primary mb-2 pr-10">{dbCard.name}</h2>
                      <p className="text-pastel-lavender font-medium">{dbCard.issuer} • {dbCard.network} • {dbCard.tier}</p>
                    </div>
                    
                    <div className="p-8 space-y-8 flex-1">
                      {/* Fees */}
                      <section>
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Sparkles className="w-5 h-5 text-pastel-pink"/> Financials</h3>
                        <div className="bg-dark-elevated rounded-xl p-4 border border-white/5 grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-text-muted uppercase">Annual Fee</p>
                            <p className="font-bold">₹{dbCard.annual_fee_inr}</p>
                          </div>
                          <div>
                            <p className="text-xs text-text-muted uppercase">Fee Waiver</p>
                            <p className="font-bold">{dbCard.fee_waiver_spend_inr ? `₹${dbCard.fee_waiver_spend_inr} spend` : 'None'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-text-muted uppercase">Forex Markup</p>
                            <p className="font-bold">{dbCard.forex_markup_pct ? `${dbCard.forex_markup_pct}%` : 'Standard'}</p>
                          </div>
                        </div>
                      </section>

                      {/* Earn Rates */}
                      <section>
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Sparkles className="w-5 h-5 text-pastel-mint"/> Earning Rate</h3>
                        <div className="bg-dark-elevated rounded-xl p-4 border border-white/5 space-y-4">
                          <div className="flex justify-between items-center pb-4 border-b border-white/5">
                            <div>
                              <p className="text-sm font-bold text-text-primary">Base Reward Rate</p>
                              <p className="text-xs text-text-muted">{dbCard.base_points_per_100_inr_derived} {store?.currencyById.get(dbCard.reward_currency_id)?.name || 'Points'} per ₹100</p>
                            </div>
                            <span className="text-lg font-black text-pastel-mint">{dbCard.base_reward_rate_pct}%</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-sm font-bold text-text-primary">Max Accelerated Rate</p>
                              <p className="text-xs text-text-muted">{dbCard.max_points_per_100_inr_derived} points per ₹100 max</p>
                            </div>
                            <span className="text-lg font-black text-pastel-pink">{dbCard.max_reward_rate_pct}%</span>
                          </div>
                        </div>
                      </section>

                      {/* Transfer Partners */}
                      {transferPartners.length > 0 && (
                        <section>
                          <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Sparkles className="w-5 h-5 text-pastel-blue"/> Transfer Partners</h3>
                          <div className="space-y-3">
                            {transferPartners.map((ratio, idx) => {
                              const program = store?.programById.get(ratio.program_id);
                              return (
                                <div key={idx} className="bg-dark-elevated rounded-xl p-4 border border-white/5">
                                  <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-text-primary">{program?.name || ratio.program_id}</h4>
                                    <span className="bg-white/5 px-2 py-1 rounded text-xs font-bold text-pastel-lavender">{ratio.ratio_text}</span>
                                  </div>
                                  <div className="text-xs text-text-muted space-y-1">
                                    {ratio.min_transfer > 0 && <p>Min transfer: {ratio.min_transfer}</p>}
                                    {ratio.annual_cap && <p>Annual Cap: {ratio.annual_cap}</p>}
                                    <p className="flex items-center gap-1 mt-2">
                                      {ratio.confidence === 'EXPLICIT_SOURCE' ? <ShieldCheck className="w-3 h-3 text-pastel-mint"/> : <ShieldAlert className="w-3 h-3 text-pastel-peach"/>}
                                      Confidence: {ratio.confidence}
                                      {ratio.source_url && <a href={ratio.source_url} target="_blank" rel="noreferrer" className="ml-2 text-blue-400 hover:underline flex items-center gap-1">Source <ExternalLink className="w-3 h-3"/></a>}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      )}

                      {/* Movies & Dining */}
                      {movieDining.length > 0 && (
                        <section>
                          <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Sparkles className="w-5 h-5 text-pastel-peach"/> Other Benefits</h3>
                          <div className="space-y-3">
                            {movieDining.map((b, idx) => (
                              <div key={idx} className="bg-dark-elevated rounded-xl p-4 border border-white/5">
                                <span className="bg-white/5 px-2 py-1 rounded text-xs font-bold text-pastel-peach mb-2 inline-block uppercase tracking-wider">{b.category} • {b.platform}</span>
                                <p className="text-sm font-medium">{b.benefit}</p>
                                {b.cap && <p className="text-xs text-text-muted mt-2">Cap: {b.cap}</p>}
                              </div>
                            ))}
                          </div>
                        </section>
                      )}

                      {/* Disclaimer & Footer */}
                      <div className="mt-8 pt-8 border-t border-white/5">
                        <p className="text-xs text-text-muted italic mb-4">
                          Data as of {store?.dataAsOf}. Rates and benefits are subject to change. Always verify on the bank's official website.
                        </p>
                        <button onClick={() => handleRemoveCard(uc.id)} className="text-red-400 font-bold flex items-center justify-center gap-2 hover:bg-red-400/10 p-4 rounded-xl w-full border border-red-400/20 transition-colors">
                          <Trash2 className="w-5 h-5"/> Remove Card from Wallet
                        </button>
                      </div>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADD CARD MODAL */}
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
                    <p className="text-text-muted mt-1">Search over 200+ cards and select to add.</p>
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
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-dark-base/30 custom-scrollbar pb-32">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredCatalogue.slice(0, 50).map((catCard) => {
                    // Just showing first 50 to avoid massive render lag
                    const alreadyOwned = cards.some(c => c.card_id === catCard.id);
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
                        
                        <div className="mt-auto pt-4 border-t border-white/5">
                          <p className="text-sm text-text-muted flex justify-between mb-1">
                            <span>Fee:</span> 
                            <span className="text-text-primary font-bold">₹{catCard.annual_fee === 0 ? 'Free' : catCard.annual_fee.toLocaleString()}</span>
                          </p>
                          <p className="text-sm text-text-muted flex justify-between">
                            <span>Reward:</span> 
                            <span className="text-pastel-lavender font-bold text-right truncate max-w-[150px]">{catCard.reward}</span>
                          </p>
                        </div>

                        {alreadyOwned && (
                          <div className="absolute inset-0 bg-dark-base/40 backdrop-blur-[1px] flex items-center justify-center">
                            <div className="bg-dark-surface px-4 py-2 rounded-xl border border-white/10 text-sm font-bold flex items-center gap-2 shadow-xl">
                              <CheckCircle2 className="w-4 h-4 text-pastel-mint" /> Owned
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
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
    </div>
  );
};

export default MyCards;
