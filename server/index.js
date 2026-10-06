"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const supabase_js_1 = require("@supabase/supabase-js");
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 5000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || ''; // Ideally use SERVICE_ROLE for admin tasks
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
// Middleware to verify Supabase JWT
const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader)
        return res.status(401).json({ error: 'No authorization header' });
    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    // Attach user to request
    req.user = user;
    next();
};
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'CardIO API is running' });
});
// --- DASHBOARD ANALYTICS ---
app.get('/api/dashboard', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    try {
        // Total Cards
        const { count: cardsCount } = await supabase
            .from('user_cards')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_active', true);
        // Monthly Spends (Current Month)
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        const { data: transactions } = await supabase
            .from('transactions')
            .select('amount, reward_earned, cashback_earned')
            .eq('user_id', userId)
            .gte('date', startOfMonth.toISOString());
        const monthlySpends = transactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
        const totalRewards = transactions?.reduce((sum, t) => sum + Number(t.reward_earned), 0) || 0;
        const totalCashback = transactions?.reduce((sum, t) => sum + Number(t.cashback_earned), 0) || 0;
        // Loyalty Balances
        const { data: loyalty } = await supabase
            .from('user_loyalty_accounts')
            .select('current_balance, airline_loyalty_programs(program_name)')
            .eq('user_id', userId);
        const totalMiles = loyalty?.reduce((sum, l) => sum + Number(l.current_balance), 0) || 0;
        res.json({
            totalCards: cardsCount || 0,
            monthlySpends,
            totalRewards,
            totalCashback,
            totalMiles
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// --- CATALOGUE ---
app.get('/api/catalogue/cards', async (req, res) => {
    const { data, error } = await supabase.from('credit_cards').select('*');
    if (error)
        return res.status(500).json({ error: error.message });
    res.json(data);
});
app.get('/api/catalogue/airlines', async (req, res) => {
    const { data, error } = await supabase.from('airline_loyalty_programs').select('*');
    if (error)
        return res.status(500).json({ error: error.message });
    res.json(data);
});
// --- USER CARDS ---
app.get('/api/cards', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const { data, error } = await supabase
        .from('user_cards')
        .select('*, credit_cards(*)')
        .eq('user_id', userId);
    if (error)
        return res.status(500).json({ error: error.message });
    res.json(data);
});
app.post('/api/cards', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const { card_id, custom_bank, custom_card_name, custom_network, last_four_digits, credit_limit, billing_cycle_day, payment_due_day } = req.body;
    const { data, error } = await supabase
        .from('user_cards')
        .insert([{
            user_id: userId,
            card_id,
            custom_bank,
            custom_card_name,
            custom_network,
            last_four_digits,
            credit_limit,
            billing_cycle_day,
            payment_due_day
        }])
        .select()
        .single();
    if (error)
        return res.status(500).json({ error: error.message });
    res.json(data);
});
// --- TRANSACTIONS ---
app.get('/api/transactions', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const { data, error } = await supabase
        .from('transactions')
        .select('*, user_cards(*, credit_cards(*))')
        .eq('user_id', userId)
        .order('date', { ascending: false });
    if (error)
        return res.status(500).json({ error: error.message });
    res.json(data);
});
app.post('/api/transactions', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const { user_card_id, merchant, amount, date, category_id } = req.body;
    // 1. Calculate Rewards Logic
    // Fetch the card details to determine reward rules
    const { data: userCard } = await supabase
        .from('user_cards')
        .select('*, credit_cards(reward_type, reward_rate)')
        .eq('id', user_card_id)
        .single();
    let reward_earned = 0;
    let cashback_earned = 0;
    if (userCard && userCard.credit_cards) {
        const rateRules = userCard.credit_cards.reward_rate;
        // VERY Basic Logic: if rateRules has 'base', apply it.
        // In production, we'd look up category_id -> category name -> match with rateRules
        const baseRate = rateRules?.base || 1;
        if (userCard.credit_cards.reward_type === 'cashback') {
            cashback_earned = (amount * baseRate) / 100;
        }
        else {
            reward_earned = Math.floor((amount * baseRate) / 100);
        }
    }
    // 2. Insert Transaction
    const { data, error } = await supabase
        .from('transactions')
        .insert([{
            user_id: userId,
            user_card_id,
            merchant,
            amount,
            date,
            category_id,
            reward_earned,
            cashback_earned
        }])
        .select()
        .single();
    if (error)
        return res.status(500).json({ error: error.message });
    res.json(data);
});
// --- TRAVEL GOALS ---
app.get('/api/travel-goals', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const { data, error } = await supabase
        .from('travel_goals')
        .select('*, airline_loyalty_programs(*)')
        .eq('user_id', userId);
    if (error)
        return res.status(500).json({ error: error.message });
    res.json(data);
});
app.post('/api/travel-goals', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const { departure, destination, departure_date, return_date, estimated_cash_fare, program_id, target_points } = req.body;
    const { data, error } = await supabase
        .from('travel_goals')
        .insert([{
            user_id: userId,
            departure,
            destination,
            departure_date,
            return_date,
            estimated_cash_fare,
            program_id,
            target_points
        }])
        .select()
        .single();
    if (error)
        return res.status(500).json({ error: error.message });
    res.json(data);
});
// --- RECOMMENDATION ENGINE ---
app.post('/api/recommendations', authMiddleware, async (req, res) => {
    const userId = req.user.id;
    const { amount, category } = req.body; // e.g. 'Travel'
    try {
        const { data: userCards } = await supabase
            .from('user_cards')
            .select('*, credit_cards(*)')
            .eq('user_id', userId)
            .eq('is_active', true);
        if (!userCards || userCards.length === 0) {
            return res.json({ recommended: null });
        }
        // Evaluate each card
        let bestCard = userCards[0];
        let maxReturn = 0;
        userCards.forEach(card => {
            const rules = card.credit_cards?.reward_rate || {};
            const catKey = category.toLowerCase();
            // Try to find category specific multiplier, else fallback to base
            const multiplier = rules[catKey] || rules['base'] || 1;
            const expectedValue = (amount * multiplier) / 100;
            if (expectedValue > maxReturn) {
                maxReturn = expectedValue;
                bestCard = card;
            }
        });
        res.json({
            recommended: {
                userCardId: bestCard.id,
                bank: bestCard.credit_cards?.bank || bestCard.custom_bank,
                cardName: bestCard.credit_cards?.card_name || bestCard.custom_card_name,
                expectedReward: maxReturn,
                rewardType: bestCard.credit_cards?.reward_type || 'Points',
            },
            alternatives: userCards.filter(c => c.id !== bestCard.id).map(c => ({
                userCardId: c.id,
                bank: c.credit_cards?.bank || c.custom_bank,
                cardName: c.credit_cards?.card_name || c.custom_card_name,
            })),
            explanation: `Provides the highest applicable reward (${maxReturn} value) for the ${category} category.`
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
//# sourceMappingURL=index.js.map