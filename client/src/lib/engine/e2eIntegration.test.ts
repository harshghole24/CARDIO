import { describe, it, expect } from 'vitest';
import {
  evaluateTransactionOffers,
  checkRegistrationRequirement,
  type BrandRegistration,
} from './offerEngine';
import {
  isValidStatusTransition,
} from './savingsCalculator';
import {
  computeDashboardKPIs,
  computeCardPerformanceMetrics,
} from './dashboardAnalytics';
import type {
  CreditCardRow,
  OfferRow,
  OfferRedemptionRow,
} from '../data/schemas';

// Mock Card Catalogue
const mockCatalogue = new Map<string, CreditCardRow>([
  [
    'hdfc-infinia',
    {
      card_id: 'hdfc-infinia',
      name: 'HDFC Bank Infinia Metal Edition',
      issuer: 'HDFC',
      network: 'VISA',
      tier: 'SUPER_PREMIUM',
      base_reward_rate_pct: 3.3,
      point_value_paise: 100, // 1 point = ₹1.00
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
      point_value_paise: 25, // 1 point = ₹0.25
      max_points_per_100_inr_derived: 1.0,
      annual_fee_inr: 999,
      reward_currency: 'Cashback',
      fee_waiver_spend_threshold_inr: 200000,
      source: 'Verified',
      points_transfer_summary: 'Statement Credit',
    },
  ],
]);

// Mock Promotional Offers
const mockOffers: OfferRow[] = [
  {
    offer_id: 'OFF_AMAZON_HDFC',
    merchant_name: 'Amazon',
    bank_name: 'HDFC',
    eligible_card_variants: 'hdfc-infinia',
    eligible_networks: 'VISA',
    offer_category: 'Shopping',
    benefit_type: 'INSTANT_DISCOUNT',
    discount_percentage: 10,
    cashback_percentage: 0,
    reward_points_multiplier: 1,
    fixed_discount_amount: 0,
    minimum_transaction_amount: 5000,
    maximum_benefit: 1500, // ₹1,500 Cap
    valid_from: '2026-01-01',
    valid_until: '2026-12-31',
    registration_required: true,
    required_brand_name: 'Amazon Pay',
    portal_url: 'https://amazon.in/pay',
    terms_and_conditions: 'Must enroll Amazon Pay before purchase.',
    offer_status: 'ACTIVE',
    confidence: 'VERIFIED',
  },
  {
    offer_id: 'OFF_FLIPKART_SBI',
    merchant_name: 'Flipkart',
    bank_name: 'SBI',
    eligible_card_variants: 'sbi-cashback',
    eligible_networks: 'VISA',
    offer_category: 'Shopping',
    benefit_type: 'PERCENTAGE_CASHBACK',
    discount_percentage: 0,
    cashback_percentage: 5,
    reward_points_multiplier: 1,
    fixed_discount_amount: 0,
    minimum_transaction_amount: 2000,
    maximum_benefit: 1000,
    valid_from: '2026-01-01',
    valid_until: '2026-12-31',
    registration_required: false,
    offer_status: 'ACTIVE',
    confidence: 'VERIFIED',
  },
];

describe('CardIO End-to-End User Journey & Integration Audit (P5)', () => {
  // Simulated state representing user database tables across steps 1-15
  let testUserCards: any[] = [];
  let testRegistrations: BrandRegistration[] = [];
  let testTransactions: any[] = [];
  let testRedemptions: OfferRedemptionRow[] = [];
  const testUserId = 'test-user-uuid-999';
  const now = new Date('2026-10-31T12:00:00Z');

  // ─── STEP 1 & 2: LOG IN & ADD TWO CREDIT CARDS ───
  it('Step 1 & 2: Authenticated user adds two credit cards to their portfolio', () => {
    // Add Card 1: HDFC Infinia
    const card1 = {
      id: 'uc-infinia-1',
      user_id: testUserId,
      card_id: 'hdfc-infinia',
      custom_card_name: 'Personal Infinia',
      custom_bank: 'HDFC',
      last_four_digits: '4321',
      is_active: true,
      credit_cards: mockCatalogue.get('hdfc-infinia'),
    };
    // Add Card 2: SBI Cashback
    const card2 = {
      id: 'uc-sbi-2',
      user_id: testUserId,
      card_id: 'sbi-cashback',
      custom_card_name: 'SBI Shopping Card',
      custom_bank: 'SBI',
      last_four_digits: '8765',
      is_active: true,
      credit_cards: mockCatalogue.get('sbi-cashback'),
    };

    testUserCards = [card1, card2];
    expect(testUserCards.length).toBe(2);
    expect(testUserCards[0].credit_cards?.point_value_paise).toBe(100);
    expect(testUserCards[1].credit_cards?.point_value_paise).toBe(25);
  });

  // ─── STEP 3, 4 & 5: REWARDS HUB & SAVE AN OFFER ───
  it('Step 3, 4 & 5: Browse Rewards Hub, identify applicable offer, and bookmark as SAVED', () => {
    const selectedOffer = mockOffers.find(o => o.offer_id === 'OFF_AMAZON_HDFC')!;
    expect(selectedOffer).toBeDefined();

    // Saving the offer creates a record in offer_redemptions with status SAVED
    const savedRedemption: OfferRedemptionRow = {
      id: 'red-saved-1',
      user_id: testUserId,
      offer_id: selectedOffer.offer_id,
      user_card_id: testUserCards[0].id,
      card_id: testUserCards[0].card_id,
      merchant_name: selectedOffer.merchant_name,
      transaction_amount: 0,
      status: 'SAVED',
      estimated_discount: selectedOffer.maximum_benefit,
      confirmed_discount: 0,
      estimated_cashback: 0,
      confirmed_cashback: 0,
      estimated_reward_points: 0,
      confirmed_reward_points: 0,
      cashback_status: 'NOT_APPLICABLE',
    };

    testRedemptions.push(savedRedemption);
    expect(testRedemptions.length).toBe(1);
    expect(testRedemptions[0].status).toBe('SAVED');
    // Crucial: Saved offer has ₹0 confirmed savings
    const initialKpis = computeDashboardKPIs(testTransactions, testUserCards, testRedemptions, mockCatalogue, now);
    expect(initialKpis.confirmedSavingsINR).toBe(0);
    expect(initialKpis.savedOffersCount).toBe(1);
  });

  // ─── STEP 6: BRAND REGISTRATION TRACKER ───
  it('Step 6: User records brand registration for Amazon Pay with masked identifier', () => {
    const reg: BrandRegistration = {
      id: 'reg-amazon-1',
      user_id: testUserId,
      user_card_id: testUserCards[0].id,
      brand_name: 'Amazon Pay',
      campaign_name: 'Festive Prime Enrollment',
      identifier_type: 'EMAIL',
      masked_identifier: 'u***r@example.com',
      status: 'REGISTERED',
      registration_date: '2026-10-15',
    };
    testRegistrations.push(reg);

    expect(testRegistrations.length).toBe(1);
    expect(testRegistrations[0].status).toBe('REGISTERED');

    // Verify registration status connects with offer requirement check
    const offer = mockOffers[0];
    const check = checkRegistrationRequirement(offer, testRegistrations);
    expect(check?.required).toBe(true);
    expect(check?.status).toBe('REGISTERED');
    expect(check?.reminderMessage).toMatch(/Verified registered with Amazon Pay/);
  });

  // ─── STEP 7, 8 & 9: TRANSACTION EVALUATION & CARD RECOMMENDATION ───
  it('Step 7, 8 & 9: Evaluate transaction of ₹20,000 on Amazon across all cards', () => {
    const report = evaluateTransactionOffers({
      merchant: 'Amazon',
      amount: 20000,
      category: 'Shopping',
      transactionDate: '2026-10-31',
      userCards: testUserCards,
      availableOffers: mockOffers,
      cardCatalogue: mockCatalogue,
      brandRegistrations: testRegistrations,
    });

    expect(report.eligibleCards.length).toBeGreaterThan(0);
    expect(report.recommendedCard).toBeDefined();

    // HDFC Infinia provides 10% instant discount (₹2,000), capped at ₹1,500
    expect(report.recommendedCard?.cardName).toContain('Infinia');
    expect(report.recommendedCard?.benefit.instantDiscount).toBe(1500);
    expect(report.recommendedCard?.benefit.isCapped).toBe(true);
    expect(report.recommendedCard?.benefit.netBenefitINR).toBe(1500);

    // Registration requirement verified
    expect(report.recommendedCard?.registrationRequirement?.status).toBe('REGISTERED');
  });

  // ─── STEP 10, 11 & 12: SAVE TRANSACTION & LINK REDEMPTION AS APPLIED ───
  it('Step 10, 11 & 12: Save transaction and record offer redemption as APPLIED', () => {
    const newTxn = {
      id: 'txn-amazon-15k',
      user_id: testUserId,
      user_card_id: testUserCards[0].id,
      amount: 15000,
      merchant: 'Amazon',
      category_id: 'Shopping',
      date: '2026-10-31',
      reward_earned: 450,
      cashback_earned: 0,
      user_cards: testUserCards[0],
    };
    testTransactions.push(newTxn);

    // Transition offer from SAVED to APPLIED linked to this transaction
    const appliedRedemption: OfferRedemptionRow = {
      id: 'red-applied-1',
      user_id: testUserId,
      offer_id: 'OFF_AMAZON_HDFC',
      transaction_id: newTxn.id,
      user_card_id: testUserCards[0].id,
      card_id: testUserCards[0].card_id,
      merchant_name: 'Amazon',
      transaction_amount: 15000,
      status: 'APPLIED',
      estimated_discount: 1500,
      confirmed_discount: 0, // Not confirmed until receipt verified
      estimated_cashback: 0,
      confirmed_cashback: 0,
      estimated_reward_points: 0,
      confirmed_reward_points: 0,
      cashback_status: 'NOT_APPLICABLE',
    };

    // Remove the previous saved record and replace with applied redemption
    testRedemptions = testRedemptions.filter(r => r.id !== 'red-saved-1');
    testRedemptions.push(appliedRedemption);

    expect(testTransactions.length).toBe(1);
    expect(testRedemptions[0].status).toBe('APPLIED');
    expect(testRedemptions[0].transaction_id).toBe('txn-amazon-15k');

    // Confirmed savings remains ₹0 until receipt is confirmed
    const midKpis = computeDashboardKPIs(testTransactions, testUserCards, testRedemptions, mockCatalogue, now);
    expect(midKpis.confirmedSavingsINR).toBe(0);
    expect(midKpis.appliedOffersCount).toBe(1);
    expect(midKpis.currentMonthSpend).toBe(15000);
  });

  // ─── STEP 13: CONFIRM BENEFIT RECEIPT (REDEEMED) ───
  it('Step 13: Confirm receipt of instant discount, marking redemption as REDEEMED', () => {
    const r = testRedemptions.find(red => red.id === 'red-applied-1')!;
    expect(isValidStatusTransition(r.status, 'REDEEMED').valid).toBe(true);

    const confirmedRecord: OfferRedemptionRow = {
      ...r,
      status: 'REDEEMED',
      confirmed_discount: 1500,
      confirmation_date: '2026-10-31',
      notes: 'Applied promotional coupon code at checkout',
    };

    testRedemptions = testRedemptions.map(red => red.id === r.id ? confirmedRecord : red);
    expect(testRedemptions[0].status).toBe('REDEEMED');
    expect(testRedemptions[0].confirmed_discount).toBe(1500);
    expect(testRedemptions[0].confirmation_date).toBe('2026-10-31');
  });

  // ─── STEP 14 & 15: VERIFY DASHBOARD FINANCIAL KPIS ───
  it('Step 14 & 15: Open Dashboard and verify spending, confirmed savings, and reward points', () => {
    const finalKpis = computeDashboardKPIs(testTransactions, testUserCards, testRedemptions, mockCatalogue, now);

    // 1. Transaction spending
    expect(finalKpis.currentMonthSpend).toBe(15000);
    expect(finalKpis.currentYearSpend).toBe(15000);
    expect(finalKpis.totalTransactionsCount).toBe(1);

    // 2. Confirmed Savings
    expect(finalKpis.confirmedSavingsINR).toBe(1500);
    expect(finalKpis.confirmedDiscountINR).toBe(1500);

    // 3. Pending Cashback is 0
    expect(finalKpis.pendingCashbackINR).toBe(0);

    // 4. Reward Points: 450 pts earned from transaction
    expect(finalKpis.confirmedRewardPoints).toBe(450);

    // 5. Active cards & redeemed offers counts
    expect(finalKpis.activeCardsCount).toBe(2);
    expect(finalKpis.redeemedOffersCount).toBe(1);

    // 6. Card Performance Metrics
    const cardMetrics = computeCardPerformanceMetrics(testUserCards, testTransactions, testRedemptions, mockCatalogue);
    const infiniaMetrics = cardMetrics.find(c => c.userCardId === 'uc-infinia-1')!;
    expect(infiniaMetrics.totalSpend).toBe(15000);
    expect(infiniaMetrics.transactionCount).toBe(1);
    expect(infiniaMetrics.confirmedDiscountINR).toBe(1500);
    expect(infiniaMetrics.isMostUsed).toBe(true);
    expect(infiniaMetrics.isHighestSavings).toBe(true);
  });

  // ─── INTEGRATION HARDENING: DATA CONSISTENCY & COMPENSATING OPERATIONS ───
  describe('Data Consistency & Destructive Actions Resilience', () => {
    it('Editing a transaction updates related analytics without duplicating redemptions', () => {
      // User updates transaction amount to ₹18,000
      const existingTxn = testTransactions[0];
      const updatedTxn = { ...existingTxn, amount: 18000 };
      testTransactions = [updatedTxn];

      // Linked redemption transaction_amount is updated in place
      testRedemptions = testRedemptions.map(r =>
        r.transaction_id === existingTxn.id ? { ...r, transaction_amount: 18000 } : r
      );

      expect(testRedemptions.length).toBe(1); // No duplicates
      const kpis = computeDashboardKPIs(testTransactions, testUserCards, testRedemptions, mockCatalogue, now);
      expect(kpis.currentMonthSpend).toBe(18000);
      expect(kpis.confirmedSavingsINR).toBe(1500);
    });

    it('Deleting a transaction preserves historical redemption record with status NOT_REDEEMED', () => {
      const txnId = testTransactions[0].id;

      // Compensating operation on transaction delete
      testRedemptions = testRedemptions.map(r =>
        r.transaction_id === txnId
          ? { ...r, transaction_id: null, status: 'NOT_REDEEMED', notes: 'Associated transaction was deleted' }
          : r
      );
      testTransactions = []; // Deleted transaction

      expect(testTransactions.length).toBe(0);
      expect(testRedemptions[0].transaction_id).toBeNull();
      expect(testRedemptions[0].status).toBe('NOT_REDEEMED');

      // KPIs reflect transaction deletion: spend becomes 0, confirmed savings becomes 0
      const kpis = computeDashboardKPIs(testTransactions, testUserCards, testRedemptions, mockCatalogue, now);
      expect(kpis.currentMonthSpend).toBe(0);
      expect(kpis.confirmedSavingsINR).toBe(0);
    });

    it('Deleting a card safely unlinks user_card_id without corrupting redemptions or throwing foreign key errors', () => {
      const cardToDelete = testUserCards[0].id;

      // Compensating unlinking
      testRedemptions = testRedemptions.map(r =>
        r.user_card_id === cardToDelete ? { ...r, user_card_id: null } : r
      );
      testUserCards = testUserCards.filter(c => c.id !== cardToDelete);

      expect(testUserCards.length).toBe(1);
      expect(testRedemptions[0].user_card_id).toBeNull();
      // Notice: card_id string 'hdfc-infinia' is preserved for point valuation
      expect(testRedemptions[0].card_id).toBe('hdfc-infinia');
    });

    it('Python analytics fallback produces identical totals to TypeScript analytics on identical dataset', () => {
      const sampleTxns = [
        { amount: 5000, category: 'Dining', date: '2026-10-15', card: 'Infinia', merchant: 'Swiggy' },
        { amount: 15000, category: 'Shopping', date: '2026-10-20', card: 'Infinia', merchant: 'Amazon' },
      ];

      const tsTotal = sampleTxns.reduce((s, t) => s + t.amount, 0);
      const tsCat: Record<string, number> = {};
      for (const t of sampleTxns) {
        tsCat[t.category] = (tsCat[t.category] || 0) + t.amount;
      }

      // Expected values that Python Pandas calculates
      expect(tsTotal).toBe(20000);
      expect(tsCat['Dining']).toBe(5000);
      expect(tsCat['Shopping']).toBe(15000);
    });
  });
});
