import React, { useEffect, useState, useMemo } from 'react';
import {
  Plus, Search, X, Building2, CreditCard, Pencil, Trash2, Download,
  ArrowUpRight, Sparkles, ChevronDown, ChevronUp, AlertCircle, ExternalLink,
  ShieldCheck, CheckCircle2, Info, BookmarkCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';
import { useDataStore } from '../lib/data/DataContext';
import { useNavigate } from 'react-router-dom';
import type { OfferRedemptionRow } from '../lib/data/schemas';
import {
  evaluateTransactionOffers,
  calculateBaseBenefit,
  type OfferEngineReport,
} from '../lib/engine/offerEngine';

interface Transaction {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  category_id?: string;
  reward_earned: number;
  cashback_earned: number;
  user_cards?: {
    id?: string;
    card_id?: string;
    credit_cards?: { card_name?: string; name?: string };
    custom_card_name?: string;
  };
}

const CATEGORIES = ['Travel', 'Dining', 'Shopping', 'Grocery', 'Fuel', 'Online', 'Movies', 'Utilities'];

function formatINR(n: number) {
  return n.toLocaleString('en-IN');
}

// "Connect Bank" modal
const ConnectBankModal = ({ onClose }: { onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-dark-base/80 backdrop-blur-sm" />
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      className="glass-card w-full max-w-sm p-8 text-center rounded-3xl border border-pastel-lavender/30 relative z-10"
    >
      <div className="w-16 h-16 bg-dark-elevated rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
        <Building2 className="w-8 h-8 text-pastel-lavender" />
      </div>
      <h2 className="text-2xl font-display font-bold text-text-primary mb-2">Coming Soon</h2>
      <p className="text-text-muted mb-6">
        Bank & card auto-import is currently in development. Stay tuned — you'll be able to link your accounts directly and see all transactions automatically.
      </p>
      <button onClick={onClose} className="pastel-button px-8 py-3 w-full">Got it!</button>
    </motion.div>
  </div>
);

const Transactions = ({ session: _session }: { session?: any }) => {
  const { store } = useDataStore();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [brandRegistrations, setBrandRegistrations] = useState<any[]>([]);
  const [redemptions, setRedemptions] = useState<OfferRedemptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [editTxn, setEditTxn] = useState<Transaction | null>(null);

  // Accordion toggles for smart recommendation modal
  const [showCardComparison, setShowCardComparison] = useState(false);
  const [showIneligibleCards, setShowIneligibleCards] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // Form State
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('Travel');
  const [userCardId, setUserCardId] = useState('');
  const [recordRedemption, setRecordRedemption] = useState(true);
  const [redemptionStatus, setRedemptionStatus] = useState<'APPLIED' | 'PENDING_CASHBACK'>('APPLIED');
  const [redemptionNotes, setRedemptionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [txns, userCards, userRegistrations, userRedemptions] = await Promise.all([
        api.getTransactions(),
        api.getCards(),
        api.getBrandRegistrations().catch(() => []),
        api.getOfferRedemptions().catch(() => []),
      ]);
      
      const enrichedCards = (userCards || []).map((c: any) => ({
        ...c,
        credit_cards: store?.cardById.get(c.card_id)
      }));
      
      const enrichedTxns = (txns || []).map((t: any) => {
        if (t.user_cards) {
          t.user_cards.credit_cards = store?.cardById.get(t.user_cards.card_id);
        }
        return t;
      });

      setTransactions(enrichedTxns);
      setCards(enrichedCards);
      setBrandRegistrations(userRegistrations || []);
      setRedemptions(userRedemptions || []);
      if (enrichedCards.length > 0) setUserCardId(enrichedCards[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (store) fetchData(); }, [store]);

  const openAddModal = () => {
    setEditTxn(null);
    setMerchant('');
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setCategory('Travel');
    setUserCardId(cards[0]?.id || '');
    setRecordRedemption(true);
    setRedemptionStatus('APPLIED');
    setRedemptionNotes('');
    setFormError('');
    setShowCardComparison(false);
    setShowIneligibleCards(false);
    setShowTerms(false);
    setIsAddModalOpen(true);
  };

  const openEditModal = (txn: Transaction) => {
    setEditTxn(txn);
    setMerchant(txn.merchant);
    setAmount(String(txn.amount));
    setDate(txn.date?.split('T')[0] || '');
    setCategory(txn.category_id || 'Travel');
    const linked = redemptions.find(r => r.transaction_id === txn.id);
    setRecordRedemption(!!linked);
    setRedemptionStatus(linked?.status === 'PENDING_CASHBACK' ? 'PENDING_CASHBACK' : 'APPLIED');
    setRedemptionNotes(linked?.notes || '');
    setFormError('');
    setShowCardComparison(false);
    setShowIneligibleCards(false);
    setShowTerms(false);
    setIsAddModalOpen(true);
  };

  // Live Intelligent Offer Recommendation Engine
  const offerReport = useMemo<OfferEngineReport | null>(() => {
    if (!store || !merchant.trim() || !amount || isNaN(Number(amount)) || Number(amount) <= 0 || cards.length === 0) {
      return null;
    }
    return evaluateTransactionOffers({
      merchant,
      amount: Number(amount),
      category,
      transactionDate: date,
      userCards: cards,
      availableOffers: store.offers || [],
      cardCatalogue: store.cardById,
      brandRegistrations,
      selectedUserCardId: editTxn ? (editTxn.user_cards?.id || userCardId) : userCardId,
    });
  }, [store, merchant, amount, category, date, cards, brandRegistrations, userCardId, editTxn]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setFormError('Please enter a valid amount.');
      return;
    }
    setIsSubmitting(true);
    setFormError('');

    const numAmount = Number(amount);
    let rewardEarned = 0;
    let cashbackEarned = 0;

    if (offerReport?.selectedCardEvaluation) {
      rewardEarned = offerReport.selectedCardEvaluation.benefit.rewardPoints;
      cashbackEarned = offerReport.selectedCardEvaluation.benefit.cashback;
    } else {
      const targetCardId = editTxn ? (editTxn.user_cards?.id || userCardId) : userCardId;
      const selectedCard = cards.find(c => c.id === targetCardId);
      if (selectedCard && store) {
        const dbCard = store.cardById.get(selectedCard.card_id);
        if (dbCard) {
          const base = calculateBaseBenefit(numAmount, dbCard);
          rewardEarned = base.rewardPoints;
          cashbackEarned = base.cashback;
        }
      }
    }

    try {
      if (editTxn) {
        const updated = await api.updateTransaction(editTxn.id, {
          merchant,
          amount: numAmount,
          date,
          category_id: category,
          reward_earned: rewardEarned,
          cashback_earned: cashbackEarned,
        });
        setTransactions(prev => prev.map(t => t.id === editTxn.id ? { ...t, ...updated } : t));

        // Update linked redemption if present
        const linkedRedemption = redemptions.find(r => r.transaction_id === editTxn.id);
        if (linkedRedemption?.id) {
          try {
            const updatedRedemption = await api.updateOfferRedemption(linkedRedemption.id, {
              transaction_amount: numAmount,
              merchant_name: merchant.trim(),
              notes: redemptionNotes || linkedRedemption.notes,
            });
            if (updatedRedemption) {
              setRedemptions(prev => prev.map(r => r.id === updatedRedemption.id ? updatedRedemption : r));
            }
          } catch (rErr) {
            console.error('Failed to sync redemption amount:', rErr);
          }
        }
      } else {
        const newTxn = await api.addTransaction({
          user_card_id: userCardId,
          merchant,
          amount: numAmount,
          date,
          category_id: category,
          reward_earned: rewardEarned,
          cashback_earned: cashbackEarned,
        });
        setTransactions(prev => [{ ...newTxn, user_cards: cards.find(c => c.id === userCardId) }, ...prev]);

        // Record offer redemption if eligible offer was matched and checked
        if (recordRedemption && offerReport?.selectedCardEvaluation?.matchedOffer) {
          const matchedOffer = offerReport.selectedCardEvaluation.matchedOffer;
          const b = offerReport.selectedCardEvaluation.benefit;
          const selectedCard = cards.find(c => c.id === userCardId);
          try {
            const createdRedemption = await api.createOfferRedemption({
              offer_id: matchedOffer.offer_id,
              transaction_id: newTxn.id,
              user_card_id: userCardId,
              card_id: selectedCard?.card_id || null,
              merchant_name: merchant.trim(),
              transaction_amount: numAmount,
              status: redemptionStatus,
              estimated_discount: b.instantDiscount || 0,
              confirmed_discount: b.instantDiscount > 0 && redemptionStatus === 'APPLIED' ? b.instantDiscount : 0,
              estimated_cashback: b.cashback || 0,
              confirmed_cashback: 0,
              estimated_reward_points: b.rewardPoints || 0,
              confirmed_reward_points: 0,
              cashback_status: b.cashback > 0 ? 'PENDING' : 'NOT_APPLICABLE',
              notes: redemptionNotes || `Auto-recorded via transaction matching engine on ${merchant.trim()}`,
            });
            if (createdRedemption) {
              setRedemptions(prev => [createdRedemption, ...prev]);
            }
          } catch (redemptionErr) {
            console.error('Failed to link redemption:', redemptionErr);
          }
        }
      }
      setIsAddModalOpen(false);
      setEditTxn(null);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save transaction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this transaction?')) return;
    const prev = [...transactions];
    const prevRedemptions = [...redemptions];
    setTransactions(t => t.filter(tx => tx.id !== id));
    setRedemptions(r => r.map(red => red.transaction_id === id ? { ...red, transaction_id: null, status: 'NOT_REDEEMED' } : red));
    try {
      await api.deleteTransaction(id);
    } catch {
      setTransactions(prev);
      setRedemptions(prevRedemptions);
      alert('Failed to delete transaction.');
    }
  };

  const handleExport = () => {
    if (transactions.length === 0) return alert('No data to export.');
    const headers = ['Date', 'Merchant', 'Card', 'Amount', 'Reward Earned', 'Cashback Earned'];
    const rows = transactions.map(t => [
      new Date(t.date).toLocaleDateString('en-IN'),
      `"${t.merchant}"`,
      `"${t.user_cards?.credit_cards?.card_name || t.user_cards?.credit_cards?.name || t.user_cards?.custom_card_name || 'Unknown'}"`,
      t.amount,
      t.reward_earned,
      t.cashback_earned,
    ]);
    const csv = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', `cardio_transactions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filtered = useMemo(() =>
    transactions.filter(t => t.merchant?.toLowerCase().includes(searchQuery.toLowerCase())),
    [transactions, searchQuery]);

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen relative">
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-text-primary mb-2">Transactions</h1>
          <p className="text-text-muted font-medium">Track your spending and optimize rewards</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleExport} className="bg-dark-elevated border border-white/10 text-text-primary px-5 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-dark-surface transition-colors">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={openAddModal} className="pastel-button px-6 py-3 inline-flex items-center gap-2">
            <Plus className="w-5 h-5" /> Add Transaction
          </button>
        </div>
      </header>

      {/* Connect Bank Banner — Task 5 */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 rounded-3xl border border-pastel-lavender/20 mb-8 flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden"
      >
        <div className="absolute right-0 top-0 w-48 h-48 bg-pastel-lavender/10 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="flex -space-x-2">
            {['HDFC', 'AXIS', 'SBI', 'AMEX'].map((b, i) => (
              <div key={b} className="w-10 h-10 rounded-full bg-dark-elevated border-2 border-dark-surface flex items-center justify-center text-[8px] font-black text-text-muted" style={{ zIndex: 10 - i }}>
                {b}
              </div>
            ))}
          </div>
          <div>
            <h3 className="font-bold text-text-primary">Connect your bank or credit card</h3>
            <p className="text-sm text-text-muted">Auto-import all transactions instantly. Save time, earn more.</p>
          </div>
        </div>
        <button
          onClick={() => setShowBankModal(true)}
          className="flex-shrink-0 pastel-button px-6 py-3 flex items-center gap-2 relative z-10"
        >
          <Building2 className="w-4 h-4" /> Connect Now
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </motion.div>

      {/* Search */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search merchants..."
            className="glass-input pl-12 w-full py-3"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="w-8 h-8 border-4 border-pastel-lavender/30 border-t-pastel-lavender rounded-full animate-spin"></div>
        </div>
      ) : transactions.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-16 text-center border border-dashed border-white/20 rounded-3xl">
          <CreditCard className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <h2 className="text-2xl font-display font-bold text-text-primary mb-4">No transactions yet</h2>
          <p className="text-text-muted mb-8 max-w-sm mx-auto">Add your first transaction to track your spending and see how much you're earning in rewards.</p>
          <button onClick={openAddModal} className="pastel-button px-8 py-3">Add Transaction</button>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card overflow-hidden rounded-3xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-dark-surface border-b border-white/5">
                  <th className="py-4 px-6 font-bold text-text-muted text-xs uppercase tracking-wider">Date</th>
                  <th className="py-4 px-6 font-bold text-text-muted text-xs uppercase tracking-wider">Merchant</th>
                  <th className="py-4 px-6 font-bold text-text-muted text-xs uppercase tracking-wider">Card Used</th>
                  <th className="py-4 px-6 font-bold text-text-muted text-xs uppercase tracking-wider text-right">Amount</th>
                  <th className="py-4 px-6 font-bold text-text-muted text-xs uppercase tracking-wider text-right">Reward</th>
                  <th className="py-4 px-6 font-bold text-text-muted text-xs uppercase tracking-wider text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(txn => (
                  <tr key={txn.id} className="hover:bg-dark-surface/50 transition-colors group">
                    <td className="py-4 px-6 text-text-muted whitespace-nowrap font-medium text-sm">
                      {new Date(txn.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                    </td>
                    <td className="py-4 px-6 font-bold text-text-primary">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>{txn.merchant}</span>
                        {txn.category_id && (
                          <span className="text-[10px] font-bold text-pastel-lavender bg-pastel-lavender/10 px-2 py-0.5 rounded-md uppercase tracking-wider">
                            {txn.category_id}
                          </span>
                        )}
                        {(() => {
                          const linked = redemptions.find(r => r.transaction_id === txn.id);
                          if (!linked) return null;
                          const isRedeemed = linked.status === 'REDEEMED';
                          const isPending = linked.status === 'PENDING_CASHBACK';
                          return (
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                isRedeemed
                                  ? 'bg-pastel-mint/15 text-pastel-mint border border-pastel-mint/30'
                                  : isPending
                                  ? 'bg-pastel-peach/15 text-pastel-peach border border-pastel-peach/30'
                                  : 'bg-pastel-lavender/15 text-pastel-lavender border border-pastel-lavender/30'
                              }`}
                              title={`Offer: ${linked.offer_id} (${linked.status})`}
                            >
                              <BookmarkCheck className="w-3 h-3" />
                              {isRedeemed ? 'Redeemed' : isPending ? 'Cashback Pending' : 'Offer Applied'}
                            </span>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-text-muted font-medium text-sm">
                      {txn.user_cards?.credit_cards?.card_name || txn.user_cards?.credit_cards?.name || txn.user_cards?.custom_card_name || 'Unknown Card'}
                    </td>
                    <td className="py-4 px-6 text-right font-bold text-text-primary">₹{formatINR(Number(txn.amount))}</td>
                    <td className="py-4 px-6 text-right font-bold text-pastel-mint">
                      {Number(txn.reward_earned) > 0 ? `+${formatINR(Number(txn.reward_earned))} pts` : ''}
                      {Number(txn.cashback_earned) > 0 ? `+₹${formatINR(Number(txn.cashback_earned))}` : ''}
                      {Number(txn.reward_earned) === 0 && Number(txn.cashback_earned) === 0 ? '—' : ''}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEditModal(txn)} className="p-2 hover:bg-white/10 rounded-lg text-text-muted hover:text-pastel-lavender transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(txn.id)} className="p-2 hover:bg-red-500/10 rounded-lg text-text-muted hover:text-red-400 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && searchQuery && (
            <div className="py-12 text-center text-text-muted">No transactions matching "{searchQuery}"</div>
          )}
        </motion.div>
      )}

      {/* Add/Edit Transaction Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAddModalOpen(false)} className="absolute inset-0 bg-dark-base/80 backdrop-blur-sm" />
              {/* Modal Container */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="glass-card w-full max-w-2xl max-h-[92vh] flex flex-col relative z-10 overflow-hidden border border-white/10 rounded-3xl"
              >
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-dark-surface/50 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-pastel-lavender/10 border border-pastel-lavender/30 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-pastel-lavender" />
                    </div>
                    <div>
                      <h2 className="text-xl font-display font-bold text-text-primary">
                        {editTxn ? 'Edit Transaction' : 'Smart Transaction Entry'}
                      </h2>
                      <p className="text-xs text-text-muted">Intelligent offer matching & reward optimization</p>
                    </div>
                  </div>
                  <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                    <X className="w-5 h-5 text-text-muted" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
                  {formError && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm font-medium flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {/* Inputs Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">
                        Amount (₹) *
                      </label>
                      <input
                        type="number"
                        required
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        className="glass-input text-lg font-bold"
                        placeholder="5000"
                        min="1"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">
                        Merchant *
                      </label>
                      <input
                        type="text"
                        required
                        value={merchant}
                        onChange={e => setMerchant(e.target.value)}
                        className="glass-input"
                        placeholder="e.g. Amazon, Swiggy, Flipkart, Zomato"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">
                        Category
                      </label>
                      <select value={category} onChange={e => setCategory(e.target.value)} className="glass-input">
                        {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">
                        Date
                      </label>
                      <input
                        type="date"
                        required
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="glass-input [color-scheme:dark]"
                      />
                    </div>
                  </div>

                  {/* Card Selector */}
                  {!editTxn && (
                    <div>
                      <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">
                        Payment Card
                      </label>
                      {cards.length === 0 ? (
                        <p className="text-text-muted text-sm p-3 bg-dark-elevated rounded-xl">
                          No cards added yet.{' '}
                          <button
                            type="button"
                            onClick={() => { setIsAddModalOpen(false); navigate('/cards'); }}
                            className="text-pastel-lavender underline font-bold"
                          >
                            Add a card first →
                          </button>
                        </p>
                      ) : (
                        <select
                          required
                          value={userCardId}
                          onChange={e => setUserCardId(e.target.value)}
                          className="glass-input font-medium"
                        >
                          {cards.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.credit_cards?.card_name || c.credit_cards?.name || c.custom_card_name} ••{c.last_four_digits} ({c.credit_cards?.issuer || 'Card'})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}

                  {/* ────────────────── INTELLIGENT MATCHING ENGINE INSIGHTS ────────────────── */}
                  {offerReport && (
                    <div className="space-y-4 pt-1">
                      {/* 1. Recommended Card Banner */}
                      {offerReport.recommendedCard && (
                        <div className="p-4 rounded-2xl bg-gradient-to-r from-pastel-mint/15 via-pastel-lavender/10 to-pastel-mint/10 border border-pastel-mint/40 relative overflow-hidden">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-pastel-mint shrink-0" />
                              <span className="text-xs font-bold uppercase tracking-wider text-pastel-mint">
                                Recommended Payment Card
                              </span>
                            </div>
                            {offerReport.recommendedCard.matchedOffer ? (
                              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-pastel-mint/20 text-pastel-mint border border-pastel-mint/30">
                                🎯 {offerReport.recommendedCard.matchedOffer.confidence === 'VERIFIED' ? 'Verified Offer' : 'Promo'}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-text-muted">
                                Best Base Rate
                              </span>
                            )}
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <div className="text-base font-bold text-text-primary">
                                {offerReport.recommendedCard.cardName}
                              </div>
                              <p className="text-xs text-text-muted mt-0.5">
                                {offerReport.recommendedCard.benefit.explanation}
                              </p>
                            </div>
                            <div className="text-right sm:shrink-0">
                              <div className="text-lg font-display font-bold text-pastel-mint">
                                ₹{formatINR(offerReport.recommendedCard.benefit.netBenefitINR)}
                              </div>
                              <div className="text-[11px] text-text-muted font-medium">
                                Net Est. Benefit ({offerReport.recommendedCard.benefit.effectiveReturnPct}%)
                              </div>
                            </div>
                          </div>

                          {/* Switch suggestion if suboptimal card is currently selected */}
                          {offerReport.selectedCardEvaluation &&
                            offerReport.recommendedCard.userCardId !== offerReport.selectedCardEvaluation.userCardId && (
                              <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                                <div className="text-xs text-pastel-peach font-semibold flex items-center gap-1.5">
                                  <span>⚠️</span>
                                  <span>
                                    Switching saves you <strong className="text-white">₹{formatINR(offerReport.potentialSavingsLost)} more</strong>!
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setUserCardId(offerReport.recommendedCard!.userCardId)}
                                  className="text-xs font-bold text-pastel-mint hover:text-white bg-pastel-mint/20 hover:bg-pastel-mint/30 px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1"
                                >
                                  Switch to This Card →
                                </button>
                              </div>
                            )}
                        </div>
                      )}

                      {/* 2. Selected Card Benefit Breakdown */}
                      {offerReport.selectedCardEvaluation && (
                        <div className="p-4 bg-dark-elevated rounded-2xl border border-white/10 space-y-3">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-text-muted font-bold uppercase tracking-wider">
                              Selected Card Benefits ({offerReport.selectedCardEvaluation.cardName})
                            </span>
                            <span className="font-bold text-pastel-mint text-sm">
                              ₹{formatINR(offerReport.selectedCardEvaluation.benefit.netBenefitINR)} Total
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
                            <div className="p-2.5 rounded-xl bg-dark-surface/60 border border-white/5">
                              <div className="text-[11px] text-text-muted font-medium">Instant Discount</div>
                              <div className="font-bold text-pastel-mint mt-0.5 text-sm">
                                {offerReport.selectedCardEvaluation.benefit.instantDiscount > 0
                                  ? `₹${formatINR(offerReport.selectedCardEvaluation.benefit.instantDiscount)}`
                                  : '—'}
                              </div>
                              {offerReport.selectedCardEvaluation.benefit.isCapped && (
                                <div className="text-[9px] text-pastel-peach font-medium mt-0.5">Capped</div>
                              )}
                            </div>

                            <div className="p-2.5 rounded-xl bg-dark-surface/60 border border-white/5">
                              <div className="text-[11px] text-text-muted font-medium">Cashback</div>
                              <div className="font-bold text-pastel-lavender mt-0.5 text-sm">
                                {offerReport.selectedCardEvaluation.benefit.cashback > 0
                                  ? `₹${formatINR(offerReport.selectedCardEvaluation.benefit.cashback)}`
                                  : '—'}
                              </div>
                              {offerReport.selectedCardEvaluation.benefit.isCapped && (
                                <div className="text-[9px] text-pastel-peach font-medium mt-0.5">Capped</div>
                              )}
                            </div>

                            <div className="p-2.5 rounded-xl bg-dark-surface/60 border border-white/5">
                              <div className="text-[11px] text-text-muted font-medium">Reward Points</div>
                              <div className="font-bold text-pastel-peach mt-0.5 text-sm">
                                {offerReport.selectedCardEvaluation.benefit.rewardPoints > 0
                                  ? `+${formatINR(offerReport.selectedCardEvaluation.benefit.rewardPoints)} pts`
                                  : '—'}
                              </div>
                              <div className="text-[9px] text-text-muted mt-0.5">
                                ~₹{formatINR(offerReport.selectedCardEvaluation.benefit.rewardPointsValueINR)}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 3. Brand Registration Reminder & Portal Link */}
                      {offerReport.selectedCardEvaluation?.registrationRequirement && (
                        <div
                          className={`p-3.5 rounded-2xl border text-xs flex items-start gap-3 ${
                            offerReport.selectedCardEvaluation.registrationRequirement.status === 'REGISTERED'
                              ? 'bg-pastel-mint/10 border-pastel-mint/30 text-pastel-mint'
                              : 'bg-pastel-peach/10 border-pastel-peach/30 text-pastel-peach'
                          }`}
                        >
                          {offerReport.selectedCardEvaluation.registrationRequirement.status === 'REGISTERED' ? (
                            <ShieldCheck className="w-5 h-5 text-pastel-mint shrink-0 mt-0.5" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-pastel-peach shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <div className="font-bold text-sm text-text-primary flex items-center justify-between">
                              <span>Brand Registration: {offerReport.selectedCardEvaluation.registrationRequirement.brandName}</span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  offerReport.selectedCardEvaluation.registrationRequirement.status === 'REGISTERED'
                                    ? 'bg-pastel-mint/20 text-pastel-mint'
                                    : 'bg-pastel-peach/20 text-pastel-peach'
                                }`}
                              >
                                {offerReport.selectedCardEvaluation.registrationRequirement.status}
                              </span>
                            </div>
                            <p className="mt-1 text-xs opacity-90 leading-relaxed text-text-muted">
                              {offerReport.selectedCardEvaluation.registrationRequirement.reminderMessage}
                            </p>
                            {offerReport.selectedCardEvaluation.registrationRequirement.portalUrl && (
                              <a
                                href={offerReport.selectedCardEvaluation.registrationRequirement.portalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 mt-2 font-bold text-text-primary hover:text-pastel-lavender transition-colors underline text-xs"
                              >
                                Open Official Merchant Portal <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 4. Comparison View of All Eligible Cards */}
                      {offerReport.eligibleCards.length > 0 && (
                        <div className="rounded-2xl border border-white/10 bg-dark-surface/40 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setShowCardComparison(!showCardComparison)}
                            className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-text-primary hover:bg-white/5 transition-colors"
                          >
                            <span className="flex items-center gap-2">
                              <span>📊 Compare All Your Cards ({offerReport.eligibleCards.length} evaluated)</span>
                            </span>
                            {showCardComparison ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
                          </button>

                          {showCardComparison && (
                            <div className="p-3 border-t border-white/5 space-y-2">
                              {offerReport.eligibleCards.map((card, idx) => {
                                const isSelected = card.userCardId === userCardId;
                                return (
                                  <div
                                    key={card.userCardId}
                                    className={`p-3 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs ${
                                      isSelected
                                        ? 'bg-pastel-lavender/10 border-pastel-lavender/40'
                                        : 'bg-dark-elevated/60 border-white/5 hover:border-white/20'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5">
                                      <span className="w-5 h-5 rounded-full bg-white/5 text-[10px] font-bold flex items-center justify-center text-text-muted shrink-0">
                                        #{idx + 1}
                                      </span>
                                      <div>
                                        <div className="font-bold text-text-primary flex items-center gap-2">
                                          <span>{card.cardName}</span>
                                          {card.matchedOffer && (
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-pastel-mint/20 text-pastel-mint">
                                              Promo
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[11px] text-text-muted mt-0.5">
                                          {card.benefit.explanation}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                                      <div className="text-right">
                                        <div className="font-bold text-pastel-mint text-sm">
                                          ₹{formatINR(card.benefit.netBenefitINR)}
                                        </div>
                                        <div className="text-[10px] text-text-muted">
                                          {card.benefit.effectiveReturnPct}% return
                                        </div>
                                      </div>
                                      {!isSelected ? (
                                        <button
                                          type="button"
                                          onClick={() => setUserCardId(card.userCardId)}
                                          className="px-2.5 py-1 text-xs font-bold rounded-lg bg-white/10 hover:bg-pastel-lavender/20 hover:text-pastel-lavender transition-colors"
                                        >
                                          Select
                                        </button>
                                      ) : (
                                        <span className="text-pastel-lavender font-bold text-xs flex items-center gap-1">
                                          <CheckCircle2 className="w-3.5 h-3.5" /> Selected
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 5. Ineligible Cards & Disqualification Reasons */}
                      {offerReport.ineligibleCards.length > 0 && (
                        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setShowIneligibleCards(!showIneligibleCards)}
                            className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-pastel-peach hover:bg-red-500/10 transition-colors"
                          >
                            <span className="flex items-center gap-2">
                              <span>⚠️ Ineligible Cards for Current Offers ({offerReport.ineligibleCards.length})</span>
                            </span>
                            {showIneligibleCards ? <ChevronUp className="w-4 h-4 text-pastel-peach" /> : <ChevronDown className="w-4 h-4 text-pastel-peach" />}
                          </button>

                          {showIneligibleCards && (
                            <div className="p-3 border-t border-red-500/15 space-y-2">
                              {offerReport.ineligibleCards.map(c => (
                                <div key={c.userCardId} className="p-2.5 rounded-xl bg-dark-elevated/70 border border-red-500/20 text-xs">
                                  <div className="font-bold text-text-primary flex items-center justify-between">
                                    <span>{c.cardName}</span>
                                    <span className="text-[10px] uppercase font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded">
                                      Disqualified
                                    </span>
                                  </div>
                                  <p className="mt-1 text-[11px] text-pastel-peach leading-relaxed">
                                    Reason: {c.ineligibilityReason}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 6. Terms & Conditions Accordion */}
                      {offerReport.selectedCardEvaluation?.matchedOffer && (
                        <div className="rounded-2xl border border-white/10 bg-dark-surface/30 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setShowTerms(!showTerms)}
                            className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-text-muted hover:bg-white/5 transition-colors"
                          >
                            <span className="flex items-center gap-1.5">
                              <Info className="w-3.5 h-3.5" />
                              <span>Offer Terms & Conditions ({offerReport.selectedCardEvaluation.matchedOffer.offer_id})</span>
                            </span>
                            {showTerms ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>

                          {showTerms && (
                            <div className="p-3 border-t border-white/5 text-xs text-text-muted space-y-2 leading-relaxed bg-dark-elevated/40">
                              <p>{offerReport.selectedCardEvaluation.matchedOffer.terms_and_conditions}</p>
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] border-t border-white/5">
                                <span>
                                  Valid until:{' '}
                                  <strong className="text-text-primary">
                                    {offerReport.selectedCardEvaluation.matchedOffer.valid_until || 'Ongoing'}
                                  </strong>
                                </span>
                                {offerReport.selectedCardEvaluation.matchedOffer.source_url && (
                                  <a
                                    href={offerReport.selectedCardEvaluation.matchedOffer.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-pastel-lavender hover:underline inline-flex items-center gap-1"
                                  >
                                    Official Issuer Source <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 7. Offer Redemption Lifecycle Tracking */}
                      {offerReport.selectedCardEvaluation?.matchedOffer && (
                        <div className="p-4 rounded-2xl bg-dark-elevated/90 border border-pastel-lavender/30 space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-text-primary select-none">
                              <input
                                type="checkbox"
                                checked={recordRedemption}
                                onChange={e => setRecordRedemption(e.target.checked)}
                                className="w-4 h-4 rounded text-pastel-lavender bg-dark-surface border-white/20 focus:ring-0 cursor-pointer"
                              />
                              <span className="flex items-center gap-1.5">
                                <BookmarkCheck className="w-4 h-4 text-pastel-lavender" />
                                <span>Record Offer Redemption Lifecycle</span>
                              </span>
                            </label>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pastel-lavender/15 text-pastel-lavender border border-pastel-lavender/20">
                              Savings Tracker
                            </span>
                          </div>

                          {recordRedemption && (
                            <div className="pt-2 border-t border-white/5 space-y-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                                <span className="text-text-muted font-semibold">Initial Redemption Status:</span>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setRedemptionStatus('APPLIED')}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                      redemptionStatus === 'APPLIED'
                                        ? 'bg-pastel-lavender text-dark-base shadow-[0_0_12px_rgba(230,230,250,0.3)]'
                                        : 'bg-dark-surface text-text-muted hover:text-white border border-white/5'
                                    }`}
                                  >
                                    APPLIED (Instant / Points)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRedemptionStatus('PENDING_CASHBACK')}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                      redemptionStatus === 'PENDING_CASHBACK'
                                        ? 'bg-pastel-peach text-dark-base shadow-[0_0_12px_rgba(255,218,185,0.3)]'
                                        : 'bg-dark-surface text-text-muted hover:text-white border border-white/5'
                                    }`}
                                  >
                                    PENDING CASHBACK
                                  </button>
                                </div>
                              </div>

                              <div>
                                <label className="block text-[11px] font-semibold text-text-muted mb-1">
                                  Redemption Note (Optional)
                                </label>
                                <input
                                  type="text"
                                  value={redemptionNotes}
                                  onChange={e => setRedemptionNotes(e.target.value)}
                                  placeholder="e.g. Applied coupon code at checkout"
                                  className="glass-input text-xs py-2"
                                />
                              </div>

                              <p className="text-[11px] text-text-muted leading-relaxed">
                                💡 Records this offer under your Rewards Hub Savings Tracker. Confirmed benefits can be verified once posted.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting || (cards.length === 0 && !editTxn)}
                      className="pastel-button w-full py-4 text-base font-bold disabled:opacity-50"
                    >
                      {isSubmitting ? 'Saving Transaction...' : editTxn ? 'Save Changes' : 'Confirm & Save Transaction'}
                    </button>
                  </div>
                </form>
              </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bank Connect Modal */}
      <AnimatePresence>
        {showBankModal && <ConnectBankModal onClose={() => setShowBankModal(false)} />}
      </AnimatePresence>
    </div>
  );
};

export default Transactions;
