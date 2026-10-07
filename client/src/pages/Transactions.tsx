import React, { useEffect, useState, useMemo } from 'react';
import { Plus, Search, X, Building2, CreditCard, Pencil, Trash2, Download, ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';
import { useDataStore } from '../lib/data/DataContext';
import { useNavigate } from 'react-router-dom';

interface Transaction {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  reward_earned: number;
  cashback_earned: number;
  user_cards?: {
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

const Transactions = ({ session }: { session: any }) => {
  const { store } = useDataStore();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showBankModal, setShowBankModal] = useState(false);
  const [editTxn, setEditTxn] = useState<Transaction | null>(null);

  // Form State
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('Travel');
  const [userCardId, setUserCardId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [txns, userCards] = await Promise.all([api.getTransactions(), api.getCards()]);
      setTransactions(txns || []);
      setCards(userCards || []);
      if (userCards?.length > 0) setUserCardId(userCards[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openAddModal = () => {
    setEditTxn(null);
    setMerchant('');
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setCategory('Travel');
    setUserCardId(cards[0]?.id || '');
    setFormError('');
    setIsAddModalOpen(true);
  };

  const openEditModal = (txn: Transaction) => {
    setEditTxn(txn);
    setMerchant(txn.merchant);
    setAmount(String(txn.amount));
    setDate(txn.date?.split('T')[0] || '');
    setCategory('Travel');
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setFormError('Please enter a valid amount.');
      return;
    }
    setIsSubmitting(true);
    setFormError('');
    try {
      if (editTxn) {
        const updated = await api.updateTransaction(editTxn.id, {
          merchant, amount: Number(amount), date, category_id: null,
        });
        setTransactions(prev => prev.map(t => t.id === editTxn.id ? { ...t, ...updated } : t));
      } else {
        const newTxn = await api.addTransaction({
          user_card_id: userCardId, merchant, amount: Number(amount), date, category_id: null,
        });
        setTransactions(prev => [{ ...newTxn, user_cards: cards.find(c => c.id === userCardId) }, ...prev]);
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
    setTransactions(t => t.filter(tx => tx.id !== id));
    try {
      await api.deleteTransaction(id);
    } catch {
      setTransactions(prev);
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

  // Best card hint for current add form
  const bestCardHint = useMemo(() => {
    if (!store || !amount || isNaN(Number(amount)) || Number(amount) <= 0 || cards.length === 0) return null;
    const amt = Number(amount);
    let best: any = null;
    let bestPts = -1;
    for (const uc of cards) {
      const dbCard = store.cardById.get(uc.card_id);
      if (!dbCard) continue;
      const pts = Math.floor((amt / 100) * dbCard.base_points_per_100_inr_derived);
      if (pts > bestPts) { bestPts = pts; best = { uc, dbCard, pts }; }
    }
    return best;
  }, [store, amount, cards]);

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
                    <td className="py-4 px-6 font-bold text-text-primary">{txn.merchant}</td>
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
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-card w-full max-w-lg relative z-10 overflow-hidden border border-white/10 rounded-3xl"
            >
              <div className="p-6 border-b border-white/5 flex justify-between items-center bg-dark-surface/50">
                <h2 className="text-2xl font-display font-bold text-text-primary">{editTxn ? 'Edit Transaction' : 'Add Transaction'}</h2>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                  <X className="w-5 h-5 text-text-muted" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                {formError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm font-medium">{formError}</div>
                )}

                <div>
                  <label className="block text-sm font-bold text-text-muted mb-1">Amount (₹)</label>
                  <input type="number" required value={amount} onChange={e => setAmount(e.target.value)} className="glass-input" placeholder="5000" min="1" />
                </div>

                <div>
                  <label className="block text-sm font-bold text-text-muted mb-1">Merchant</label>
                  <input type="text" required value={merchant} onChange={e => setMerchant(e.target.value)} className="glass-input" placeholder="MakeMyTrip" />
                </div>

                <div>
                  <label className="block text-sm font-bold text-text-muted mb-1">Category</label>
                  <select value={category} onChange={e => setCategory(e.target.value)} className="glass-input">
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>

                {!editTxn && (
                  <div>
                    <label className="block text-sm font-bold text-text-muted mb-1">Card Used</label>
                    {cards.length === 0 ? (
                      <p className="text-text-muted text-sm p-3 bg-dark-elevated rounded-xl">
                        No cards added yet. <button type="button" onClick={() => { setIsAddModalOpen(false); navigate('/cards'); }} className="text-pastel-lavender underline">Add a card first →</button>
                      </p>
                    ) : (
                      <select required value={userCardId} onChange={e => setUserCardId(e.target.value)} className="glass-input">
                        {cards.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.credit_cards?.card_name || c.credit_cards?.name || c.custom_card_name} ••{c.last_four_digits}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {/* Best Card Hint */}
                {!editTxn && bestCardHint && userCardId !== bestCardHint.uc.id && (
                  <div className="bg-pastel-mint/10 border border-pastel-mint/20 p-3 rounded-xl text-sm">
                    <span className="text-pastel-mint font-bold">💡 Best card for this:</span>
                    <span className="text-text-muted ml-2">
                      {bestCardHint.dbCard.name} earns {bestCardHint.pts} pts for this spend.
                    </span>
                    <button type="button" onClick={() => setUserCardId(bestCardHint.uc.id)} className="ml-2 text-pastel-lavender underline font-bold">
                      Switch →
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-bold text-text-muted mb-1">Date</label>
                  <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="glass-input [color-scheme:dark]" />
                </div>

                <div className="pt-2">
                  <button type="submit" disabled={isSubmitting || (cards.length === 0 && !editTxn)} className="pastel-button w-full py-4 disabled:opacity-50">
                    {isSubmitting ? 'Saving...' : editTxn ? 'Save Changes' : 'Add Transaction'}
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
