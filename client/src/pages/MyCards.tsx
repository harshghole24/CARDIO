import React, { useEffect, useState, useMemo } from 'react';
import { AnimatedCard } from '../components/AnimatedCard';
import {
  Plus, X, Search, CheckCircle2, ChevronRight, Sparkles, ExternalLink,
  ShieldCheck, ShieldAlert, Trash2, Clock, Calendar, Zap, Check, Bookmark,
  Pencil, AlertCircle, AlertTriangle, Mail, Phone
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';
import { useDataStore } from '../lib/data/DataContext';
import { useNavigate } from 'react-router-dom';
import {
  filterBrandRegistrations,
  generateRegistrationReminders,
  validateRegistrationInput,
} from '../lib/engine/brandRegistration';
import { maskIdentifier, type IdentifierType } from '../lib/utils/masking';

const MyCards = ({ session }: { session: any }) => {
  const navigate = useNavigate();
  const { store, loading: dataLoading } = useDataStore();
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCards, setSelectedCards] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Brand Registrations State
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [regSearchQuery, setRegSearchQuery] = useState('');
  const [regStatusFilter, setRegStatusFilter] = useState<'ALL' | 'REGISTERED' | 'PENDING' | 'NOT_REGISTERED'>('ALL');

  // Modal State for Add & Edit
  const [isRegModalOpen, setIsRegModalOpen] = useState(false);
  const [editingReg, setEditingReg] = useState<any | null>(null);

  // Form Fields
  const [regBrand, setRegBrand] = useState('');
  const [regCampaign, setRegCampaign] = useState('');
  const [regIdentifierType, setRegIdentifierType] = useState<IdentifierType>('EMAIL');
  const [regRawIdentifier, setRegRawIdentifier] = useState('');
  const [regStatus, setRegStatus] = useState<'REGISTERED' | 'PENDING' | 'NOT_REGISTERED'>('REGISTERED');
  const [regDate, setRegDate] = useState(new Date().toISOString().split('T')[0]);
  const [regPortal, setRegPortal] = useState('');
  const [regBenefit, setRegBenefit] = useState('');
  const [regValidUntil, setRegValidUntil] = useState('');
  const [regCardId, setRegCardId] = useState('');
  const [regNotes, setRegNotes] = useState('');
  const [regFormError, setRegFormError] = useState('');
  const [isSubmittingReg, setIsSubmittingReg] = useState(false);

  // Benefits Modal State
  const [selectedCardForBenefits, setSelectedCardForBenefits] = useState<any>(null);

  const fetchCards = async () => {
    try {
      setLoading(true);
      const [data, regData] = await Promise.all([
        api.getCards(),
        api.getBrandRegistrations().catch(() => [])
      ]);
      // Enrich with local CSV data since backend no longer joins
      const enriched = (data || []).map((c: any) => ({
        ...c,
        credit_cards: store?.cardById.get(c.card_id)
      }));
      setCards(enriched);
      setRegistrations(regData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (store) {
      fetchCards();
    }
  }, [store]);

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

  const openAddRegModal = () => {
    setEditingReg(null);
    setRegBrand('');
    setRegCampaign('');
    setRegIdentifierType('EMAIL');
    setRegRawIdentifier('');
    setRegStatus('REGISTERED');
    setRegDate(new Date().toISOString().split('T')[0]);
    setRegPortal('');
    setRegBenefit('');
    setRegValidUntil('');
    setRegCardId('');
    setRegNotes('');
    setRegFormError('');
    setIsRegModalOpen(true);
  };

  const openEditRegModal = (reg: any) => {
    setEditingReg(reg);
    setRegBrand(reg.brand_name || '');
    setRegCampaign(reg.campaign_name || '');
    setRegIdentifierType((reg.identifier_type as IdentifierType) || 'EMAIL');
    setRegRawIdentifier(reg.masked_identifier || '');
    setRegStatus(reg.status || 'PENDING');
    setRegDate(reg.registration_date ? reg.registration_date.split('T')[0] : new Date().toISOString().split('T')[0]);
    setRegPortal(reg.portal_url || '');
    setRegBenefit(reg.multiplier_benefit || '');
    setRegValidUntil(reg.valid_until ? reg.valid_until.split('T')[0] : '');
    setRegCardId(reg.user_card_id || '');
    setRegNotes(reg.notes || '');
    setRegFormError('');
    setIsRegModalOpen(true);
  };

  const handleSaveRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegFormError('');

    const validation = validateRegistrationInput({
      brand_name: regBrand,
      identifier_type: regIdentifierType,
      raw_identifier: regRawIdentifier,
      status: regStatus,
      existingRegistrations: registrations,
      currentRegistrationId: editingReg?.id,
    });

    if (!validation.valid) {
      setRegFormError(validation.error || 'Please verify your inputs.');
      return;
    }

    setIsSubmittingReg(true);
    try {
      if (editingReg) {
        const updated = await api.updateBrandRegistration(editingReg.id, {
          brand_name: regBrand.trim(),
          campaign_name: regCampaign.trim() || null,
          identifier_type: regIdentifierType,
          raw_identifier: regRawIdentifier.trim(),
          status: regStatus,
          registration_date: regDate || null,
          portal_url: regPortal.trim() || null,
          multiplier_benefit: regBenefit.trim() || null,
          valid_until: regValidUntil || null,
          notes: regNotes.trim() || null,
          user_card_id: regCardId || null,
        });
        setRegistrations(prev => prev.map(r => (r.id === editingReg.id ? { ...r, ...updated } : r)));
      } else {
        const created = await api.addBrandRegistration({
          brand_name: regBrand.trim(),
          campaign_name: regCampaign.trim() || null,
          identifier_type: regIdentifierType,
          raw_identifier: regRawIdentifier.trim(),
          status: regStatus,
          registration_date: regDate || null,
          portal_url: regPortal.trim() || null,
          multiplier_benefit: regBenefit.trim() || null,
          valid_until: regValidUntil || null,
          notes: regNotes.trim() || null,
          user_card_id: regCardId || null,
        });
        setRegistrations(prev => [created, ...prev]);
      }
      setIsRegModalOpen(false);
      setEditingReg(null);
    } catch (err: any) {
      setRegFormError(err.message || 'Failed to save brand registration.');
    } finally {
      setIsSubmittingReg(false);
    }
  };

  const handleDeleteReg = async (id: string) => {
    if (!window.confirm("Delete this brand registration? This action cannot be undone.")) return;
    const previous = [...registrations];
    setRegistrations(prev => prev.filter(r => r.id !== id));
    try {
      await api.deleteBrandRegistration(id);
    } catch (err: any) {
      alert("Failed to delete tracker: " + err.message);
      setRegistrations(previous);
    }
  };

  const handleQuickStatusChange = async (reg: any, newStatus: string) => {
    const previous = [...registrations];
    setRegistrations(prev => prev.map(r => r.id === reg.id ? { ...r, status: newStatus } : r));
    try {
      await api.updateBrandRegistration(reg.id, { status: newStatus });
    } catch (err: any) {
      alert("Failed to update status: " + err.message);
      setRegistrations(previous);
    }
  };

  const handleResolveReminder = async (reg: any) => {
    await handleQuickStatusChange(reg, 'REGISTERED');
  };

  const handleCreateQuickReg = async (preset: { brand_name: string; campaign_name: string; multiplier_benefit: string; portal_url: string; card_id?: string }) => {
    try {
      const newReg = await api.addBrandRegistration({
        ...preset,
        user_card_id: cards.find(c => c.card_id === preset.card_id)?.id || cards[0]?.id || null,
        status: 'REGISTERED',
        registration_date: new Date().toISOString().split('T')[0],
        identifier_type: 'EMAIL',
        valid_until: new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0]
      });
      setRegistrations(prev => [newReg, ...prev]);
    } catch (err: any) {
      alert("Failed to track campaign: " + err.message);
    }
  };

  const suggestedCampaigns = useMemo(() => {
    const list: any[] = [];
    const hasAmex = cards.some(c => c.card_id?.includes('amex') || c.credit_cards?.issuer === 'AMEX');
    const hasAxis = cards.some(c => c.card_id?.includes('axis') || c.credit_cards?.issuer === 'AXIS');
    const hasHdfc = cards.some(c => c.card_id?.includes('hdfc') || c.credit_cards?.issuer === 'HDFC');
    const hasSbi = cards.some(c => c.card_id?.includes('sbi') || c.credit_cards?.issuer === 'SBI');

    if (hasAmex && !registrations.some(r => r.brand_name?.toLowerCase().includes('amex') || r.campaign_name?.toLowerCase().includes('multiplier'))) {
      list.push({
        brand_name: 'Amex Reward Multiplier',
        campaign_name: 'Monthly Accelerated Brands Enrollment',
        multiplier_benefit: 'Up to 10x Points on Apple, Myntra, Flipkart',
        portal_url: 'https://www.rewardmultiplier.americanexpress.com',
        card_name: 'American Express'
      });
    }

    if (hasAxis && !registrations.some(r => r.brand_name?.toLowerCase().includes('axis') || r.campaign_name?.toLowerCase().includes('grabdeals'))) {
      list.push({
        brand_name: 'Axis GrabDeals & GiftEdge',
        campaign_name: 'Accelerated EDGE Rewards / Cashback',
        multiplier_benefit: '5x - 10x EDGE Rewards on Vouchers',
        portal_url: 'https://grabdeals.axisbank.com',
        card_name: 'Axis Bank'
      });
    }

    if (hasHdfc && !registrations.some(r => r.brand_name?.toLowerCase().includes('smartbuy'))) {
      list.push({
        brand_name: 'HDFC SmartBuy',
        campaign_name: 'Quarterly Milestone Target',
        multiplier_benefit: 'Up to 10x Reward Points on Infinia/Diners',
        portal_url: 'https://offers.smartbuy.hdfcbank.com',
        card_name: 'HDFC Bank'
      });
    }

    if (hasSbi && !registrations.some(r => r.brand_name?.toLowerCase().includes('sbi'))) {
      list.push({
        brand_name: 'SBI Card Spend & Get',
        campaign_name: 'Festive & Quarterly Milestone Enrollment',
        multiplier_benefit: 'Bonus Amazon/Flipkart E-Voucher on spend target',
        portal_url: 'https://www.sbicard.com/en/personal/offers.page',
        card_name: 'SBI Card'
      });
    }

    return list;
  }, [cards, registrations]);

  const filteredRegistrations = useMemo(() => {
    return filterBrandRegistrations(registrations, regSearchQuery, regStatusFilter);
  }, [registrations, regSearchQuery, regStatusFilter]);

  const registrationReminders = useMemo(() => {
    return generateRegistrationReminders(registrations, store?.offers || []);
  }, [registrations, store?.offers]);

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

      {/* Brand Registration & Campaign Tracker */}
      <section className="mt-20 pt-12 border-t border-white/5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-display font-bold text-text-primary flex items-center gap-3">
              <Bookmark className="w-6 h-6 text-pastel-mint" />
              Brand Registration & Platform Tracker
            </h2>
            <p className="text-text-muted font-medium text-sm mt-1">
              Track mandatory platform registrations, masked account identifiers, and active promotional campaign eligibilities.
            </p>
          </div>
          <button
            onClick={openAddRegModal}
            className="pastel-button px-5 py-2.5 inline-flex items-center gap-2 text-xs self-start md:self-auto"
          >
            <Plus className="w-4 h-4" /> Add Brand Registration
          </button>
        </div>

        {/* 1. Reminders Action Center (Section 5) */}
        {registrationReminders.length > 0 && (
          <div className="mb-8 p-5 bg-gradient-to-r from-pastel-peach/15 via-dark-surface to-pastel-lavender/15 rounded-3xl border border-pastel-peach/30 shadow-lg">
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-xs font-bold uppercase tracking-wider text-pastel-peach flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Action Required: Registration Reminders ({registrationReminders.length})
              </p>
              <span className="text-[11px] text-text-muted hidden sm:inline">
                Offers require verified registration to award accelerated benefits
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {registrationReminders.map((rem, idx) => {
                const isOfferLinked = Boolean(rem.matchedOffer);
                const regObj = registrations.find(r => r.id === rem.registrationId || r.brand_name === rem.brandName);
                return (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-dark-base/80 border border-white/5 flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-sm text-text-primary">{rem.brandName}</h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-pastel-peach/20 text-pastel-peach border border-pastel-peach/30">
                          {rem.status}
                        </span>
                      </div>
                      {isOfferLinked && (
                        <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-pastel-mint">
                          <Zap className="w-3 h-3 shrink-0" />
                          <span>Active Offer: {rem.matchedOffer?.merchant_name} ({rem.matchedOffer?.bank_name})</span>
                        </div>
                      )}
                      <p className="text-xs text-text-muted mt-1 leading-relaxed">
                        {rem.reminderMessage}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                      {regObj && (
                        <button
                          type="button"
                          onClick={() => handleResolveReminder(regObj)}
                          className="text-xs font-bold px-3 py-1.5 rounded-lg bg-pastel-mint/20 text-pastel-mint hover:bg-pastel-mint/30 border border-pastel-mint/40 transition-colors inline-flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" /> Mark Registered
                        </button>
                      )}
                      {rem.portalUrl && (
                        <a
                          href={rem.portalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-bold text-text-muted hover:text-pastel-lavender transition-colors inline-flex items-center gap-1 underline ml-auto"
                        >
                          Enroll on Portal <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. Search & Filter Bar */}
        <div className="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by brand name, campaign, identifier, notes..."
              value={regSearchQuery}
              onChange={e => setRegSearchQuery(e.target.value)}
              className="glass-input w-full pl-10 text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 sm:pb-0">
            {(['ALL', 'REGISTERED', 'PENDING', 'NOT_REGISTERED'] as const).map(tab => {
              const count = tab === 'ALL'
                ? registrations.length
                : registrations.filter(r => (r.status || 'PENDING') === tab).length;
              const isActive = regStatusFilter === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setRegStatusFilter(tab)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-pastel-lavender text-dark-base shadow-sm'
                      : 'bg-dark-elevated text-text-muted hover:text-text-primary hover:bg-dark-surface border border-white/5'
                  }`}
                >
                  <span>{tab === 'ALL' ? 'All' : tab === 'REGISTERED' ? 'Registered' : tab === 'PENDING' ? 'Pending' : 'Not Registered'}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-dark-base/20 text-dark-base' : 'bg-white/10 text-text-muted'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Suggested Enrollments based on cards in wallet */}
        {suggestedCampaigns.length > 0 && !regSearchQuery && regStatusFilter === 'ALL' && (
          <div className="mb-8 p-5 bg-gradient-to-r from-pastel-lavender/10 via-dark-surface to-pastel-pink/10 rounded-2xl border border-pastel-lavender/20">
            <p className="text-xs font-bold uppercase tracking-wider text-pastel-lavender mb-3 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" /> Recommended activations for cards in your wallet:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {suggestedCampaigns.map((preset, idx) => (
                <div key={idx} className="bg-dark-base/70 p-3.5 rounded-xl border border-white/5 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-pastel-lavender bg-pastel-lavender/10 px-2 py-0.5 rounded uppercase">
                      {preset.card_name}
                    </span>
                    <h4 className="font-bold text-sm text-text-primary mt-1.5">{preset.brand_name}</h4>
                    <p className="text-xs text-text-muted mt-1 leading-relaxed">{preset.multiplier_benefit}</p>
                  </div>
                  <button
                    onClick={() => handleCreateQuickReg(preset)}
                    className="mt-3 text-xs font-bold text-pastel-mint hover:underline flex items-center gap-1"
                  >
                    + Track Activation →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Active Registrations Grid */}
        {filteredRegistrations.length === 0 ? (
          <div className="glass-card p-12 text-center border border-dashed border-white/10 rounded-3xl text-text-muted">
            <Clock className="w-10 h-10 text-pastel-lavender/40 mx-auto mb-3" />
            <h3 className="font-bold text-lg text-text-primary mb-1">
              {regSearchQuery || regStatusFilter !== 'ALL' ? 'No Matching Registrations Found' : 'No Brand Registrations Yet'}
            </h3>
            <p className="text-sm max-w-md mx-auto mb-6">
              {regSearchQuery || regStatusFilter !== 'ALL'
                ? 'Try adjusting your search query or status filter to see other tracked platforms.'
                : 'Many cards require prior platform enrolment to unlock 5x to 10x reward points. Record your brand accounts here to stay eligible.'}
            </p>
            {regSearchQuery || regStatusFilter !== 'ALL' ? (
              <button
                onClick={() => { setRegSearchQuery(''); setRegStatusFilter('ALL'); }}
                className="bg-white/10 hover:bg-white/20 text-text-primary px-5 py-2 rounded-xl text-xs font-bold transition-colors"
              >
                Clear Filters
              </button>
            ) : (
              <button onClick={openAddRegModal} className="pastel-button px-6 py-2.5 text-xs font-bold">
                Add Your First Brand Registration
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRegistrations.map(reg => {
              const isRegistered = reg.status === 'REGISTERED';
              const isPending = reg.status === 'PENDING';

              const matchedOffer = store?.offers.find(o =>
                o.registration_required &&
                ((o.required_brand_name && o.required_brand_name.toLowerCase().includes(reg.brand_name.toLowerCase())) ||
                 reg.brand_name.toLowerCase().includes((o.required_brand_name || '').toLowerCase()))
              );

              return (
                <div
                  key={reg.id}
                  className="glass-card p-6 border border-white/10 rounded-3xl flex flex-col justify-between hover:border-pastel-lavender/30 transition-all group"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h3 className="font-display font-bold text-lg text-text-primary">{reg.brand_name}</h3>
                        {reg.campaign_name && (
                          <p className="text-xs text-text-muted mt-0.5">{reg.campaign_name}</p>
                        )}
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0 ${
                          isRegistered
                            ? 'bg-pastel-mint/10 text-pastel-mint border border-pastel-mint/30'
                            : isPending
                            ? 'bg-pastel-lavender/10 text-pastel-lavender border border-pastel-lavender/30'
                            : 'bg-pastel-peach/10 text-pastel-peach border border-pastel-peach/30'
                        }`}
                      >
                        {isRegistered ? <ShieldCheck className="w-3.5 h-3.5" /> : isPending ? <Clock className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                        {isRegistered ? 'Registered' : isPending ? 'Pending' : 'Not Registered'}
                      </span>
                    </div>

                    {/* Masked Identifier Badge */}
                    {reg.masked_identifier && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-dark-base/60 border border-white/5 text-xs text-text-muted">
                        {reg.identifier_type === 'PHONE' ? (
                          <Phone className="w-3 h-3 text-pastel-lavender shrink-0" />
                        ) : (
                          <Mail className="w-3 h-3 text-pastel-lavender shrink-0" />
                        )}
                        <span>{reg.masked_identifier}</span>
                      </div>
                    )}

                    {/* Active Offer Linkage */}
                    {matchedOffer && (
                      <div className="p-2.5 bg-pastel-mint/10 rounded-xl border border-pastel-mint/20 text-xs text-pastel-mint font-medium flex items-center gap-2">
                        <Sparkles className="w-4 h-4 shrink-0" />
                        <span>Eligible for {matchedOffer.merchant_name} ({matchedOffer.bank_name}) offer</span>
                      </div>
                    )}

                    {reg.multiplier_benefit && (
                      <div className="p-3 bg-dark-base/50 rounded-xl border border-white/5 text-xs text-pastel-lavender font-medium">
                        ⚡ {reg.multiplier_benefit}
                      </div>
                    )}

                    {reg.registration_date && (
                      <p className="text-[11px] text-text-muted flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-text-muted" />
                        Registered: {new Date(reg.registration_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    )}

                    {reg.notes && (
                      <p className="text-xs text-text-muted bg-white/5 p-2 rounded-lg italic">
                        "{reg.notes}"
                      </p>
                    )}
                  </div>

                  <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleQuickStatusChange(reg, isRegistered ? 'PENDING' : 'REGISTERED')}
                        className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${
                          isRegistered
                            ? 'border-white/10 text-text-muted hover:bg-white/5'
                            : 'bg-pastel-mint/20 border-pastel-mint text-pastel-mint hover:bg-pastel-mint/30'
                        }`}
                      >
                        {isRegistered ? 'Mark Pending' : 'Mark Registered'}
                      </button>

                      {reg.portal_url && (
                        <a
                          href={reg.portal_url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-lg hover:bg-white/10 text-text-muted hover:text-pastel-lavender transition-colors"
                          title="Open Official Enrollment Portal"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditRegModal(reg)}
                        className="p-2 rounded-lg hover:bg-white/10 text-text-muted hover:text-pastel-lavender transition-colors"
                        title="Edit Registration"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => reg.id && handleDeleteReg(reg.id)}
                        className="p-2 rounded-lg hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors"
                        title="Delete Registration"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

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

      {/* ADD / EDIT BRAND REGISTRATION MODAL */}
      <AnimatePresence>
        {isRegModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsRegModalOpen(false)}
              className="absolute inset-0 bg-dark-base/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-card w-full max-w-lg max-h-[92vh] flex flex-col p-6 relative z-10 border border-white/10 rounded-3xl overflow-hidden"
            >
              <div className="flex justify-between items-center pb-4 border-b border-white/5 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-pastel-mint/10 border border-pastel-mint/30 flex items-center justify-center">
                    <Bookmark className="w-5 h-5 text-pastel-mint" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-lg text-text-primary">
                      {editingReg ? 'Edit Brand Registration' : 'Track Brand Registration'}
                    </h3>
                    <p className="text-xs text-text-muted">
                      {editingReg
                        ? 'Update your platform enrollment details and masked account record.'
                        : 'Record platform membership and masked identifier for offer eligibility.'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsRegModalOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-full text-text-muted"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveRegistration} className="space-y-4 pt-4 overflow-y-auto pr-1 flex-1">
                {regFormError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3.5 rounded-xl text-xs font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{regFormError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1">
                    Brand / Platform Name *
                  </label>
                  <input
                    type="text"
                    required
                    list="popular-brands"
                    placeholder="e.g. Amex Reward Multiplier, Tata Neu, HDFC SmartBuy"
                    value={regBrand}
                    onChange={e => {
                      const val = e.target.value;
                      setRegBrand(val);
                      // Auto-populate portal url for known brands if blank
                      if (!regPortal) {
                        const low = val.toLowerCase();
                        if (low.includes('amex')) setRegPortal('https://www.rewardmultiplier.americanexpress.com');
                        else if (low.includes('smartbuy')) setRegPortal('https://offers.smartbuy.hdfcbank.com');
                        else if (low.includes('grabdeals')) setRegPortal('https://grabdeals.axisbank.com');
                        else if (low.includes('amazon')) setRegPortal('https://www.amazon.in/prime');
                        else if (low.includes('swiggy')) setRegPortal('https://www.swiggy.com');
                        else if (low.includes('tataneu') || low.includes('tata neu')) setRegPortal('https://www.tataneu.com');
                      }
                    }}
                    className="glass-input w-full text-sm font-medium"
                  />
                  <datalist id="popular-brands">
                    <option value="Amex Reward Multiplier" />
                    <option value="HDFC SmartBuy" />
                    <option value="Axis GrabDeals & GiftEdge" />
                    <option value="Tata Neu" />
                    <option value="Amazon Prime" />
                    <option value="Swiggy One" />
                    <option value="EazyDiner Prime" />
                    <option value="SBI Card Spend & Get" />
                  </datalist>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-text-muted mb-1">
                      Campaign / Program Purpose
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 10x Points Multiplier"
                      value={regCampaign}
                      onChange={e => setRegCampaign(e.target.value)}
                      className="glass-input w-full text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text-muted mb-1">
                      Registration Status *
                    </label>
                    <select
                      value={regStatus}
                      onChange={e => setRegStatus(e.target.value as any)}
                      className="glass-input w-full text-xs font-semibold"
                    >
                      <option value="REGISTERED">REGISTERED (Confirmed)</option>
                      <option value="PENDING">PENDING (Action Required)</option>
                      <option value="NOT_REGISTERED">NOT_REGISTERED (Not Enrolled)</option>
                    </select>
                  </div>
                </div>

                {/* Secure Identifier & Live Masking */}
                <div className="p-3.5 bg-dark-elevated rounded-2xl border border-white/5 space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-text-muted mb-1">
                        Identifier Type
                      </label>
                      <select
                        value={regIdentifierType}
                        onChange={e => setRegIdentifierType(e.target.value as IdentifierType)}
                        className="glass-input w-full text-xs"
                      >
                        <option value="EMAIL">Email Address</option>
                        <option value="PHONE">Phone Number</option>
                        <option value="OTHER">Label / Other</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold text-text-muted mb-1">
                        Account Identifier (Email / Phone)
                      </label>
                      <input
                        type="text"
                        placeholder={
                          regIdentifierType === 'EMAIL'
                            ? 'user@example.com'
                            : regIdentifierType === 'PHONE'
                            ? '+91 98765 43210'
                            : 'Registered Account Tag'
                        }
                        value={regRawIdentifier}
                        onChange={e => setRegRawIdentifier(e.target.value)}
                        className="glass-input w-full text-xs"
                      />
                    </div>
                  </div>

                  {/* Privacy / Masked Preview */}
                  <div className="p-2.5 rounded-xl bg-dark-base/80 border border-white/5 flex items-center justify-between text-xs">
                    <span className="text-text-muted font-medium">🔒 Stored Masked Identifier:</span>
                    <span className="font-mono font-bold text-pastel-mint">
                      {regRawIdentifier
                        ? maskIdentifier(regRawIdentifier, regIdentifierType)
                        : 'No identifier entered'}
                    </span>
                  </div>
                  <p className="text-[10px] text-text-muted leading-tight">
                    Privacy Guarantee: Only masked formats (e.g. u***r@gmail.com) are stored. Full credentials, passwords, or OTPs are never saved.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-text-muted mb-1">
                      Registration Date
                    </label>
                    <input
                      type="date"
                      value={regDate}
                      onChange={e => setRegDate(e.target.value)}
                      className="glass-input w-full text-xs [color-scheme:dark]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text-muted mb-1">
                      Applicable Wallet Card
                    </label>
                    <select
                      value={regCardId}
                      onChange={e => setRegCardId(e.target.value)}
                      className="glass-input w-full text-xs"
                    >
                      <option value="">General / All Wallet Cards</option>
                      {cards.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.credit_cards?.card_name || c.credit_cards?.name || c.custom_card_name || 'Card'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1">
                    Official Portal URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={regPortal}
                    onChange={e => setRegPortal(e.target.value)}
                    className="glass-input w-full text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    maxLength={500}
                    placeholder="e.g. Enrolled via SMS promo code on 15 Oct. Bonus credited within 90 days."
                    value={regNotes}
                    onChange={e => setRegNotes(e.target.value)}
                    className="glass-input w-full text-xs resize-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmittingReg}
                    className="pastel-button w-full py-3.5 text-sm font-bold disabled:opacity-50"
                  >
                    {isSubmittingReg ? 'Saving...' : editingReg ? 'Update Registration' : 'Record Brand Registration'}
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
