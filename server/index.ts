import 'dotenv/config'; // MUST be first to load env before anything else
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const app = express();
const port = process.env.PORT || 5000;

// Security Headers Middleware
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

app.use(cors({
  origin: process.env.CLIENT_ORIGIN 
    ? [process.env.CLIENT_ORIGIN, 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000']
    : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anonKey = process.env.SUPABASE_ANON_KEY || '';
const supabaseKey = serviceRoleKey || anonKey;

const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Resource ownership verification helpers (defense against IDOR & Parameter Tampering)
async function verifyUserCardOwnership(supabase: any, userId: string, userCardId: string | null | undefined): Promise<boolean> {
  if (!userCardId) return true;
  const { data } = await supabase
    .from('user_cards')
    .select('id')
    .eq('id', userCardId)
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}

async function verifyTransactionOwnership(supabase: any, userId: string, transactionId: string | null | undefined): Promise<boolean> {
  if (!transactionId) return true;
  const { data } = await supabase
    .from('transactions')
    .select('id')
    .eq('id', transactionId)
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}

const authMiddleware = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No authorization header' });
  
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Missing bearer token' });

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  
  if (error || !user) {
    return res.status(401).json({ error: 'Unauthorized — invalid or expired session token' });
  }
  
  // Attach user and authenticated supabase client to request
  (req as any).user = user;
  const userClient = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false }
  });
  (req as any).supabase = userClient;

  // Auto-insert profile just in case the trigger didn't fire for older users
  const { error: profileError } = await userClient.from('profiles').insert({
    id: user.id,
    full_name: user.user_metadata?.full_name || 'CardIO User',
    updated_at: new Date().toISOString()
  });
  
  if (profileError && profileError.code !== '23505') { // Ignore unique constraint violation
    console.error('PROFILE INSERT ERROR:', profileError.message);
  }

  next();
};

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'CardIO API is running' });
});

// --- DASHBOARD ANALYTICS ---
app.get('/api/dashboard', authMiddleware, async (req, res) => {
  const userId = (req as any).user.id;
  
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0 to 11

    // 1. Current Month boundaries: YYYY-MM-01
    const currentMonthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;

    // 2. Previous Month boundaries:
    const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const prevYear = prevMonthDate.getFullYear();
    const prevMonth = prevMonthDate.getMonth();
    const prevMonthStart = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-01`;
    const endOfPrevMonthDate = new Date(currentYear, currentMonth, 0);
    const prevMonthEnd = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(endOfPrevMonthDate.getDate()).padStart(2, '0')}`;

    // 3. Current Year boundary: YYYY-01-01
    const currentYearStart = `${currentYear}-01-01`;

    // Concurrently fetch user cards, transactions, offer redemptions, and travel goals
    const [
      cardsRes,
      allTxnsRes,
      redemptionsRes,
      travelGoalsRes
    ] = await Promise.all([
      (req as any).supabase
        .from('user_cards')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true),
      (req as any).supabase
        .from('transactions')
        .select('id, amount, reward_earned, cashback_earned, date, merchant, category_id, user_card_id, user_cards(*)')
        .eq('user_id', userId)
        .order('date', { ascending: false }),
      (req as any).supabase
        .from('offer_redemptions')
        .select('*')
        .eq('user_id', userId),
      (req as any).supabase
        .from('travel_goals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
    ]);

    const activeCards = cardsRes.data || [];
    const transactions = allTxnsRes.data || [];
    const redemptions = redemptionsRes.data || [];
    const travelGoals = travelGoalsRes.data || [];

    // Calculate spends
    let currentMonthSpend = 0;
    let prevMonthSpend = 0;
    let currentYearSpend = 0;
    let totalAllTimeSpend = 0;
    let totalTransactionRewards = 0;
    let totalTransactionCashback = 0;

    for (const t of transactions) {
      const amt = Number(t.amount) || 0;
      const tDate = t.date ? t.date.split('T')[0] : '';
      totalAllTimeSpend += amt;
      totalTransactionRewards += Number(t.reward_earned) || 0;
      totalTransactionCashback += Number(t.cashback_earned) || 0;

      if (tDate >= currentMonthStart) {
        currentMonthSpend += amt;
      } else if (tDate >= prevMonthStart && tDate <= prevMonthEnd) {
        prevMonthSpend += amt;
      }

      if (tDate >= currentYearStart) {
        currentYearSpend += amt;
      }
    }

    // Month-over-Month comparison percentage
    let spendChangeMoM: number | null = null;
    if (prevMonthSpend > 0) {
      spendChangeMoM = Number((((currentMonthSpend - prevMonthSpend) / prevMonthSpend) * 100).toFixed(1));
    }

    // Calculate Redemptions KPIs
    let confirmedSavings = 0;
    let confirmedDiscount = 0;
    let confirmedCashback = 0;
    let confirmedRewardPoints = 0;
    let pendingCashback = 0;
    let redeemedOffersCount = 0;
    let savedOffersCount = 0;
    let appliedOffersCount = 0;

    for (const r of redemptions) {
      if (r.status === 'REDEEMED') {
        redeemedOffersCount++;
        const disc = Number(r.confirmed_discount) || 0;
        const cb = Number(r.confirmed_cashback) || 0;
        const pts = Number(r.confirmed_reward_points) || 0;
        confirmedDiscount += disc;
        confirmedCashback += cb;
        confirmedRewardPoints += pts;
        // Point valuation into INR (default 25 paise = ₹0.25)
        confirmedSavings += disc + cb + Math.round((pts * 25) / 100);
      } else if (r.status === 'PENDING_CASHBACK' || r.cashback_status === 'PENDING') {
        pendingCashback += Number(r.estimated_cashback) || 0;
      } else if (r.status === 'SAVED') {
        savedOffersCount++;
      } else if (r.status === 'APPLIED') {
        appliedOffersCount++;
      }
    }

    const totalConfirmedRewardPoints = totalTransactionRewards + confirmedRewardPoints;

    res.json({
      cardsCount: activeCards.length,
      currentMonthSpend: Math.round(currentMonthSpend),
      prevMonthSpend: Math.round(prevMonthSpend),
      spendChangeMoM,
      currentYearSpend: Math.round(currentYearSpend),
      totalAllTimeSpend: Math.round(totalAllTimeSpend),
      totalTransactionsCount: transactions.length,
      confirmedSavings: Math.round(confirmedSavings),
      confirmedDiscount: Math.round(confirmedDiscount),
      confirmedCashback: Math.round(confirmedCashback),
      pendingCashback: Math.round(pendingCashback),
      confirmedPoints: totalConfirmedRewardPoints,
      redeemedOffersCount,
      savedOffersCount,
      appliedOffersCount,
      activeGoalsCount: travelGoals.length,
      travelGoal: travelGoals.length > 0 ? travelGoals[0] : null,
      travelGoals,
      recentTransactions: transactions.slice(0, 5),
      // Backwards compatibility with previous dashboard structure
      totalCards: activeCards.length,
      monthlySpends: Math.round(currentMonthSpend),
      totalRewards: totalConfirmedRewardPoints,
      totalCashback: Math.round(confirmedCashback + totalTransactionCashback),
      totalMiles: totalConfirmedRewardPoints,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- CATALOGUE ---
app.get('/api/catalogue/cards', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('credit_cards').select('*');
    if (error) return res.status(200).json([]); // Fallback to empty if DB table not present
    res.json(data || []);
  } catch {
    res.json([]);
  }
});

app.get('/api/catalogue/airlines', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('airline_loyalty_programs').select('*');
    if (error) return res.status(200).json([]);
    res.json(data || []);
  } catch {
    res.json([]);
  }
});

// --- USER CARDS ---
app.get('/api/cards', authMiddleware, async (req, res) => {
  const userId = (req as any).user.id;
  const { data, error } = await (req as any).supabase
    .from('user_cards')
    .select('*')
    .eq('user_id', userId);
  
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/cards', authMiddleware, async (req, res) => {
  const userId = (req as any).user.id;
  const { card_id, custom_bank, custom_card_name, custom_network, last_four_digits, credit_limit, billing_cycle_day, payment_due_day } = req.body;
  
  if (!card_id && (!custom_card_name || !String(custom_card_name).trim())) {
    return res.status(400).json({ error: 'Card catalogue selection or custom card name is required' });
  }

  let parsedLimit: number | null = null;
  if (credit_limit !== undefined && credit_limit !== null && credit_limit !== '') {
    const numLimit = Number(credit_limit);
    if (isNaN(numLimit) || numLimit < 0 || numLimit > 1_000_000_000) {
      return res.status(400).json({ error: 'Credit limit must be a valid non-negative number up to 1,000,000,000' });
    }
    parsedLimit = numLimit;
  }

  let parsedBillingDay: number | null = null;
  if (billing_cycle_day !== undefined && billing_cycle_day !== null && billing_cycle_day !== '') {
    const bDay = Number(billing_cycle_day);
    if (isNaN(bDay) || bDay < 1 || bDay > 31) {
      return res.status(400).json({ error: 'Billing cycle day must be between 1 and 31' });
    }
    parsedBillingDay = bDay;
  }

  let parsedPaymentDueDay: number | null = null;
  if (payment_due_day !== undefined && payment_due_day !== null && payment_due_day !== '') {
    const pDay = Number(payment_due_day);
    if (isNaN(pDay) || pDay < 1 || pDay > 31) {
      return res.status(400).json({ error: 'Payment due day must be between 1 and 31' });
    }
    parsedPaymentDueDay = pDay;
  }

  const { data, error } = await (req as any).supabase
    .from('user_cards')
    .insert([{
      user_id: userId,
      card_id: card_id ? String(card_id).trim() : null,
      custom_bank: custom_bank ? String(custom_bank).trim() : null,
      custom_card_name: custom_card_name ? String(custom_card_name).trim() : null,
      custom_network: custom_network ? String(custom_network).trim() : null,
      last_four_digits: last_four_digits ? String(last_four_digits).trim().slice(-4) : null,
      credit_limit: parsedLimit,
      billing_cycle_day: parsedBillingDay,
      payment_due_day: parsedPaymentDueDay
    }])
    .select()
    .single();
    
  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'This card is already added to your portfolio.' });
    }
    console.error('ADD CARD ERROR:', error.message);
    return res.status(500).json({ error: error.message });
  }
  res.status(201).json(data);
});

app.delete('/api/cards/:id', authMiddleware, async (req, res) => {
  const userId = (req as any).user.id;
  const cardId = req.params.id;

  try {
    // 1. Safely unlink transactions linked to this card (preserves transaction amounts & spend history)
    await (req as any).supabase
      .from('transactions')
      .update({ user_card_id: null })
      .eq('user_card_id', cardId)
      .eq('user_id', userId);

    // 2. Safely unlink brand registrations linked to this card
    await (req as any).supabase
      .from('brand_registrations')
      .update({ user_card_id: null })
      .eq('user_card_id', cardId)
      .eq('user_id', userId);

    // 3. Safely unlink offer redemptions (preserves card_id string for point valuation & history)
    await (req as any).supabase
      .from('offer_redemptions')
      .update({ user_card_id: null })
      .eq('user_card_id', cardId)
      .eq('user_id', userId);

    // 4. Delete the card record
    const { error, count } = await (req as any).supabase
      .from('user_cards')
      .delete({ count: 'exact' })
      .eq('id', cardId)
      .eq('user_id', userId);

    if (error) return res.status(500).json({ error: error.message });
    if (count === 0) return res.status(404).json({ error: 'Card not found or unauthorized' });
    res.json({ success: true, count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- TRANSACTIONS ---
app.post('/api/offers/evaluate', authMiddleware, async (req, res) => {
  const userId = (req as any).user.id;
  const { merchant, amount, category, user_card_id } = req.body;

  if (!merchant || typeof merchant !== 'string' || !merchant.trim()) {
    return res.status(400).json({ error: 'Merchant name is required' });
  }

  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: 'Valid positive transaction amount is required' });
  }

  try {
    const [cardRes, brandRes] = await Promise.all([
      user_card_id
        ? (req as any).supabase.from('user_cards').select('*').eq('id', user_card_id).eq('user_id', userId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      (req as any).supabase.from('brand_registrations').select('*').eq('user_id', userId)
    ]);

    if (user_card_id && !cardRes.data) {
      return res.status(404).json({ error: 'Selected card not found or unauthorized' });
    }

    res.json({
      valid: true,
      merchant: merchant.trim(),
      amount: numAmount,
      category: category || 'General',
      card_verified: !!cardRes.data,
      brand_registrations: brandRes.data || [],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Offer evaluation failed' });
  }
});

app.get('/api/transactions', authMiddleware, async (req, res) => {
  const userId = (req as any).user.id;
  const { data, error } = await (req as any).supabase
    .from('transactions')
    .select('*, user_cards(*)')
    .eq('user_id', userId)
    .order('date', { ascending: false });
    
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/transactions', authMiddleware, async (req, res) => {
  const userId = (req as any).user.id;
  const { user_card_id, merchant, amount, date, category_id, reward_earned: clientReward, cashback_earned: clientCashback } = req.body;
  
  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0 || numAmount > 100_000_000) {
    return res.status(400).json({ error: 'Valid positive transaction amount up to ₹100,000,000 is required' });
  }
  if (!merchant || typeof merchant !== 'string' || !merchant.trim()) {
    return res.status(400).json({ error: 'Merchant name is required' });
  }

  // IDOR defense: Verify card belongs to the authenticated user
  if (user_card_id) {
    const isOwner = await verifyUserCardOwnership((req as any).supabase, userId, user_card_id);
    if (!isOwner) {
      return res.status(403).json({ error: 'Card not found or does not belong to the authenticated user' });
    }
  }

  // Reward Calculation Logic:
  // If client supplied pre-computed rewards from its validated CSV engine, use them.
  // Otherwise default to standard 1% estimation.
  let reward_earned = clientReward !== undefined ? Math.max(0, Number(clientReward)) : 0;
  let cashback_earned = clientCashback !== undefined ? Math.max(0, Number(clientCashback)) : 0;

  if (reward_earned === 0 && cashback_earned === 0) {
    reward_earned = Math.floor(numAmount * 0.02); // 2% base reward points fallback
  }

  // Insert Transaction
  const { data, error } = await (req as any).supabase
    .from('transactions')
    .insert([{
      user_id: userId,
      user_card_id: user_card_id || null,
      merchant: merchant.trim(),
      amount: numAmount,
      date: date || new Date().toISOString().split('T')[0],
      category_id: category_id || null,
      reward_earned,
      cashback_earned
    }])
    .select('*, user_cards(*)')
    .single();
    
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

app.patch('/api/transactions/:id', authMiddleware, async (req, res) => {
  const userId = (req as any).user.id;
  const { id } = req.params;
  const { user_card_id, merchant, amount, date, category_id, reward_earned, cashback_earned } = req.body;

  const updatePayload: any = {};
  if (merchant !== undefined) {
    if (typeof merchant !== 'string' || !merchant.trim()) {
      return res.status(400).json({ error: 'Merchant name cannot be empty' });
    }
    updatePayload.merchant = merchant.trim();
  }
  if (amount !== undefined) {
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0 || numAmount > 100_000_000) {
      return res.status(400).json({ error: 'Valid positive transaction amount up to ₹100,000,000 is required' });
    }
    updatePayload.amount = numAmount;
  }
  if (user_card_id !== undefined) {
    if (user_card_id) {
      const isOwner = await verifyUserCardOwnership((req as any).supabase, userId, user_card_id);
      if (!isOwner) {
        return res.status(403).json({ error: 'Card not found or does not belong to the authenticated user' });
      }
    }
    updatePayload.user_card_id = user_card_id || null;
  }
  if (date !== undefined) updatePayload.date = date;
  if (category_id !== undefined) updatePayload.category_id = category_id;
  if (reward_earned !== undefined) updatePayload.reward_earned = Math.max(0, Number(reward_earned));
  if (cashback_earned !== undefined) updatePayload.cashback_earned = Math.max(0, Number(cashback_earned));

  const { data, error } = await (req as any).supabase
    .from('transactions')
    .update(updatePayload)
    .eq('id', id)
    .eq('user_id', userId)
    .select('*, user_cards(*)')
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Transaction not found or unauthorized' });
  res.json(data);
});

app.delete('/api/transactions/:id', authMiddleware, async (req, res) => {
  const userId = (req as any).user.id;
  const { id } = req.params;

  // Unlink or update any offer redemptions linked to this transaction
  await (req as any).supabase
    .from('offer_redemptions')
    .update({
      transaction_id: null,
      status: 'NOT_REDEEMED',
      notes: 'Associated transaction was deleted'
    })
    .eq('transaction_id', id)
    .eq('user_id', userId);

  const { error, count } = await (req as any).supabase
    .from('transactions')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) return res.status(500).json({ error: error.message });
  if (count === 0) return res.status(404).json({ error: 'Transaction not found or unauthorized' });
  res.json({ success: true, count });
});

// --- TRAVEL GOALS ---
app.get('/api/travel-goals', authMiddleware, async (req, res) => {
  const userId = (req as any).user.id;
  const { data, error } = await (req as any).supabase
    .from('travel_goals')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
    
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/travel-goals', authMiddleware, async (req, res) => {
  const userId = (req as any).user.id;
  const { departure, destination, departure_date, return_date, estimated_cash_fare, program_id, target_points, cabin, trip_type } = req.body;
  
  if (!departure || typeof departure !== 'string' || !departure.trim()) {
    return res.status(400).json({ error: 'Departure airport code is required' });
  }
  if (!destination || typeof destination !== 'string' || !destination.trim()) {
    return res.status(400).json({ error: 'Destination airport code is required' });
  }

  const numTargetPoints = Number(target_points) || 0;
  if (numTargetPoints < 0 || numTargetPoints > 100_000_000) {
    return res.status(400).json({ error: 'Target points must be between 0 and 100,000,000' });
  }
  const numCashFare = estimated_cash_fare !== undefined && estimated_cash_fare !== null && estimated_cash_fare !== '' 
    ? Number(estimated_cash_fare) 
    : null;
  if (numCashFare !== null && (isNaN(numCashFare) || numCashFare < 0 || numCashFare > 100_000_000)) {
    return res.status(400).json({ error: 'Estimated cash fare must be a valid positive amount' });
  }

  const { data, error } = await (req as any).supabase
    .from('travel_goals')
    .insert([{
      user_id: userId,
      departure: departure.trim().toUpperCase(),
      destination: destination.trim().toUpperCase(),
      departure_date: departure_date || null,
      return_date: return_date || null,
      estimated_cash_fare: numCashFare,
      program_id: program_id ? String(program_id).trim() : null,
      target_points: numTargetPoints,
      cabin: cabin || 'ECONOMY',
      trip_type: trip_type || 'ONE_WAY'
    }])
    .select()
    .single();
    
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

app.delete('/api/travel-goals/:id', authMiddleware, async (req, res) => {
  const userId = (req as any).user.id;
  const { id } = req.params;

  const { error, count } = await (req as any).supabase
    .from('travel_goals')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) return res.status(500).json({ error: error.message });
  if (count === 0) return res.status(404).json({ error: 'Travel goal not found or unauthorized' });
  res.json({ success: true, count });
});

// --- BRAND REGISTRATION TRACKER ---
const VALID_REG_STATUSES = ['REGISTERED', 'PENDING', 'NOT_REGISTERED', 'EXPIRED'];
const VALID_IDENTIFIER_TYPES = ['EMAIL', 'PHONE', 'OTHER'];

function maskEmailServer(email: string): string {
  if (!email) return '';
  const trimmed = email.trim();
  if (trimmed.includes('***')) return trimmed;
  const parts = trimmed.split('@');
  if (parts.length !== 2) return trimmed;
  const [local, domain] = parts;
  if (!local || !domain) return trimmed;
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

function maskPhoneServer(phone: string): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  if (trimmed.includes('***')) return trimmed;
  const clean = trimmed.replace(/\D/g, '');
  if (clean.length < 7) return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`;
  const prefix = trimmed.startsWith('+91') || trimmed.startsWith('+') ? trimmed.split(' ')[0] + ' ' : '';
  const local = clean.slice(-10);
  return `${prefix}${local.slice(0, 2)}*** **${local.slice(-3)}`;
}

function maskIdentifierServer(raw: string, type: string): string {
  if (!raw) return '';
  if (type === 'EMAIL') return maskEmailServer(raw);
  if (type === 'PHONE') return maskPhoneServer(raw);
  const trimmed = raw.trim();
  if (trimmed.length > 20) return `${trimmed.slice(0, 4)}***${trimmed.slice(-3)}`;
  return trimmed;
}

app.get('/api/brand-registrations', authMiddleware, async (req, res) => {
  const userId = (req as any).user.id;
  try {
    const { data, error } = await (req as any).supabase
      .from('brand_registrations')
      .select('*, user_cards(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.json([]);
    }
    res.json(data || []);
  } catch {
    res.json([]);
  }
});

app.post('/api/brand-registrations', authMiddleware, async (req, res) => {
  const userId = (req as any).user.id;
  const {
    user_card_id,
    brand_name,
    campaign_name,
    identifier_type = 'EMAIL',
    raw_identifier,
    masked_identifier: clientMasked,
    status = 'PENDING',
    registration_date,
    portal_url,
    multiplier_benefit,
    valid_until,
    notes,
  } = req.body;

  // Validation: Brand name
  if (!brand_name || typeof brand_name !== 'string' || !brand_name.trim()) {
    return res.status(400).json({ error: 'Brand name is required' });
  }
  const trimmedBrand = brand_name.trim();

  // Validation: Status
  const normalizedStatus = String(status).toUpperCase().trim();
  if (!VALID_REG_STATUSES.includes(normalizedStatus)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_REG_STATUSES.join(', ')}` });
  }

  // Validation: Identifier type
  const normalizedType = String(identifier_type).toUpperCase().trim();
  if (!VALID_IDENTIFIER_TYPES.includes(normalizedType)) {
    return res.status(400).json({ error: `Invalid identifier type. Must be one of: ${VALID_IDENTIFIER_TYPES.join(', ')}` });
  }

  // Secure Masking: Validate input format and compute masked identifier
  let finalMasked: string | null = null;
  if (raw_identifier && typeof raw_identifier === 'string' && raw_identifier.trim()) {
    const rawVal = raw_identifier.trim();
    if (normalizedType === 'EMAIL') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!rawVal.includes('***') && !emailRegex.test(rawVal)) {
        return res.status(400).json({ error: 'Invalid email address format' });
      }
    } else if (normalizedType === 'PHONE') {
      const digits = rawVal.replace(/\D/g, '');
      if (!rawVal.includes('***') && (digits.length < 7 || digits.length > 15)) {
        return res.status(400).json({ error: 'Invalid phone number format (must contain 7 to 15 digits)' });
      }
    }
    finalMasked = maskIdentifierServer(rawVal, normalizedType);
  } else if (clientMasked && typeof clientMasked === 'string' && clientMasked.trim()) {
    finalMasked = maskIdentifierServer(clientMasked.trim(), normalizedType);
  }

  // IDOR defense: Verify card ownership if user_card_id provided
  if (user_card_id) {
    const isOwner = await verifyUserCardOwnership((req as any).supabase, userId, user_card_id);
    if (!isOwner) {
      return res.status(403).json({ error: 'Card not found or does not belong to the authenticated user' });
    }
  }

  try {
    // Duplicate prevention: check if user already has an active registration for this brand
    const { data: existingBrand } = await (req as any).supabase
      .from('brand_registrations')
      .select('id, brand_name')
      .eq('user_id', userId)
      .ilike('brand_name', trimmedBrand);

    if (existingBrand && existingBrand.length > 0) {
      return res.status(409).json({
        error: `A registration for "${trimmedBrand}" already exists. You can edit the existing registration.`
      });
    }

    const { data, error } = await (req as any).supabase
      .from('brand_registrations')
      .insert([{
        user_id: userId,
        user_card_id: user_card_id || null,
        brand_name: trimmedBrand,
        campaign_name: campaign_name ? String(campaign_name).trim() : null,
        identifier_type: normalizedType,
        masked_identifier: finalMasked,
        status: normalizedStatus,
        registration_date: registration_date || new Date().toISOString().split('T')[0],
        portal_url: portal_url ? String(portal_url).trim() : null,
        multiplier_benefit: multiplier_benefit ? String(multiplier_benefit).trim() : null,
        valid_until: valid_until || null,
        notes: notes ? String(notes).trim().slice(0, 500) : null,
        updated_at: new Date().toISOString()
      }])
      .select('*, user_cards(*)')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/brand-registrations/:id', authMiddleware, async (req, res) => {
  const userId = (req as any).user.id;
  const { id } = req.params;
  const {
    brand_name,
    campaign_name,
    identifier_type,
    raw_identifier,
    masked_identifier: clientMasked,
    status,
    registration_date,
    portal_url,
    multiplier_benefit,
    valid_until,
    notes,
    user_card_id,
  } = req.body;

  const updatePayload: any = {
    updated_at: new Date().toISOString(),
  };

  if (brand_name !== undefined) {
    const trimmedBrand = String(brand_name).trim();
    if (!trimmedBrand) return res.status(400).json({ error: 'Brand name cannot be empty' });

    // Ensure update does not conflict with another existing brand entry for this user
    const { data: existingBrand } = await (req as any).supabase
      .from('brand_registrations')
      .select('id')
      .eq('user_id', userId)
      .ilike('brand_name', trimmedBrand)
      .neq('id', id);

    if (existingBrand && existingBrand.length > 0) {
      return res.status(409).json({ error: `Another registration for "${trimmedBrand}" already exists.` });
    }
    updatePayload.brand_name = trimmedBrand;
  }

  if (campaign_name !== undefined) updatePayload.campaign_name = campaign_name ? String(campaign_name).trim() : null;

  if (status !== undefined) {
    const normalizedStatus = String(status).toUpperCase().trim();
    if (!VALID_REG_STATUSES.includes(normalizedStatus)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${VALID_REG_STATUSES.join(', ')}` });
    }
    updatePayload.status = normalizedStatus;
  }

  const typeToUse = identifier_type ? String(identifier_type).toUpperCase().trim() : 'EMAIL';
  if (identifier_type !== undefined) {
    if (!VALID_IDENTIFIER_TYPES.includes(typeToUse)) {
      return res.status(400).json({ error: `Invalid identifier type. Must be one of: ${VALID_IDENTIFIER_TYPES.join(', ')}` });
    }
    updatePayload.identifier_type = typeToUse;
  }

  if (raw_identifier !== undefined) {
    if (raw_identifier && typeof raw_identifier === 'string' && raw_identifier.trim()) {
      const rawVal = raw_identifier.trim();
      if (typeToUse === 'EMAIL') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!rawVal.includes('***') && !emailRegex.test(rawVal)) {
          return res.status(400).json({ error: 'Invalid email address format' });
        }
      } else if (typeToUse === 'PHONE') {
        const digits = rawVal.replace(/\D/g, '');
        if (!rawVal.includes('***') && (digits.length < 7 || digits.length > 15)) {
          return res.status(400).json({ error: 'Invalid phone number format (must contain 7 to 15 digits)' });
        }
      }
      updatePayload.masked_identifier = maskIdentifierServer(rawVal, typeToUse);
    } else {
      updatePayload.masked_identifier = null;
    }
  } else if (clientMasked !== undefined) {
    updatePayload.masked_identifier = clientMasked ? maskIdentifierServer(String(clientMasked).trim(), typeToUse) : null;
  }

  if (registration_date !== undefined) updatePayload.registration_date = registration_date || null;
  if (portal_url !== undefined) updatePayload.portal_url = portal_url ? String(portal_url).trim() : null;
  if (multiplier_benefit !== undefined) updatePayload.multiplier_benefit = multiplier_benefit ? String(multiplier_benefit).trim() : null;
  if (valid_until !== undefined) updatePayload.valid_until = valid_until || null;
  if (notes !== undefined) updatePayload.notes = notes ? String(notes).trim().slice(0, 500) : null;
  if (user_card_id !== undefined) {
    if (user_card_id) {
      const isOwner = await verifyUserCardOwnership((req as any).supabase, userId, user_card_id);
      if (!isOwner) {
        return res.status(403).json({ error: 'Card not found or does not belong to the authenticated user' });
      }
    }
    updatePayload.user_card_id = user_card_id || null;
  }

  try {
    const { data, error } = await (req as any).supabase
      .from('brand_registrations')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', userId)
      .select('*, user_cards(*)')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Registration not found or unauthorized' });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/brand-registrations/:id', authMiddleware, async (req, res) => {
  const userId = (req as any).user.id;
  const { id } = req.params;

  try {
    const { error, count } = await (req as any).supabase
      .from('brand_registrations')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) return res.status(500).json({ error: error.message });
    if (count === 0) return res.status(404).json({ error: 'Registration not found or unauthorized' });
    res.json({ success: true, count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- OFFER REDEMPTION & SAVINGS TRACKING ---
const VALID_OFFER_STATUSES = [
  'AVAILABLE',
  'SAVED',
  'APPLIED',
  'REDEEMED',
  'PENDING_CASHBACK',
  'EXPIRED',
  'NOT_REDEEMED',
];

const VALID_CASHBACK_STATUSES = [
  'NOT_APPLICABLE',
  'PENDING',
  'RECEIVED',
  'FAILED',
];

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  AVAILABLE: ['SAVED', 'APPLIED', 'EXPIRED'],
  SAVED: ['AVAILABLE', 'APPLIED', 'NOT_REDEEMED', 'EXPIRED'],
  APPLIED: ['REDEEMED', 'PENDING_CASHBACK', 'NOT_REDEEMED', 'EXPIRED'],
  PENDING_CASHBACK: ['REDEEMED', 'NOT_REDEEMED', 'EXPIRED'],
  REDEEMED: ['REDEEMED'], // Terminal confirmed state
  NOT_REDEEMED: ['NOT_REDEEMED', 'APPLIED'],
  EXPIRED: ['EXPIRED'],
};

app.get('/api/offer-redemptions', authMiddleware, async (req, res) => {
  const userId = (req as any).user.id;
  const { status, offer_id, transaction_id } = req.query;

  try {
    let query = (req as any).supabase
      .from('offer_redemptions')
      .select('*, user_cards(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (status && typeof status === 'string') {
      query = query.eq('status', status.toUpperCase());
    }
    if (offer_id && typeof offer_id === 'string') {
      query = query.eq('offer_id', offer_id);
    }
    if (transaction_id && typeof transaction_id === 'string') {
      query = query.eq('transaction_id', transaction_id);
    }

    const { data, error } = await query;
    if (error) {
      return res.json([]);
    }
    res.json(data || []);
  } catch {
    res.json([]);
  }
});

app.post('/api/offer-redemptions', authMiddleware, async (req, res) => {
  const userId = (req as any).user.id;
  const {
    offer_id,
    transaction_id,
    user_card_id,
    card_id,
    merchant_name,
    transaction_amount = 0,
    status = 'SAVED',
    estimated_discount = 0,
    confirmed_discount = 0,
    estimated_cashback = 0,
    confirmed_cashback = 0,
    estimated_reward_points = 0,
    confirmed_reward_points = 0,
    cashback_status = 'NOT_APPLICABLE',
    redemption_date,
    confirmation_date,
    notes,
  } = req.body;

  if (!offer_id || typeof offer_id !== 'string' || !offer_id.trim()) {
    return res.status(400).json({ error: 'offer_id is required' });
  }
  if (!merchant_name || typeof merchant_name !== 'string' || !merchant_name.trim()) {
    return res.status(400).json({ error: 'merchant_name is required' });
  }

  const normalizedStatus = String(status).toUpperCase().trim();
  if (!VALID_OFFER_STATUSES.includes(normalizedStatus)) {
    return res.status(400).json({
      error: `Invalid status. Must be one of: ${VALID_OFFER_STATUSES.join(', ')}`
    });
  }

  const normalizedCashbackStatus = String(cashback_status).toUpperCase().trim();
  if (!VALID_CASHBACK_STATUSES.includes(normalizedCashbackStatus)) {
    return res.status(400).json({
      error: `Invalid cashback_status. Must be one of: ${VALID_CASHBACK_STATUSES.join(', ')}`
    });
  }

  const numTxnAmount = Math.max(0, Number(transaction_amount) || 0);
  const numEstDisc = Math.max(0, Number(estimated_discount) || 0);
  const numConfDisc = Math.max(0, Number(confirmed_discount) || 0);
  const numEstCb = Math.max(0, Number(estimated_cashback) || 0);
  const numConfCb = Math.max(0, Number(confirmed_cashback) || 0);
  const numEstPts = Math.max(0, Number(estimated_reward_points) || 0);
  const numConfPts = Math.max(0, Number(confirmed_reward_points) || 0);

  // IDOR defense: Verify card and transaction ownership
  if (user_card_id) {
    const isCardOwner = await verifyUserCardOwnership((req as any).supabase, userId, user_card_id);
    if (!isCardOwner) {
      return res.status(403).json({ error: 'Card not found or does not belong to the authenticated user' });
    }
  }
  if (transaction_id) {
    const isTxnOwner = await verifyTransactionOwnership((req as any).supabase, userId, transaction_id);
    if (!isTxnOwner) {
      return res.status(403).json({ error: 'Transaction not found or does not belong to the authenticated user' });
    }
  }

  try {
    if (transaction_id) {
      const { data: existingTxnRedemption } = await (req as any).supabase
        .from('offer_redemptions')
        .select('id')
        .eq('user_id', userId)
        .eq('transaction_id', transaction_id)
        .eq('offer_id', offer_id.trim());

      if (existingTxnRedemption && existingTxnRedemption.length > 0) {
        return res.status(409).json({
          error: 'This offer is already linked to this transaction.'
        });
      }
    } else if (normalizedStatus === 'SAVED') {
      const { data: existingSaved } = await (req as any).supabase
        .from('offer_redemptions')
        .select('id')
        .eq('user_id', userId)
        .eq('offer_id', offer_id.trim())
        .eq('status', 'SAVED');

      if (existingSaved && existingSaved.length > 0) {
        return res.status(409).json({
          error: 'You have already saved this offer.'
        });
      }
    }

    let finalConfDate = confirmation_date || null;
    if (normalizedStatus === 'REDEEMED' && !finalConfDate) {
      finalConfDate = new Date().toISOString().split('T')[0];
    }

    const { data, error } = await (req as any).supabase
      .from('offer_redemptions')
      .insert([{
        user_id: userId,
        offer_id: offer_id.trim(),
        transaction_id: transaction_id || null,
        user_card_id: user_card_id || null,
        card_id: card_id ? String(card_id).trim() : null,
        merchant_name: merchant_name.trim(),
        transaction_amount: numTxnAmount,
        status: normalizedStatus,
        estimated_discount: numEstDisc,
        confirmed_discount: numConfDisc,
        estimated_cashback: numEstCb,
        confirmed_cashback: numConfCb,
        estimated_reward_points: numEstPts,
        confirmed_reward_points: numConfPts,
        cashback_status: normalizedCashbackStatus,
        redemption_date: redemption_date || new Date().toISOString().split('T')[0],
        confirmation_date: finalConfDate,
        notes: notes ? String(notes).trim().slice(0, 500) : null,
        updated_at: new Date().toISOString(),
      }])
      .select('*, user_cards(*)')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/offer-redemptions/:id', authMiddleware, async (req, res) => {
  const userId = (req as any).user.id;
  const { id } = req.params;

  try {
    const { data: existing, error: fetchErr } = await (req as any).supabase
      .from('offer_redemptions')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchErr || !existing) {
      return res.status(404).json({ error: 'Offer redemption record not found or unauthorized.' });
    }

    const {
      status,
      transaction_id,
      user_card_id,
      card_id,
      merchant_name,
      transaction_amount,
      estimated_discount,
      confirmed_discount,
      estimated_cashback,
      confirmed_cashback,
      estimated_reward_points,
      confirmed_reward_points,
      cashback_status,
      redemption_date,
      confirmation_date,
      notes,
    } = req.body;

    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    };

    if (status !== undefined) {
      const normalizedStatus = String(status).toUpperCase().trim();
      if (!VALID_OFFER_STATUSES.includes(normalizedStatus)) {
        return res.status(400).json({
          error: `Invalid status. Must be one of: ${VALID_OFFER_STATUSES.join(', ')}`
        });
      }

      if (normalizedStatus !== existing.status) {
        const allowedTransitions = VALID_STATUS_TRANSITIONS[existing.status] || [];
        if (!allowedTransitions.includes(normalizedStatus)) {
          return res.status(400).json({
            error: `Invalid transition from "${existing.status}" to "${normalizedStatus}". Allowed transitions: ${allowedTransitions.join(', ') || 'none'}.`
          });
        }
      }

      updatePayload.status = normalizedStatus;

      if (normalizedStatus === 'REDEEMED' && !confirmation_date && !existing.confirmation_date) {
        updatePayload.confirmation_date = new Date().toISOString().split('T')[0];
      }

      if (normalizedStatus === 'PENDING_CASHBACK' && cashback_status === undefined && existing.cashback_status === 'NOT_APPLICABLE') {
        updatePayload.cashback_status = 'PENDING';
      }
    }

    if (cashback_status !== undefined) {
      const normCb = String(cashback_status).toUpperCase().trim();
      if (!VALID_CASHBACK_STATUSES.includes(normCb)) {
        return res.status(400).json({
          error: `Invalid cashback_status. Must be one of: ${VALID_CASHBACK_STATUSES.join(', ')}`
        });
      }
      updatePayload.cashback_status = normCb;
    }

    if (transaction_amount !== undefined) updatePayload.transaction_amount = Math.max(0, Number(transaction_amount) || 0);
    if (estimated_discount !== undefined) updatePayload.estimated_discount = Math.max(0, Number(estimated_discount) || 0);
    if (confirmed_discount !== undefined) updatePayload.confirmed_discount = Math.max(0, Number(confirmed_discount) || 0);
    if (estimated_cashback !== undefined) updatePayload.estimated_cashback = Math.max(0, Number(estimated_cashback) || 0);
    if (confirmed_cashback !== undefined) updatePayload.confirmed_cashback = Math.max(0, Number(confirmed_cashback) || 0);
    if (estimated_reward_points !== undefined) updatePayload.estimated_reward_points = Math.max(0, Number(estimated_reward_points) || 0);
    if (confirmed_reward_points !== undefined) updatePayload.confirmed_reward_points = Math.max(0, Number(confirmed_reward_points) || 0);

    if (transaction_id !== undefined) {
      if (transaction_id) {
        const isTxnOwner = await verifyTransactionOwnership((req as any).supabase, userId, transaction_id);
        if (!isTxnOwner) {
          return res.status(403).json({ error: 'Transaction not found or does not belong to the authenticated user' });
        }
      }
      updatePayload.transaction_id = transaction_id || null;
    }
    if (user_card_id !== undefined) {
      if (user_card_id) {
        const isOwner = await verifyUserCardOwnership((req as any).supabase, userId, user_card_id);
        if (!isOwner) {
          return res.status(403).json({ error: 'Card not found or does not belong to the authenticated user' });
        }
      }
      updatePayload.user_card_id = user_card_id || null;
    }
    if (card_id !== undefined) updatePayload.card_id = card_id ? String(card_id).trim() : null;
    if (merchant_name !== undefined) updatePayload.merchant_name = String(merchant_name).trim();
    if (redemption_date !== undefined) updatePayload.redemption_date = redemption_date || null;
    if (confirmation_date !== undefined) updatePayload.confirmation_date = confirmation_date || null;
    if (notes !== undefined) updatePayload.notes = notes ? String(notes).trim().slice(0, 500) : null;

    const { data, error } = await (req as any).supabase
      .from('offer_redemptions')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', userId)
      .select('*, user_cards(*)')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/offer-redemptions/:id', authMiddleware, async (req, res) => {
  const userId = (req as any).user.id;
  const { id } = req.params;

  try {
    const { error, count } = await (req as any).supabase
      .from('offer_redemptions')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) return res.status(500).json({ error: error.message });
    if (count === 0) return res.status(404).json({ error: 'Offer redemption record not found or unauthorized' });
    res.json({ success: true, count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- RECOMMENDATION ENGINE ---
app.post('/api/recommendations', authMiddleware, async (req, res) => {
  const userId = (req as any).user.id;
  const { amount, category } = req.body;
  
  try {
    const { data: userCards } = await (req as any).supabase
      .from('user_cards')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (!userCards || userCards.length === 0) {
      return res.json({ recommended: null });
    }

    const numAmount = Number(amount) || 1000;
    const bestCard = userCards[0];
    const estimatedReturn = Math.floor(numAmount * 0.04);

    res.json({
      recommended: {
        userCardId: bestCard.id,
        bank: bestCard.custom_bank || 'Primary Card',
        cardName: bestCard.custom_card_name || 'Rewards Card',
        expectedReward: estimatedReturn,
        rewardType: 'Points',
      },
      alternatives: userCards.slice(1).map((c: any) => ({
        userCardId: c.id,
        bank: c.custom_bank || 'Bank',
        cardName: c.custom_card_name || 'Card',
      })),
      explanation: `Provides optimized returns for ${category || 'general'} purchases based on your active cards.`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// --- PYTHON ANALYTICS PROXY WITH NODE FALLBACK ---
app.post('/api/analytics/summary', authMiddleware, async (req, res) => {
  const userId = (req as any).user.id;
  let txns: any[] = req.body?.transactions;

  try {
    // If client did not provide transactions, fetch the authenticated user's actual transactions
    if (!txns || !Array.isArray(txns) || txns.length === 0) {
      const { data: dbTxns } = await (req as any).supabase
        .from('transactions')
        .select('amount, category_id, date, merchant, user_cards(*)')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      txns = (dbTxns || []).map((t: any) => ({
        amount: Number(t.amount) || 0,
        category: t.category_id || 'General',
        date: t.date || new Date().toISOString().split('T')[0],
        card: t.user_cards?.credit_cards?.name || t.user_cards?.custom_card_name || 'Card',
        merchant: t.merchant || 'Other',
      }));
    }

    // 1. Attempt proxying to Python FastAPI + Pandas service
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);

      const response = await fetch('http://localhost:8000/api/analytics/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: txns }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        return res.json({ ...data, source: 'fastapi' });
      }
    } catch {
      // Python service offline or timed out; execute Node fallback
    }

    // 2. Node Fallback Aggregation Engine
    if (txns.length === 0) {
      return res.json({
        total_spend: 0,
        transaction_count: 0,
        average_spend: 0,
        category_breakdown: {},
        card_breakdown: {},
        merchant_breakdown: [],
        monthly_trend: [],
        weekly_trend: [],
        day_of_week_breakdown: {},
        source: 'node_fallback'
      });
    }

    let total_spend = 0;
    const category_breakdown: Record<string, number> = {};
    const card_breakdown: Record<string, number> = {};
    const merchantMap = new Map<string, { total_amount: number; count: number }>();
    const monthMap = new Map<string, { amount: number; count: number }>();
    const dayMap: Record<string, number> = {};

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (const t of txns) {
      const amt = Number(t.amount) || 0;
      total_spend += amt;

      const cat = t.category || 'General';
      category_breakdown[cat] = Number(((category_breakdown[cat] || 0) + amt).toFixed(2));

      const card = t.card || 'Unspecified';
      card_breakdown[card] = Number(((card_breakdown[card] || 0) + amt).toFixed(2));

      const merch = (t.merchant || 'Other').trim();
      const curMerch = merchantMap.get(merch) || { total_amount: 0, count: 0 };
      curMerch.total_amount += amt;
      curMerch.count += 1;
      merchantMap.set(merch, curMerch);

      if (t.date) {
        const d = new Date(t.date);
        if (!isNaN(d.getTime())) {
          const monthKey = t.date.slice(0, 7); // YYYY-MM
          const curMonth = monthMap.get(monthKey) || { amount: 0, count: 0 };
          curMonth.amount += amt;
          curMonth.count += 1;
          monthMap.set(monthKey, curMonth);

          const dayName = dayNames[d.getDay()];
          if (dayName) {
            dayMap[dayName] = Number(((dayMap[dayName] || 0) + amt).toFixed(2));
          }
        }
      }
    }

    const transaction_count = txns.length;
    const average_spend = transaction_count > 0 ? Number((total_spend / transaction_count).toFixed(2)) : 0;

    const merchant_breakdown = Array.from(merchantMap.entries())
      .map(([merchant, data]) => ({
        merchant,
        total_amount: Number(data.total_amount.toFixed(2)),
        count: data.count,
        avg_amount: Number((data.total_amount / data.count).toFixed(2)),
      }))
      .sort((a, b) => b.total_amount - a.total_amount)
      .slice(0, 10);

    const monthly_trend = Array.from(monthMap.entries())
      .map(([month, data]) => ({
        month,
        amount: Number(data.amount.toFixed(2)),
        count: data.count,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    res.json({
      total_spend: Number(total_spend.toFixed(2)),
      transaction_count,
      average_spend,
      category_breakdown,
      card_breakdown,
      merchant_breakdown,
      monthly_trend,
      weekly_trend: [],
      day_of_week_breakdown: dayMap,
      source: 'node_fallback'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Centralized Unhandled Error & Payload Limit Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request payload too large. Limit is 1MB.' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`CardIO Server running on port ${port}`);
});
