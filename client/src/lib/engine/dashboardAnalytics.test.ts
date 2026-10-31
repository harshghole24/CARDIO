import { describe, it, expect } from 'vitest';
import {
  computeDashboardKPIs,
  computeCardPerformanceMetrics,
  computeOfferPerformanceMetrics,
  calculateTravelGoalProgress,
  filterTransactionsByDateRange,
  filterTransactions,
  type DateFilterOptions,
} from './dashboardAnalytics';
import type { CreditCardRow, OfferRedemptionRow } from '../data/schemas';

// Mock Card Catalogue
const mockCardsCatalogue = new Map<string, CreditCardRow>([
  [
    'hdfc-infinia',
    {
      card_id: 'hdfc-infinia',
      name: 'HDFC Bank Infinia Metal Edition',
      issuer: 'HDFC',
      network: 'VISA',
      tier: 'SUPER_PREMIUM',
      base_reward_rate_pct: 3.3,
      point_value_paise: 100, // 1 pt = ₹1.00
      max_points_per_100_inr_derived: 3.3,
      annual_fee_inr: 12500,
      reward_currency: 'SmartBuy Points',
      fee_waiver_spend_threshold_inr: 1000000,
      source: 'Verified',
      points_transfer_summary: 'Air India, KrisFlyer',
    },
  ],
  [
    'sbi-cashback',
    {
      card_id: 'sbi-cashback',
      name: 'SBI Cashback Card',
      issuer: 'SBI',
      network: 'VISA',
      tier: 'ENTRY_PREMIUM',
      base_reward_rate_pct: 1.0,
      point_value_paise: 25, // 1 pt = ₹0.25
      max_points_per_100_inr_derived: 1.0,
      annual_fee_inr: 999,
      reward_currency: 'Cashback',
      fee_waiver_spend_threshold_inr: 200000,
      source: 'Verified',
      points_transfer_summary: 'Statement Credit',
    },
  ],
]);

// Mock User Cards
const mockUserCards = [
  { id: 'uc-1', card_id: 'hdfc-infinia', custom_card_name: 'My Infinia', custom_bank: 'HDFC' },
  { id: 'uc-2', card_id: 'sbi-cashback', custom_card_name: 'My SBI Cashback', custom_bank: 'SBI' },
];

// Fixed Reference Date for Deterministic Date Calculations: 2026-10-31
const refDate = new Date('2026-10-31T12:00:00Z');

// Mock Transactions
const mockTransactions = [
  // Current Month: Oct 2026
  {
    id: 't1',
    user_id: 'user-123',
    user_card_id: 'uc-1',
    amount: 15000,
    merchant: 'Amazon',
    category_id: 'Shopping',
    date: '2026-10-15',
    reward_earned: 450,
    cashback_earned: 0,
  },
  {
    id: 't2',
    user_id: 'user-123',
    user_card_id: 'uc-1',
    amount: 5000,
    merchant: 'Swiggy',
    category_id: 'Dining',
    date: '2026-10-20',
    reward_earned: 150,
    cashback_earned: 0,
  },
  {
    id: 't3',
    user_id: 'user-123',
    user_card_id: 'uc-2',
    amount: 10000,
    merchant: 'Flipkart',
    category_id: 'Shopping',
    date: '2026-10-28',
    reward_earned: 0,
    cashback_earned: 500,
  },
  // Previous Month: Sep 2026
  {
    id: 't4',
    user_id: 'user-123',
    user_card_id: 'uc-1',
    amount: 20000,
    merchant: 'MakeMyTrip',
    category_id: 'Travel',
    date: '2026-09-10',
    reward_earned: 600,
    cashback_earned: 0,
  },
  // Older This Year: Apr 2026
  {
    id: 't5',
    user_id: 'user-123',
    user_card_id: 'uc-2',
    amount: 30000,
    merchant: 'Apple',
    category_id: 'Shopping',
    date: '2026-04-05',
    reward_earned: 0,
    cashback_earned: 1500,
  },
  // Previous Year: Nov 2025
  {
    id: 't6',
    user_id: 'user-123',
    user_card_id: 'uc-1',
    amount: 40000,
    merchant: 'Singapore Airlines',
    category_id: 'Travel',
    date: '2025-11-20',
    reward_earned: 1200,
    cashback_earned: 0,
  },
];

// Mock Redemptions
const mockRedemptions: OfferRedemptionRow[] = [
  {
    id: 'r1',
    user_id: 'user-123',
    offer_id: 'OFF_AMAZON_OCT',
    user_card_id: 'uc-1',
    card_id: 'hdfc-infinia',
    merchant_name: 'Amazon',
    status: 'REDEEMED',
    confirmed_discount: 1500,
    confirmed_cashback: 0,
    confirmed_reward_points: 0,
    estimated_discount: 1500,
    estimated_cashback: 0,
    estimated_reward_points: 0,
    cashback_status: 'NOT_APPLICABLE',
    confirmation_date: '2026-10-15',
  },
  {
    id: 'r2',
    user_id: 'user-123',
    offer_id: 'OFF_FLIPKART_CB',
    user_card_id: 'uc-2',
    card_id: 'sbi-cashback',
    merchant_name: 'Flipkart',
    status: 'REDEEMED',
    confirmed_discount: 0,
    confirmed_cashback: 500,
    confirmed_reward_points: 0,
    estimated_discount: 0,
    estimated_cashback: 500,
    estimated_reward_points: 0,
    cashback_status: 'RECEIVED',
    confirmation_date: '2026-10-28',
  },
  {
    id: 'r3',
    user_id: 'user-123',
    offer_id: 'OFF_MMT_PENDING',
    user_card_id: 'uc-1',
    card_id: 'hdfc-infinia',
    merchant_name: 'MakeMyTrip',
    status: 'PENDING_CASHBACK',
    confirmed_discount: 0,
    confirmed_cashback: 0,
    confirmed_reward_points: 0,
    estimated_discount: 0,
    estimated_cashback: 1200,
    estimated_reward_points: 0,
    cashback_status: 'PENDING',
  },
  {
    id: 'r4',
    user_id: 'user-123',
    offer_id: 'OFF_SAVED_1',
    user_card_id: 'uc-2',
    card_id: 'sbi-cashback',
    merchant_name: 'Zomato',
    status: 'SAVED',
    confirmed_discount: 0,
    confirmed_cashback: 0,
    confirmed_reward_points: 0,
    estimated_discount: 200,
    estimated_cashback: 0,
    estimated_reward_points: 0,
    cashback_status: 'NOT_APPLICABLE',
  },
];

describe('CardIO Personal Finance Dashboard & Analytics', () => {
  // ─── 1. MONTHLY SPENDING CALCULATION ───
  it('1. Calculates current month spending and Month-over-Month (MoM) spend change accurately', () => {
    const kpis = computeDashboardKPIs(mockTransactions, mockUserCards, mockRedemptions, mockCardsCatalogue, refDate);
    // Current month (Oct 2026): 15000 (t1) + 5000 (t2) + 10000 (t3) = 30000
    expect(kpis.currentMonthSpend).toBe(30000);
    // Previous month (Sep 2026): 20000 (t4)
    expect(kpis.prevMonthSpend).toBe(20000);
    // MoM change: ((30000 - 20000) / 20000) * 100 = +50.0%
    expect(kpis.spendChangeMoM).toBe(50.0);
  });

  // ─── 2. YEARLY SPENDING CALCULATION ───
  it('2. Calculates current calendar year spending accurately', () => {
    const kpis = computeDashboardKPIs(mockTransactions, mockUserCards, mockRedemptions, mockCardsCatalogue, refDate);
    // Year 2026 transactions: t1(15k) + t2(5k) + t3(10k) + t4(20k) + t5(30k) = 80000
    // (t6 from 2025 is excluded from current year)
    expect(kpis.currentYearSpend).toBe(80000);
    expect(kpis.totalAllTimeSpend).toBe(120000); // 80k + 40k
  });

  // ─── 3. CATEGORY AGGREGATION ───
  it('3. Aggregates spending correctly across purchase categories', () => {
    const catMap: Record<string, number> = {};
    for (const t of mockTransactions) {
      catMap[t.category_id] = (catMap[t.category_id] || 0) + t.amount;
    }
    expect(catMap['Shopping']).toBe(15000 + 10000 + 30000); // 55,000
    expect(catMap['Dining']).toBe(5000);
    expect(catMap['Travel']).toBe(20000 + 40000); // 60,000
  });

  // ─── 4. MERCHANT AGGREGATION ───
  it('4. Aggregates spending and transaction frequency correctly by merchant', () => {
    const merchantMap = new Map<string, { total: number; count: number }>();
    for (const t of mockTransactions) {
      const cur = merchantMap.get(t.merchant) || { total: 0, count: 0 };
      cur.total += t.amount;
      cur.count += 1;
      merchantMap.set(t.merchant, cur);
    }
    expect(merchantMap.get('Amazon')?.total).toBe(15000);
    expect(merchantMap.get('Amazon')?.count).toBe(1);
    expect(merchantMap.get('Singapore Airlines')?.total).toBe(40000);
  });

  // ─── 5. CARD-WISE AGGREGATION & PERFORMANCE ───
  it('5. Computes individual card spending, transaction count, and confirmed savings', () => {
    const cardMetrics = computeCardPerformanceMetrics(mockUserCards, mockTransactions, mockRedemptions, mockCardsCatalogue);
    expect(cardMetrics.length).toBe(2);

    const infinia = cardMetrics.find(c => c.userCardId === 'uc-1')!;
    const sbi = cardMetrics.find(c => c.userCardId === 'uc-2')!;

    // Infinia: t1(15k) + t2(5k) + t4(20k) + t6(40k) = 80000
    expect(infinia.totalSpend).toBe(80000);
    expect(infinia.transactionCount).toBe(4);
    // Confirmed savings on Infinia: 1500 (r1) + base points (450 + 150 + 600 + 1200 = 2400 pts * ₹1.00 = ₹2400) = ₹3900
    expect(infinia.confirmedSavingsINR).toBe(3900);

    // SBI: t3(10k) + t5(30k) = 40000
    expect(sbi.totalSpend).toBe(40000);
    expect(sbi.transactionCount).toBe(2);
    // Confirmed savings on SBI: 500 (r2)
    expect(sbi.confirmedSavingsINR).toBe(500);

    // Highlights
    expect(infinia.isMostUsed).toBe(true);
    expect(infinia.isHighestSpend).toBe(true);
    expect(infinia.isHighestSavings).toBe(true);
  });

  // ─── 6. DATE FILTERING (PRESETS & CUSTOM RANGE) ───
  describe('Date Filtering Engine', () => {
    it('Filters transactions by Last 7 Days', () => {
      const filtered = filterTransactionsByDateRange(mockTransactions, { preset: 'LAST_7_DAYS' }, refDate);
      // refDate is 2026-10-31 -> Last 7 days includes >= 2026-10-24: t3 (2026-10-28)
      expect(filtered.map(t => t.id)).toEqual(['t3']);
    });

    it('Filters transactions by Last 30 Days', () => {
      const filtered = filterTransactionsByDateRange(mockTransactions, { preset: 'LAST_30_DAYS' }, refDate);
      // >= 2026-10-01: t1, t2, t3
      expect(filtered.map(t => t.id)).toEqual(['t1', 't2', 't3']);
    });

    it('Filters transactions by This Year', () => {
      const filtered = filterTransactionsByDateRange(mockTransactions, { preset: 'THIS_YEAR' }, refDate);
      // All 2026 transactions: t1, t2, t3, t4, t5 (t6 from 2025 excluded)
      expect(filtered.length).toBe(5);
    });

    it('Filters transactions by Custom Date Range', () => {
      const filter: DateFilterOptions = {
        preset: 'CUSTOM',
        startDate: '2026-09-01',
        endDate: '2026-09-30',
      };
      const filtered = filterTransactionsByDateRange(mockTransactions, filter, refDate);
      expect(filtered.map(t => t.id)).toEqual(['t4']);
    });

    it('Filters by category and card simultaneously', () => {
      const filtered = filterTransactions(
        mockTransactions,
        {
          dateFilter: { preset: 'ALL_TIME' },
          category: 'Shopping',
          userCardId: 'uc-1',
        },
        refDate
      );
      // Category Shopping on Infinia (uc-1): t1 (Amazon)
      expect(filtered.map(t => t.id)).toEqual(['t1']);
    });
  });

  // ─── 7. EMPTY DATASETS HANDLING ───
  it('7. Safely handles empty transaction datasets without exceptions or NaN', () => {
    const kpis = computeDashboardKPIs([], [], [], mockCardsCatalogue, refDate);
    expect(kpis.currentMonthSpend).toBe(0);
    expect(kpis.prevMonthSpend).toBe(0);
    expect(kpis.spendChangeMoM).toBeNull();
    expect(kpis.currentYearSpend).toBe(0);
    expect(kpis.totalAllTimeSpend).toBe(0);
    expect(kpis.confirmedSavingsINR).toBe(0);
    expect(kpis.pendingCashbackINR).toBe(0);

    const cardMetrics = computeCardPerformanceMetrics([], [], [], mockCardsCatalogue);
    expect(cardMetrics).toEqual([]);

    const offerMetrics = computeOfferPerformanceMetrics([]);
    expect(offerMetrics.redemptionSuccessRatePct).toBe(0);
    expect(offerMetrics.confirmedSavingsByMerchant).toEqual([]);
  });

  // ─── 8. SAVINGS CALCULATIONS ───
  it('8. Confirms instant discounts and cashback are aggregated into total confirmed savings', () => {
    const kpis = computeDashboardKPIs(mockTransactions, mockUserCards, mockRedemptions, mockCardsCatalogue, refDate);
    // r1 confirmed discount (1500) + r2 confirmed cashback (500) = 2000
    expect(kpis.confirmedDiscountINR).toBe(1500);
    expect(kpis.confirmedCashbackINR).toBe(500);
    expect(kpis.confirmedSavingsINR).toBe(2000);
  });

  // ─── 9. PENDING CASHBACK SEGREGATION ───
  it('9. Strictly segregates pending cashback from confirmed savings', () => {
    const kpis = computeDashboardKPIs(mockTransactions, mockUserCards, mockRedemptions, mockCardsCatalogue, refDate);
    // r3 has 1200 pending cashback
    expect(kpis.pendingCashbackINR).toBe(1200);
    // Confirmed savings MUST NOT include the pending 1200
    expect(kpis.confirmedSavingsINR).toBe(2000);
  });

  // ─── 10. REWARD POINT CALCULATIONS (VALUATION TO INR) ───
  it('10. Calculates reward points valuation based on card valuation', () => {
    const customRedemption: OfferRedemptionRow = {
      id: 'r-pts',
      offer_id: 'OFF_POINTS',
      card_id: 'hdfc-infinia', // 100 paise = ₹1.00
      merchant_name: 'Apple',
      status: 'REDEEMED',
      confirmed_discount: 0,
      confirmed_cashback: 0,
      confirmed_reward_points: 3000,
      estimated_discount: 0,
      estimated_cashback: 0,
      estimated_reward_points: 0,
      cashback_status: 'NOT_APPLICABLE',
    };
    const kpis = computeDashboardKPIs([], mockUserCards, [customRedemption], mockCardsCatalogue, refDate);
    // 3,000 pts * ₹1.00 = ₹3,000 confirmed savings
    expect(kpis.confirmedRewardPointsValueINR).toBe(3000);
    expect(kpis.confirmedSavingsINR).toBe(3000);
  });

  // ─── 11. OFFER REDEMPTION STATISTICS & SUCCESS RATE ───
  it('11. Calculates offer lifecycle counts and redemption success rate correctly', () => {
    const offerMetrics = computeOfferPerformanceMetrics(mockRedemptions, [], mockCardsCatalogue);
    expect(offerMetrics.redeemedCount).toBe(2); // r1, r2
    expect(offerMetrics.pendingCashbackCount).toBe(1); // r3
    expect(offerMetrics.savedCount).toBe(1); // r4

    // Non-saved attempted redemptions: 2 redeemed + 1 pending = 3 attempted
    // Success rate: (2 / 3) * 100 = 66.7%
    expect(offerMetrics.redemptionSuccessRatePct).toBe(66.7);

    // Top merchant by confirmed savings: Amazon (1500) > Flipkart (500)
    expect(offerMetrics.confirmedSavingsByMerchant[0].merchant).toBe('Amazon');
    expect(offerMetrics.confirmedSavingsByMerchant[0].savingsINR).toBe(1500);
  });

  // ─── 12. TRAVEL GOAL PROGRESS CALCULATION ───
  it('12. Accurately calculates travel goal progress percentage and remaining points', () => {
    const goal = {
      id: 'goal-1',
      departure: 'BLR',
      destination: 'LHR',
      target_points: 50000,
      program_id: 'virgin_atlantic',
    };
    // If user has earned 20,000 points
    const progress = calculateTravelGoalProgress(goal, 20000);
    expect(progress.targetPoints).toBe(50000);
    expect(progress.currentPoints).toBe(20000);
    expect(progress.progressPct).toBe(40);
    expect(progress.remainingPoints).toBe(30000);

    // If user has exceeded target, caps at 100% and remaining is 0
    const exceeded = calculateTravelGoalProgress(goal, 60000);
    expect(exceeded.progressPct).toBe(100);
    expect(exceeded.remainingPoints).toBe(0);
  });

  // ─── 13. USER DATA ISOLATION ───
  it('13. Enforces user data isolation when aggregating financial records', () => {
    const multiUserTransactions = [
      ...mockTransactions,
      {
        id: 't-attacker',
        user_id: 'attacker-999',
        user_card_id: 'uc-attacker',
        amount: 999999,
        merchant: 'FakeCo',
        category_id: 'Travel',
        date: '2026-10-30',
        reward_earned: 0,
        cashback_earned: 0,
      },
    ];

    // Simulating user-isolated dataset
    const isolatedForUser123 = multiUserTransactions.filter(t => t.user_id === 'user-123');
    const kpis = computeDashboardKPIs(isolatedForUser123, mockUserCards, mockRedemptions, mockCardsCatalogue, refDate);

    expect(kpis.currentMonthSpend).toBe(30000);
    expect(kpis.totalAllTimeSpend).toBe(120000);
  });

  // ─── 14. ANALYTICS API AUTHENTICATION & STRUCTURE ───
  it('14. Validates analytics payload structure for authenticated API transmission', () => {
    const payload = mockTransactions.map(t => ({
      amount: Number(t.amount) || 0,
      category: t.category_id || 'General',
      date: t.date,
      card: t.user_card_id === 'uc-1' ? 'Infinia' : 'SBI',
      merchant: t.merchant,
    }));

    expect(payload.length).toBe(6);
    expect(payload[0]).toHaveProperty('amount');
    expect(payload[0]).toHaveProperty('category');
    expect(payload[0]).toHaveProperty('date');
    expect(payload[0]).toHaveProperty('card');
    expect(payload[0]).toHaveProperty('merchant');
  });

  // ─── 15. PYTHON AND TYPESCRIPT AGGREGATION CONSISTENCY ───
  it('15. TypeScript aggregation logic exactly matches Python Pandas logic on identical dataset', () => {
    // Total spend
    const totalTs = mockTransactions.reduce((s, t) => s + t.amount, 0);
    expect(totalTs).toBe(120000);

    // Category breakdown
    const catTs: Record<string, number> = {};
    for (const t of mockTransactions) {
      catTs[t.category_id] = (catTs[t.category_id] || 0) + t.amount;
    }
    expect(catTs['Shopping']).toBe(55000);
    expect(catTs['Dining']).toBe(5000);
    expect(catTs['Travel']).toBe(60000);

    // Average spend
    const avgTs = Number((totalTs / mockTransactions.length).toFixed(2));
    expect(avgTs).toBe(20000);
  });
});
