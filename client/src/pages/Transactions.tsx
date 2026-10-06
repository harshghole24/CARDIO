import React, { useEffect, useState } from 'react';
import { Plus, Search, Filter, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../lib/api';

const Transactions = ({ session }: { session: any }) => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form State
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [category, setCategory] = useState('Travel');
  const [userCardId, setUserCardId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const [txns, userCards] = await Promise.all([
        api.getTransactions(),
        api.getCards()
      ]);
      setTransactions(txns || []);
      setCards(userCards || []);
      if (userCards && userCards.length > 0) {
        setUserCardId(userCards[0].id);
      }
      // Set default date to today
      setDate(new Date().toISOString().split('T')[0]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      await api.addTransaction({
        user_card_id: userCardId,
        merchant,
        amount: Number(amount),
        date,
        // Mocking category ID for now since we don't fetch categories from DB yet
        category_id: null,
      });
      setIsAddModalOpen(false);
      setMerchant('');
      setAmount('');
      await fetchTransactions();
    } catch (err) {
      setError('Failed to add transaction. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen relative">
      <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-text-primary mb-2">Transactions</h1>
          <p className="text-text-muted font-medium">Track your spending and optimize rewards</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="pastel-button px-6 py-3 inline-flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Transaction
        </button>
      </header>

      {/* Filters and Search */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
          <input
            type="text"
            placeholder="Search merchants, categories..."
            className="glass-input pl-12"
          />
        </div>
        <button className="bg-dark-elevated border border-white/5 text-text-primary px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-dark-surface transition-colors shadow-sm">
          <Filter className="w-5 h-5" />
          Filters
        </button>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="w-8 h-8 border-4 border-pastel-lavender/30 border-t-pastel-lavender rounded-full animate-spin"></div>
        </div>
      ) : transactions.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-16 text-center border border-dashed border-white/20">
          <h2 className="text-2xl font-display font-bold text-text-primary mb-4">No transactions yet</h2>
          <p className="text-text-muted mb-8 max-w-sm mx-auto">Add your first transaction to track your spending and see how much you're earning in rewards.</p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="pastel-button px-8 py-3"
          >
            Add Transaction
          </button>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-dark-surface border-b border-white/5">
                  <th className="py-4 px-6 font-bold text-text-muted text-xs uppercase tracking-wider">Date</th>
                  <th className="py-4 px-6 font-bold text-text-muted text-xs uppercase tracking-wider">Merchant</th>
                  <th className="py-4 px-6 font-bold text-text-muted text-xs uppercase tracking-wider">Card Used</th>
                  <th className="py-4 px-6 font-bold text-text-muted text-xs uppercase tracking-wider text-right">Amount</th>
                  <th className="py-4 px-6 font-bold text-text-muted text-xs uppercase tracking-wider text-right">Reward Earned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {transactions.map((txn) => (
                  <tr key={txn.id} className="hover:bg-dark-surface/50 transition-colors">
                    <td className="py-4 px-6 text-text-muted whitespace-nowrap font-medium text-sm">
                      {new Date(txn.date).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-6 font-bold text-text-primary">{txn.merchant}</td>
                    <td className="py-4 px-6 text-text-muted font-medium text-sm">
                      {txn.user_cards?.credit_cards?.card_name || txn.user_cards?.custom_card_name || 'Unknown Card'}
                    </td>
                    <td className="py-4 px-6 text-right font-bold text-text-primary">₹{Number(txn.amount).toLocaleString()}</td>
                    <td className="py-4 px-6 text-right font-bold text-pastel-mint">
                      {Number(txn.reward_earned) > 0 ? `+${txn.reward_earned} Pts` : ''}
                      {Number(txn.cashback_earned) > 0 ? `+₹${txn.cashback_earned}` : ''}
                      {Number(txn.reward_earned) === 0 && Number(txn.cashback_earned) === 0 ? '-' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Add Transaction Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-dark-base/80 backdrop-blur-sm"
            ></motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-card w-full max-w-lg flex flex-col relative z-10 overflow-hidden border border-white/10"
            >
              <div className="p-6 border-b border-white/5 flex justify-between items-center bg-dark-surface/50">
                <h2 className="text-2xl font-display font-bold text-text-primary">Add Transaction</h2>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                  <X className="w-5 h-5 text-text-muted" />
                </button>
              </div>

              <form onSubmit={handleAddTransaction} className="p-6 space-y-5">
                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm font-medium">
                    {error}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-bold text-text-muted mb-1">Amount (₹)</label>
                  <input type="number" required value={amount} onChange={e => setAmount(e.target.value)} className="glass-input" placeholder="5000" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-text-muted mb-1">Merchant</label>
                  <input type="text" required value={merchant} onChange={e => setMerchant(e.target.value)} className="glass-input" placeholder="MakeMyTrip" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-text-muted mb-1">Category</label>
                  <select value={category} onChange={e => setCategory(e.target.value)} className="glass-input">
                    <option>Travel</option>
                    <option>Dining</option>
                    <option>Shopping</option>
                    <option>Grocery</option>
                    <option>Fuel</option>
                    <option>Online</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-text-muted mb-1">Card Used</label>
                  <select required value={userCardId} onChange={e => setUserCardId(e.target.value)} className="glass-input">
                    {cards.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.credit_cards?.card_name || c.custom_card_name} ending in {c.last_four_digits}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-text-muted mb-1">Date</label>
                  <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="glass-input [color-scheme:dark]" />
                </div>

                <div className="pt-4">
                  <button type="submit" disabled={isSubmitting} className="pastel-button w-full py-4">
                    {isSubmitting ? 'Saving...' : 'Add Transaction'}
                  </button>
                  <p className="text-xs text-center text-text-muted mt-3">The CardIO AI will automatically calculate rewards for this transaction based on your card's reward multiplier.</p>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Transactions;
