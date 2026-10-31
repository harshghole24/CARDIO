import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Coffee, Plane, Film, ShoppingBag, ShoppingCart, Sparkles,
  Wallet, Check, BookmarkCheck, TrendingUp, Award, Clock,
  CheckCircle2, AlertCircle, X, Search, Trash2, Edit3,
  ArrowUpRight
} from 'lucide-react';
import { useDataStore } from '../lib/data/DataContext';
import { api } from '../lib/api';
import type { OfferRow, OfferRedemptionRow, OfferLifecycleStatus } from '../lib/data/schemas';
import {
  calculateSavingsSummary,
  isValidStatusTransition,
  type SavingsSummaryReport
} from '../lib/engine/savingsCalculator';

const CATEGORIES = [
  { id: 'ALL', icon: Sparkles, label: 'All Categories', color: 'text-text-primary', bg: 'bg-white/10' },
  { id: 'TRAVEL', icon: Plane, label: 'Travel & Flights', color: 'text-pastel-lavender', bg: 'bg-pastel-lavender/10' },
  { id: 'DINING', icon: Coffee, label: 'Dining & Food', color: 'text-pastel-pink', bg: 'bg-pastel-pink/10' },
  { id: 'MOVIES', icon: Film, label: 'Entertainment & Movies', color: 'text-pastel-mint', bg: 'bg-pastel-mint/10' },
  { id: 'SHOPPING', icon: ShoppingBag, label: 'Online Shopping & Retail', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { id: 'GROCERY', icon: ShoppingCart, label: 'Groceries & Quick Commerce', color: 'text-amber-400', bg: 'bg-amber-400/10' },
];

function formatINR(n: number) {
  return Math.round(n || 0).toLocaleString('en-IN');
}

const RewardsHub = () => {
  const { store, loading } = useDataStore();
  const [viewMode, setViewMode] = useState<'EXPLORE' | 'SAVINGS'>('EXPLORE');
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [userCardIds, setUserCardIds] = useState<string[]>([]);
  const [userCards, setUserCards] = useState<any[]>([]);
  const [onlyMyCards, setOnlyMyCards] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');

  // Redemptions & Savings State
  const [redemptions, setRedemptions] = useState<OfferRedemptionRow[]>([]);
  const [loadingRedemptions, setLoadingRedemptions] = useState(true);
  const [redemptionFilterStatus, setRedemptionFilterStatus] = useState<string>('ALL');
  const [redemptionSearch, setRedemptionSearch] = useState('');

  // Receipt Confirmation Modal State
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [selectedRedemption, setSelectedRedemption] = useState<OfferRedemptionRow | null>(null);
  const [confirmedDiscount, setConfirmedDiscount] = useState('');
  const [confirmedCashback, setConfirmedCashback] = useState('');
  const [confirmedPoints, setConfirmedPoints] = useState('');
  const [confirmationDate, setConfirmationDate] = useState(new Date().toISOString().split('T')[0]);
  const [modalNotes, setModalNotes] = useState('');
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const fetchCardsAndRedemptions = async () => {
    try {
      const [cards, redempList] = await Promise.all([
        api.getCards().catch(() => []),
        api.getOfferRedemptions().catch(() => []),
      ]);
      setUserCards(cards || []);
      const ids = (cards || []).map((c: any) => c.card_id).filter(Boolean);
      setUserCardIds(ids);
      setRedemptions(redempList || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRedemptions(false);
    }
  };

  useEffect(() => {
    fetchCardsAndRedemptions();
  }, []);

  // Compute live savings summary using financial calculation engine
  const savingsSummary: SavingsSummaryReport = useMemo(() => {
    if (!store) {
      return {
        totalConfirmedSavingsINR: 0,
        totalConfirmedDiscountINR: 0,
        totalConfirmedCashbackINR: 0,
        totalConfirmedRewardPoints: 0,
        totalConfirmedRewardPointsValueINR: 0,
        totalPendingCashbackINR: 0,
        totalEstimatedPotentialSavingsINR: 0,
        redeemedOffersCount: 0,
        pendingRedemptionsCount: 0,
        appliedRedemptionsCount: 0,
        savedOffersCount: 0,
        topMerchantsBySavings: [],
        monthlySavingsTrends: [],
      };
    }
    return calculateSavingsSummary(redemptions, store.cardById);
  }, [redemptions, store]);

  // Combined Offer Catalog Items
  const catalogOffers = useMemo(() => {
    if (!store) return [];

    let list: Array<{
      id: string;
      merchant: string;
      bank: string;
      category: string;
      benefit: string;
      discountPct: number;
      cashbackPct: number;
      multiplier: number;
      minSpend: number;
      maxBenefit: number;
      validUntil?: string;
      sourceUrl?: string;
      eligibleCards: string;
      isOwned: boolean;
      originalOffer?: OfferRow;
    }> = [];

    // 1. Structured offers dataset
    (store.offers || []).forEach(offer => {
      const isOwned = offer.eligible_card_variants === 'all'
        ? userCardIds.length > 0
        : userCardIds.some(id => offer.eligible_card_variants.toLowerCase().includes(id.toLowerCase()));

      let benefitStr = '';
      if (offer.discount_percentage > 0) {
        benefitStr = `${offer.discount_percentage}% Instant Discount`;
        if (offer.maximum_benefit > 0) benefitStr += ` up to ₹${formatINR(offer.maximum_benefit)}`;
      } else if (offer.cashback_percentage > 0) {
        benefitStr = `${offer.cashback_percentage}% Cashback`;
        if (offer.maximum_benefit > 0) benefitStr += ` up to ₹${formatINR(offer.maximum_benefit)}`;
      } else if (offer.reward_points_multiplier > 1) {
        benefitStr = `${offer.reward_points_multiplier}X Reward Points`;
      } else if (offer.fixed_discount_amount > 0) {
        benefitStr = `Flat ₹${formatINR(offer.fixed_discount_amount)} Off`;
      } else {
        benefitStr = offer.benefit_type || 'Special Promotion';
      }

      list.push({
        id: offer.offer_id,
        merchant: offer.merchant_name,
        bank: offer.bank_name,
        category: (offer.offer_category || 'Shopping').toUpperCase(),
        benefit: benefitStr,
        discountPct: offer.discount_percentage,
        cashbackPct: offer.cashback_percentage,
        multiplier: offer.reward_points_multiplier,
        minSpend: offer.minimum_transaction_amount,
        maxBenefit: offer.maximum_benefit,
        validUntil: offer.valid_until,
        sourceUrl: offer.source_url,
        eligibleCards: offer.eligible_card_variants,
        isOwned,
        originalOffer: offer,
      });
    });

    // 2. Movie & dining benefits
    (store.movieDining || []).forEach((b, idx) => {
      const card = store.cardById.get(b.card_id);
      const isOwned = userCardIds.includes(b.card_id);
      const cat = (b.category || 'Dining').toUpperCase();

      list.push({
        id: `MD-${b.card_id}-${idx}`,
        merchant: b.platform || (card ? card.issuer : 'Partner Merchant'),
        bank: card ? card.issuer : 'Credit Card',
        category: cat,
        benefit: b.benefit,
        discountPct: 0,
        cashbackPct: 0,
        multiplier: 1,
        minSpend: 0,
        maxBenefit: 0,
        sourceUrl: b.source_url,
        eligibleCards: card?.name || b.card_id,
        isOwned,
      });
    });

    // Apply category filter
    if (activeCategory !== 'ALL') {
      list = list.filter(item => item.category === activeCategory);
    }

    // Apply only my cards filter
    if (onlyMyCards) {
      list = list.filter(item => item.isOwned);
    }

    // Apply search filter
    if (catalogSearch.trim()) {
      const q = catalogSearch.toLowerCase().trim();
      list = list.filter(item =>
        item.merchant.toLowerCase().includes(q) ||
        item.bank.toLowerCase().includes(q) ||
        item.benefit.toLowerCase().includes(q) ||
        item.eligibleCards.toLowerCase().includes(q)
      );
    }

    return list;
  }, [store, activeCategory, onlyMyCards, catalogSearch, userCardIds]);

  // Filtered User Redemptions for Savings Tab
  const filteredRedemptions = useMemo(() => {
    let list = [...redemptions];

    if (redemptionFilterStatus !== 'ALL') {
      list = list.filter(r => r.status === redemptionFilterStatus);
    }

    if (redemptionSearch.trim()) {
      const q = redemptionSearch.toLowerCase().trim();
      list = list.filter(r =>
        r.merchant_name.toLowerCase().includes(q) ||
        r.offer_id.toLowerCase().includes(q) ||
        (r.notes && r.notes.toLowerCase().includes(q))
      );
    }

    return list;
  }, [redemptions, redemptionFilterStatus, redemptionSearch]);

  // Save offer handler
  const handleSaveOffer = async (offer: any) => {
    try {
      const defaultUserCard = userCards.find(c => {
        if (!offer.eligibleCards || offer.eligibleCards === 'all') return true;
        return offer.eligibleCards.toLowerCase().includes(c.card_id?.toLowerCase() || '');
      }) || userCards[0];

      const estDisc = offer.discountPct > 0 ? (offer.maxBenefit > 0 ? offer.maxBenefit : 500) : 0;
      const estCb = offer.cashbackPct > 0 ? (offer.maxBenefit > 0 ? offer.maxBenefit : 500) : 0;

      const created = await api.createOfferRedemption({
        offer_id: offer.id,
        user_card_id: defaultUserCard?.id || null,
        card_id: defaultUserCard?.card_id || null,
        merchant_name: offer.merchant,
        status: 'SAVED',
        estimated_discount: estDisc,
        estimated_cashback: estCb,
        notes: `Saved from Rewards Hub catalogue (${offer.bank})`,
      });

      if (created) {
        setRedemptions(prev => [created, ...prev]);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save offer');
    }
  };

  // Unsave / remove redemption handler
  const handleUnsaveOffer = async (redemptionId: string) => {
    if (!window.confirm('Remove this saved offer from your tracker?')) return;
    try {
      await api.deleteOfferRedemption(redemptionId);
      setRedemptions(prev => prev.filter(r => r.id !== redemptionId));
    } catch (err: any) {
      alert(err.message || 'Failed to remove saved offer');
    }
  };

  // Transition lifecycle status
  const handleUpdateStatus = async (redemption: OfferRedemptionRow, nextStatus: OfferLifecycleStatus) => {
    const check = isValidStatusTransition(redemption.status, nextStatus);
    if (!check.valid) {
      alert(check.reason);
      return;
    }
    try {
      const updated = await api.updateOfferRedemption(redemption.id!, {
        status: nextStatus,
        cashback_status: nextStatus === 'PENDING_CASHBACK' ? 'PENDING' : undefined,
      });
      setRedemptions(prev => prev.map(r => r.id === updated.id ? updated : r));
    } catch (err: any) {
      alert(err.message || 'Failed to update offer status');
    }
  };

  // Open receipt confirmation modal
  const openConfirmModal = (r: OfferRedemptionRow) => {
    setSelectedRedemption(r);
    setConfirmedDiscount(String(r.confirmed_discount || r.estimated_discount || ''));
    setConfirmedCashback(String(r.confirmed_cashback || r.estimated_cashback || ''));
    setConfirmedPoints(String(r.confirmed_reward_points || r.estimated_reward_points || ''));
    setConfirmationDate(r.confirmation_date || new Date().toISOString().split('T')[0]);
    setModalNotes(r.notes || '');
    setModalError('');
    setConfirmModalOpen(true);
  };

  // Submit confirmed receipt
  const handleSaveConfirmed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRedemption?.id) return;
    setModalSubmitting(true);
    setModalError('');

    const confDisc = Math.max(0, Number(confirmedDiscount) || 0);
    const confCb = Math.max(0, Number(confirmedCashback) || 0);
    const confPts = Math.max(0, Number(confirmedPoints) || 0);

    try {
      const updated = await api.updateOfferRedemption(selectedRedemption.id, {
        status: 'REDEEMED',
        confirmed_discount: confDisc,
        confirmed_cashback: confCb,
        confirmed_reward_points: confPts,
        cashback_status: confCb > 0 ? 'RECEIVED' : selectedRedemption.cashback_status,
        confirmation_date: confirmationDate || new Date().toISOString().split('T')[0],
        notes: modalNotes.trim() || null,
      });

      setRedemptions(prev => prev.map(r => r.id === updated.id ? updated : r));
      setConfirmModalOpen(false);
      setSelectedRedemption(null);
    } catch (err: any) {
      setModalError(err.message || 'Failed to confirm redemption');
    } finally {
      setModalSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-pastel-lavender border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen">
      {/* Top Header */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-text-primary mb-2 flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-pastel-pink" />
            Rewards Hub & Offer Savings Engine
          </h1>
          <p className="text-text-muted font-medium">
            Explore verified card offers, bookmark promotions, and track realized savings end-to-end.
          </p>
        </div>

        {/* Top-Level Mode Selector */}
        <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-dark-elevated border border-white/10 self-start md:self-auto">
          <button
            onClick={() => setViewMode('EXPLORE')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              viewMode === 'EXPLORE'
                ? 'bg-pastel-lavender text-dark-base shadow-[0_0_15px_rgba(230,230,250,0.3)]'
                : 'text-text-muted hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Browse & Save Offers</span>
          </button>

          <button
            onClick={() => setViewMode('SAVINGS')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all relative ${
              viewMode === 'SAVINGS'
                ? 'bg-pastel-mint text-dark-base shadow-[0_0_15px_rgba(182,240,214,0.3)]'
                : 'text-text-muted hover:text-white'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>My Savings & Tracker</span>
            {redemptions.length > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                viewMode === 'SAVINGS' ? 'bg-dark-base text-pastel-mint' : 'bg-pastel-mint/20 text-pastel-mint'
              }`}>
                {redemptions.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ────────────────── VIEW MODE 1: EXPLORE & SAVE OFFERS ────────────────── */}
      {viewMode === 'EXPLORE' && (
        <div className="space-y-6">
          {/* Controls Bar: Category Pills + Search + My Cards Toggle */}
          <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
            {/* Category Pills */}
            <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none">
              {CATEGORIES.map(cat => {
                const Icon = cat.icon;
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all whitespace-nowrap ${
                      isActive
                        ? 'bg-dark-elevated border border-pastel-lavender shadow-[0_0_15px_rgba(230,230,250,0.15)] text-text-primary'
                        : 'bg-dark-surface border border-white/5 text-text-muted hover:bg-dark-elevated'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? cat.color : 'text-text-muted'}`} />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  placeholder="Search merchant, card, bank..."
                  value={catalogSearch}
                  onChange={e => setCatalogSearch(e.target.value)}
                  className="glass-input pl-9 pr-3 py-2 text-xs"
                />
              </div>

              {/* Only My Cards Toggle */}
              {userCardIds.length > 0 && (
                <button
                  onClick={() => setOnlyMyCards(!onlyMyCards)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border whitespace-nowrap ${
                    onlyMyCards
                      ? 'bg-pastel-lavender/20 border-pastel-lavender text-pastel-lavender'
                      : 'bg-dark-elevated border-white/10 text-text-muted hover:text-text-primary'
                  }`}
                >
                  <Wallet className="w-3.5 h-3.5" />
                  <span>My Wallet Cards ({userCardIds.length})</span>
                  {onlyMyCards && <Check className="w-3 h-3 ml-1" />}
                </button>
              )}
            </div>
          </div>

          {/* Offer Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {catalogOffers.length === 0 ? (
                <div className="col-span-full py-16 text-center border border-dashed border-white/10 rounded-3xl text-text-muted">
                  <p className="font-bold text-lg mb-1">No offers match your criteria</p>
                  <p className="text-sm">
                    {onlyMyCards
                      ? 'None of your wallet cards have active promotions under this category.'
                      : 'Try adjusting your search terms or selecting All Categories.'}
                  </p>
                  {onlyMyCards && (
                    <button
                      onClick={() => setOnlyMyCards(false)}
                      className="mt-4 text-pastel-lavender underline font-bold text-xs"
                    >
                      Show all catalogue offers →
                    </button>
                  )}
                </div>
              ) : (
                catalogOffers.map((offer, idx) => {
                  const existingRedemption = redemptions.find(r => r.offer_id === offer.id);
                  const isSaved = !!existingRedemption;

                  return (
                    <motion.div
                      key={offer.id}
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.94 }}
                      transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                      className="glass-card p-6 border border-white/10 rounded-3xl hover:border-pastel-lavender/30 transition-all flex flex-col justify-between group relative overflow-hidden"
                    >
                      <div>
                        {/* Header: Merchant + Badges */}
                        <div className="flex justify-between items-start gap-2 mb-3">
                          <div>
                            <span className="text-[10px] font-bold text-pastel-lavender bg-pastel-lavender/10 border border-pastel-lavender/20 px-2 py-0.5 rounded uppercase tracking-wider">
                              {offer.bank}
                            </span>
                            <h3 className="font-display font-bold text-lg text-text-primary mt-1">
                              {offer.merchant}
                            </h3>
                          </div>

                          <div className="flex flex-col items-end gap-1">
                            {offer.isOwned ? (
                              <span className="text-[10px] font-bold text-pastel-mint bg-pastel-mint/10 border border-pastel-mint/20 px-2 py-0.5 rounded-full">
                                In Wallet
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-text-muted bg-white/5 px-2 py-0.5 rounded-full">
                                Catalogue
                              </span>
                            )}
                            <span className="text-[9px] font-bold text-text-muted uppercase">
                              {offer.category}
                            </span>
                          </div>
                        </div>

                        {/* Benefit Description */}
                        <div className="p-3 rounded-2xl bg-dark-surface/60 border border-white/5 mb-4">
                          <p className="font-bold text-sm text-pastel-mint leading-snug">
                            {offer.benefit}
                          </p>
                          {offer.minSpend > 0 && (
                            <p className="text-[11px] text-text-muted mt-1 font-medium">
                              Min. Spend: ₹{formatINR(offer.minSpend)}
                            </p>
                          )}
                          {offer.validUntil && (
                            <p className="text-[10px] text-text-muted mt-0.5">
                              Valid until {offer.validUntil}
                            </p>
                          )}
                        </div>

                        {/* Card applicability */}
                        <p className="text-xs text-text-muted mb-4 line-clamp-1">
                          <span className="font-semibold text-text-primary">Card:</span> {offer.eligibleCards}
                        </p>
                      </div>

                      {/* Footer Actions: Save / Saved Button & Verified Link */}
                      <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                        {isSaved ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-pastel-lavender/20 text-pastel-lavender border border-pastel-lavender/30">
                              <BookmarkCheck className="w-3.5 h-3.5" />
                              <span>{existingRedemption.status}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUnsaveOffer(existingRedemption.id!)}
                              className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title="Unsave offer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSaveOffer(offer)}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white/5 hover:bg-pastel-lavender hover:text-dark-base text-text-primary border border-white/10 transition-all"
                          >
                            <BookmarkCheck className="w-3.5 h-3.5" />
                            <span>Save Offer</span>
                          </button>
                        )}

                        {offer.sourceUrl && (
                          <a
                            href={offer.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-text-muted hover:text-pastel-lavender inline-flex items-center gap-1 font-medium"
                          >
                            <span>Terms</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* ────────────────── VIEW MODE 2: SAVINGS & REDEMPTION TRACKER ────────────────── */}
      {viewMode === 'SAVINGS' && (
        <div className="space-y-8">
          {/* Top KPI Cards (Live Accounting Engine) */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* 1. Confirmed Total Savings */}
            <div className="col-span-2 p-5 rounded-3xl bg-gradient-to-br from-pastel-mint/20 via-pastel-mint/10 to-transparent border border-pastel-mint/40 relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-pastel-mint">
                  Total Confirmed Savings
                </span>
                <Award className="w-5 h-5 text-pastel-mint" />
              </div>
              <div className="text-3xl font-display font-bold text-text-primary">
                ₹{formatINR(savingsSummary.totalConfirmedSavingsINR)}
              </div>
              <p className="text-[11px] text-text-muted mt-1">
                Realized discounts, confirmed cashback & reward valuation
              </p>
            </div>

            {/* 2. Confirmed Instant Discounts */}
            <div className="p-4 rounded-3xl bg-dark-elevated border border-white/10">
              <div className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">
                Instant Discounts
              </div>
              <div className="text-2xl font-display font-bold text-pastel-lavender">
                ₹{formatINR(savingsSummary.totalConfirmedDiscountINR)}
              </div>
              <p className="text-[10px] text-text-muted mt-0.5">Applied at checkout</p>
            </div>

            {/* 3. Confirmed Cashback */}
            <div className="p-4 rounded-3xl bg-dark-elevated border border-white/10">
              <div className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">
                Confirmed Cashback
              </div>
              <div className="text-2xl font-display font-bold text-pastel-mint">
                ₹{formatINR(savingsSummary.totalConfirmedCashbackINR)}
              </div>
              <p className="text-[10px] text-text-muted mt-0.5">Credited to statement</p>
            </div>

            {/* 4. Pending Cashback */}
            <div className="p-4 rounded-3xl bg-dark-elevated border border-pastel-peach/30">
              <div className="text-xs font-bold text-pastel-peach uppercase tracking-wider mb-1 flex items-center justify-between">
                <span>Pending Cashback</span>
                <Clock className="w-3.5 h-3.5 text-pastel-peach" />
              </div>
              <div className="text-2xl font-display font-bold text-pastel-peach">
                ₹{formatINR(savingsSummary.totalPendingCashbackINR)}
              </div>
              <p className="text-[10px] text-text-muted mt-0.5">Awaiting issuer credit</p>
            </div>

            {/* 5. Confirmed Reward Points */}
            <div className="p-4 rounded-3xl bg-dark-elevated border border-white/10">
              <div className="text-xs font-bold text-text-muted uppercase tracking-wider mb-1">
                Confirmed Points
              </div>
              <div className="text-2xl font-display font-bold text-pastel-pink">
                +{savingsSummary.totalConfirmedRewardPoints.toLocaleString('en-IN')}
              </div>
              <p className="text-[10px] text-text-muted mt-0.5">
                ~₹{formatINR(savingsSummary.totalConfirmedRewardPointsValueINR)} INR value
              </p>
            </div>
          </div>

          {/* Secondary Insight Row: Best Card & Top Merchants */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Best Performing Card */}
            <div className="p-5 rounded-3xl bg-dark-surface border border-white/10 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  Best Performing Card
                </span>
                <h4 className="font-display font-bold text-lg text-text-primary mt-1">
                  {savingsSummary.bestPerformingCard?.cardName || 'None recorded yet'}
                </h4>
                <p className="text-xs text-text-muted mt-0.5">
                  Generated the highest verified savings across your offers
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                <span className="text-xs font-semibold text-text-muted">Confirmed Value:</span>
                <span className="font-bold text-pastel-mint text-base">
                  ₹{formatINR(savingsSummary.bestPerformingCard?.confirmedSavingsINR || 0)}
                </span>
              </div>
            </div>

            {/* Top Merchants */}
            <div className="md:col-span-2 p-5 rounded-3xl bg-dark-surface border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  Top Merchants by Confirmed Savings
                </span>
                <span className="text-xs text-text-muted">
                  {savingsSummary.topMerchantsBySavings.length} merchants
                </span>
              </div>
              {savingsSummary.topMerchantsBySavings.length === 0 ? (
                <p className="text-xs text-text-muted py-3">No confirmed redemptions by merchant yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {savingsSummary.topMerchantsBySavings.map(m => (
                    <div key={m.merchant} className="p-3 rounded-2xl bg-dark-elevated border border-white/5">
                      <div className="font-bold text-sm text-text-primary">{m.merchant}</div>
                      <div className="text-xs text-pastel-mint font-bold mt-1">
                        ₹{formatINR(m.confirmedSavingsINR)}
                      </div>
                      <div className="text-[10px] text-text-muted mt-0.5">
                        {m.redemptionsCount} redemption{m.redemptionsCount > 1 ? 's' : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Redemptions Management Table & Filter Tabs */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              {/* Status Filter Tabs */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none w-full sm:w-auto">
                {[
                  { id: 'ALL', label: `All (${redemptions.length})` },
                  { id: 'SAVED', label: `Saved (${savingsSummary.savedOffersCount})` },
                  { id: 'APPLIED', label: `Applied (${savingsSummary.appliedRedemptionsCount})` },
                  { id: 'PENDING_CASHBACK', label: `Pending Cashback (${savingsSummary.pendingRedemptionsCount})` },
                  { id: 'REDEEMED', label: `Redeemed (${savingsSummary.redeemedOffersCount})` },
                  { id: 'NOT_REDEEMED', label: 'Not Redeemed' },
                  { id: 'EXPIRED', label: 'Expired' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setRedemptionFilterStatus(tab.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                      redemptionFilterStatus === tab.id
                        ? 'bg-dark-elevated border border-pastel-mint text-text-primary shadow-[0_0_12px_rgba(182,240,214,0.15)]'
                        : 'bg-dark-surface border border-white/5 text-text-muted hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Redemptions Search */}
              <div className="relative w-full sm:w-60">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  placeholder="Filter redemptions..."
                  value={redemptionSearch}
                  onChange={e => setRedemptionSearch(e.target.value)}
                  className="glass-input pl-9 pr-3 py-1.5 text-xs"
                />
              </div>
            </div>

            {/* Redemptions List */}
            {loadingRedemptions ? (
              <div className="py-12 text-center text-text-muted">Loading your redemptions...</div>
            ) : filteredRedemptions.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-white/10 rounded-3xl text-text-muted">
                <BookmarkCheck className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="font-bold text-base text-text-primary mb-1">No redemptions found</p>
                <p className="text-xs max-w-sm mx-auto mb-4">
                  Save offers from the Browse tab or record redemptions automatically when entering transactions.
                </p>
                <button
                  onClick={() => setViewMode('EXPLORE')}
                  className="pastel-button px-5 py-2 text-xs font-bold"
                >
                  Explore Offers →
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredRedemptions.map(r => {
                  const dbCard = r.card_id && store ? store.cardById.get(r.card_id) : undefined;
                  const userCard = userCards.find(c => c.id === r.user_card_id);
                  const cardLabel = dbCard?.name || userCard?.credit_cards?.name || userCard?.custom_card_name || r.card_id || 'Primary Card';

                  const statusColors: Record<string, string> = {
                    SAVED: 'bg-pastel-lavender/15 text-pastel-lavender border-pastel-lavender/30',
                    APPLIED: 'bg-blue-400/15 text-blue-400 border-blue-400/30',
                    PENDING_CASHBACK: 'bg-pastel-peach/15 text-pastel-peach border-pastel-peach/30',
                    REDEEMED: 'bg-pastel-mint/15 text-pastel-mint border-pastel-mint/30',
                    NOT_REDEEMED: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
                    EXPIRED: 'bg-red-500/15 text-red-400 border-red-500/30',
                  };

                  return (
                    <motion.div
                      key={r.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="glass-card p-5 border border-white/10 rounded-3xl flex flex-col justify-between hover:border-white/20 transition-all space-y-4"
                    >
                      <div>
                        {/* Top Row: Merchant + Status Pill */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                              {r.offer_id}
                            </span>
                            <h3 className="font-display font-bold text-lg text-text-primary">
                              {r.merchant_name}
                            </h3>
                          </div>
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${statusColors[r.status] || 'bg-white/10 text-white'}`}>
                            {r.status}
                          </span>
                        </div>

                        {/* Card & Financial Details */}
                        <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-dark-surface/60 border border-white/5 text-xs mb-3">
                          <div>
                            <span className="text-text-muted block text-[10px]">Payment Card</span>
                            <span className="font-semibold text-text-primary">{cardLabel}</span>
                          </div>

                          <div>
                            <span className="text-text-muted block text-[10px]">Transaction Spend</span>
                            <span className="font-semibold text-text-primary">
                              {r.transaction_amount > 0 ? `₹${formatINR(r.transaction_amount)}` : '—'}
                            </span>
                          </div>

                          <div>
                            <span className="text-text-muted block text-[10px]">
                              {r.status === 'REDEEMED' ? 'Confirmed Discount' : 'Estimated Discount'}
                            </span>
                            <span className="font-bold text-pastel-mint">
                              {r.status === 'REDEEMED'
                                ? `₹${formatINR(r.confirmed_discount)}`
                                : `₹${formatINR(r.estimated_discount)}`}
                            </span>
                          </div>

                          <div>
                            <span className="text-text-muted block text-[10px]">
                              {r.status === 'REDEEMED' ? 'Confirmed Cashback' : 'Estimated Cashback'}
                            </span>
                            <span className="font-bold text-pastel-lavender">
                              {r.status === 'REDEEMED'
                                ? `₹${formatINR(r.confirmed_cashback)}`
                                : `₹${formatINR(r.estimated_cashback)}`}
                            </span>
                          </div>
                        </div>

                        {/* Confirmation Date or Notes */}
                        {r.confirmation_date && (
                          <div className="text-[11px] text-text-muted flex items-center gap-1.5 mb-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-pastel-mint" />
                            <span>Confirmed on: {r.confirmation_date}</span>
                          </div>
                        )}
                        {r.notes && (
                          <p className="text-[11px] text-text-muted italic bg-dark-elevated/40 p-2 rounded-xl">
                            "{r.notes}"
                          </p>
                        )}
                      </div>

                      {/* Action Bar */}
                      <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* If SAVED -> Mark Applied */}
                          {r.status === 'SAVED' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(r, 'APPLIED')}
                              className="px-3 py-1.5 rounded-xl bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 font-bold text-xs transition-colors"
                            >
                              Mark Applied
                            </button>
                          )}

                          {/* If APPLIED -> Confirm Receipt or Pending Cashback */}
                          {r.status === 'APPLIED' && (
                            <>
                              <button
                                type="button"
                                onClick={() => openConfirmModal(r)}
                                className="px-3 py-1.5 rounded-xl bg-pastel-mint text-dark-base font-bold text-xs hover:bg-white transition-all shadow-[0_0_10px_rgba(182,240,214,0.2)]"
                              >
                                Confirm Receipt
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(r, 'PENDING_CASHBACK')}
                                className="px-3 py-1.5 rounded-xl bg-pastel-peach/20 text-pastel-peach hover:bg-pastel-peach/30 font-bold text-xs transition-colors"
                              >
                                Pending Cashback
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(r, 'NOT_REDEEMED')}
                                className="px-2.5 py-1.5 rounded-xl bg-white/5 text-text-muted hover:text-white font-medium text-xs transition-colors"
                              >
                                Not Used
                              </button>
                            </>
                          )}

                          {/* If PENDING_CASHBACK -> Confirm Cashback */}
                          {r.status === 'PENDING_CASHBACK' && (
                            <>
                              <button
                                type="button"
                                onClick={() => openConfirmModal(r)}
                                className="px-3 py-1.5 rounded-xl bg-pastel-mint text-dark-base font-bold text-xs hover:bg-white transition-all shadow-[0_0_10px_rgba(182,240,214,0.2)]"
                              >
                                Confirm Cashback Received
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(r, 'NOT_REDEEMED')}
                                className="px-2.5 py-1.5 rounded-xl bg-white/5 text-text-muted hover:text-white font-medium text-xs transition-colors"
                              >
                                Mark Failed
                              </button>
                            </>
                          )}

                          {/* If REDEEMED -> Edit details */}
                          {r.status === 'REDEEMED' && (
                            <button
                              type="button"
                              onClick={() => openConfirmModal(r)}
                              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-text-primary font-bold text-xs transition-colors inline-flex items-center gap-1.5"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit Savings Values</span>
                            </button>
                          )}
                        </div>

                        {/* Delete redemption */}
                        <button
                          type="button"
                          onClick={() => handleUnsaveOffer(r.id!)}
                          className="p-1.5 text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Delete redemption record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ────────────────── RECEIPT CONFIRMATION MODAL ────────────────── */}
      <AnimatePresence>
        {confirmModalOpen && selectedRedemption && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModalOpen(false)}
              className="absolute inset-0 bg-dark-base/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-card w-full max-w-lg p-6 relative z-10 border border-pastel-mint/30 rounded-3xl"
            >
              <div className="flex justify-between items-center mb-5 pb-3 border-b border-white/5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-pastel-mint/15 border border-pastel-mint/30 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-pastel-mint" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-lg text-text-primary">
                      Confirm Realized Savings
                    </h3>
                    <p className="text-xs text-text-muted">
                      {selectedRedemption.merchant_name} • {selectedRedemption.offer_id}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setConfirmModalOpen(false)}
                  className="p-2 hover:bg-white/5 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-text-muted" />
                </button>
              </div>

              {modalError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-xs mb-4 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <form onSubmit={handleSaveConfirmed} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                      Confirmed Discount (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={confirmedDiscount}
                      onChange={e => setConfirmedDiscount(e.target.value)}
                      placeholder="0"
                      className="glass-input font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                      Confirmed Cashback (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={confirmedCashback}
                      onChange={e => setConfirmedCashback(e.target.value)}
                      placeholder="0"
                      className="glass-input font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                      Confirmed Points (pts)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={confirmedPoints}
                      onChange={e => setConfirmedPoints(e.target.value)}
                      placeholder="0"
                      className="glass-input font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                      Confirmation Date
                    </label>
                    <input
                      type="date"
                      required
                      value={confirmationDate}
                      onChange={e => setConfirmationDate(e.target.value)}
                      className="glass-input [color-scheme:dark]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                    Receipt Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={modalNotes}
                    onChange={e => setModalNotes(e.target.value)}
                    placeholder="e.g. Credited in statement on 28th Oct"
                    className="glass-input text-xs"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-text-muted hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={modalSubmitting}
                    className="pastel-button px-6 py-2.5 text-xs font-bold disabled:opacity-50"
                  >
                    {modalSubmitting ? 'Recording...' : 'Confirm & Record Savings'}
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

export default RewardsHub;
