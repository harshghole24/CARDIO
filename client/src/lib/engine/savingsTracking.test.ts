import { describe, it, expect } from 'vitest';
import {
  isValidStatusTransition,
  calculateSavingsSummary,
  VALID_LIFECYCLE_TRANSITIONS,
} from './savingsCalculator';
import {
  calculateOfferBenefit,
} from './offerEngine';
import type {
  OfferRedemptionRow,
  CreditCardRow,
  OfferRow,
  OfferLifecycleStatus,
} from '../data/schemas';

// Mock Card Catalogue
const mockCards = new Map<string, CreditCardRow>([
  [
    'hdfc-infinia',
    {
      card_id: 'hdfc-infinia',
      name: 'HDFC Bank Infinia Metal Edition',
      issuer: 'HDFC',
      network: 'VISA',
      tier: 'SUPER_PREMIUM',
      base_reward_rate_pct: 3.3,
      point_value_paise: 100, // 1 Point = ₹1.00
      max_points_per_100_inr_derived: 3.3,
      annual_fee_inr: 12500,
      reward_currency: 'SmartBuy Points',
      fee_waiver_spend_threshold_inr: 1000000,
      source: 'Verified',
      points_transfer_summary: 'Air India, KrisFlyer, Accor',
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
      point_value_paise: 25, // 1 Point = ₹0.25
      max_points_per_100_inr_derived: 1.0,
      annual_fee_inr: 999,
      reward_currency: 'Cashback',
      fee_waiver_spend_threshold_inr: 200000,
      source: 'Verified',
      points_transfer_summary: 'Statement Credit',
    },
  ],
]);

// Mock Promo Offer with Benefit Caps
const mockCappedOffer: OfferRow = {
  offer_id: 'TEST_AMAZON_10',
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
  minimum_transaction_amount: 2000,
  maximum_benefit: 750, // Capped at ₹750
  valid_from: '2026-01-01',
  valid_until: '2026-12-31',
  registration_required: false,
  offer_status: 'ACTIVE',
  confidence: 'VERIFIED',
};

describe('Offer Redemption & Savings Tracking Engine', () => {
  // ─── 1. LIFECYCLE TRANSITIONS & VALIDATION ───
  describe('Lifecycle State Machine Transitions', () => {
    it('1. Allows saving an offer: AVAILABLE -> SAVED', () => {
      const res = isValidStatusTransition('AVAILABLE', 'SAVED');
      expect(res.valid).toBe(true);
      expect(VALID_LIFECYCLE_TRANSITIONS.AVAILABLE).toContain('SAVED');
    });

    it('2. Allows applying an offer: SAVED -> APPLIED and AVAILABLE -> APPLIED', () => {
      expect(isValidStatusTransition('SAVED', 'APPLIED').valid).toBe(true);
      expect(isValidStatusTransition('AVAILABLE', 'APPLIED').valid).toBe(true);
    });

    it('3. Allows confirming redemption: APPLIED -> REDEEMED', () => {
      const res = isValidStatusTransition('APPLIED', 'REDEEMED');
      expect(res.valid).toBe(true);
    });

    it('4. Allows marking pending cashback: APPLIED -> PENDING_CASHBACK', () => {
      const res = isValidStatusTransition('APPLIED', 'PENDING_CASHBACK');
      expect(res.valid).toBe(true);
    });

    it('5. Allows confirming received cashback: PENDING_CASHBACK -> REDEEMED', () => {
      const res = isValidStatusTransition('PENDING_CASHBACK', 'REDEEMED');
      expect(res.valid).toBe(true);
    });

    it('6. Re-transitioning within the same status is always allowed (idempotent)', () => {
      const statuses: OfferLifecycleStatus[] = [
        'AVAILABLE', 'SAVED', 'APPLIED', 'REDEEMED',
        'PENDING_CASHBACK', 'EXPIRED', 'NOT_REDEEMED'
      ];
      for (const st of statuses) {
        expect(isValidStatusTransition(st, st).valid).toBe(true);
      }
    });

    it('7. Strictly rejects invalid lifecycle transitions', () => {
      // Terminal confirmed state REDEEMED cannot transition to SAVED or AVAILABLE
      const redToSaved = isValidStatusTransition('REDEEMED', 'SAVED');
      expect(redToSaved.valid).toBe(false);
      expect(redToSaved.reason).toMatch(/Invalid offer lifecycle transition from REDEEMED to SAVED/);

      const redToAvail = isValidStatusTransition('REDEEMED', 'AVAILABLE');
      expect(redToAvail.valid).toBe(false);

      // EXPIRED cannot jump back to APPLIED
      const expToApp = isValidStatusTransition('EXPIRED', 'APPLIED');
      expect(expToApp.valid).toBe(false);

      // AVAILABLE cannot jump straight to REDEEMED without being APPLIED to a transaction
      const availToRed = isValidStatusTransition('AVAILABLE', 'REDEEMED');
      expect(availToRed.valid).toBe(false);

      // AVAILABLE cannot jump directly to PENDING_CASHBACK
      const availToPending = isValidStatusTransition('AVAILABLE', 'PENDING_CASHBACK');
      expect(availToPending.valid).toBe(false);
    });
  });

  // ─── 2. SAVINGS CALCULATOR & ACCOUNTING RULES ───
  describe('Savings Calculator & Accounting Rigor', () => {
    it('8. Handles empty redemptions dataset gracefully', () => {
      const summary = calculateSavingsSummary([], mockCards);
      expect(summary.totalConfirmedSavingsINR).toBe(0);
      expect(summary.totalConfirmedDiscountINR).toBe(0);
      expect(summary.totalConfirmedCashbackINR).toBe(0);
      expect(summary.totalConfirmedRewardPoints).toBe(0);
      expect(summary.totalPendingCashbackINR).toBe(0);
      expect(summary.totalEstimatedPotentialSavingsINR).toBe(0);
      expect(summary.redeemedOffersCount).toBe(0);
      expect(summary.topMerchantsBySavings).toEqual([]);
      expect(summary.monthlySavingsTrends).toEqual([]);
    });

    it('9. Strictly segregates estimated vs confirmed benefits (Never counts estimated benefits as confirmed)', () => {
      const sampleRedemptions: OfferRedemptionRow[] = [
        {
          id: 'red-1',
          offer_id: 'OFF_SAVED_1',
          merchant_name: 'Flipkart',
          transaction_amount: 5000,
          status: 'SAVED',
          estimated_discount: 500,
          confirmed_discount: 0,
          estimated_cashback: 0,
          confirmed_cashback: 0,
          estimated_reward_points: 0,
          confirmed_reward_points: 0,
          cashback_status: 'NOT_APPLICABLE',
        },
        {
          id: 'red-2',
          offer_id: 'OFF_APPLIED_1',
          merchant_name: 'Swiggy',
          transaction_amount: 1200,
          status: 'APPLIED',
          estimated_discount: 150,
          confirmed_discount: 0,
          estimated_cashback: 50,
          confirmed_cashback: 0,
          estimated_reward_points: 0,
          confirmed_reward_points: 0,
          cashback_status: 'NOT_APPLICABLE',
        },
        {
          id: 'red-3',
          offer_id: 'OFF_PENDING_CB',
          merchant_name: 'MakeMyTrip',
          transaction_amount: 8000,
          status: 'PENDING_CASHBACK',
          estimated_discount: 0,
          confirmed_discount: 0,
          estimated_cashback: 1000,
          confirmed_cashback: 0,
          estimated_reward_points: 0,
          confirmed_reward_points: 0,
          cashback_status: 'PENDING',
        },
      ];

      const summary = calculateSavingsSummary(sampleRedemptions, mockCards);

      // Crucial: Confirmed savings MUST be 0
      expect(summary.totalConfirmedSavingsINR).toBe(0);
      expect(summary.totalConfirmedDiscountINR).toBe(0);
      expect(summary.totalConfirmedCashbackINR).toBe(0);

      // Pending cashback is accurately isolated
      expect(summary.totalPendingCashbackINR).toBe(1000);

      // Estimated potential savings totals all active potential benefits: 500 + (150 + 50) + 1000 = 1700
      expect(summary.totalEstimatedPotentialSavingsINR).toBe(1700);

      // Counts
      expect(summary.savedOffersCount).toBe(1);
      expect(summary.appliedRedemptionsCount).toBe(1);
      expect(summary.pendingRedemptionsCount).toBe(1);
      expect(summary.redeemedOffersCount).toBe(0);
    });

    it('10. Accurately calculates confirmed discounts, cashback, and reward points when REDEEMED', () => {
      const redeemedRecords: OfferRedemptionRow[] = [
        {
          id: 'red-conf-1',
          offer_id: 'OFF_AMAZON_INSTANT',
          card_id: 'hdfc-infinia',
          merchant_name: 'Amazon',
          transaction_amount: 10000,
          status: 'REDEEMED',
          estimated_discount: 750,
          confirmed_discount: 750,
          estimated_cashback: 0,
          confirmed_cashback: 0,
          estimated_reward_points: 0,
          confirmed_reward_points: 0,
          cashback_status: 'NOT_APPLICABLE',
          confirmation_date: '2026-10-15',
        },
        {
          id: 'red-conf-2',
          offer_id: 'OFF_MMT_CB',
          card_id: 'sbi-cashback',
          merchant_name: 'MakeMyTrip',
          transaction_amount: 15000,
          status: 'REDEEMED',
          estimated_discount: 0,
          confirmed_discount: 0,
          estimated_cashback: 1500,
          confirmed_cashback: 1500,
          estimated_reward_points: 0,
          confirmed_reward_points: 0,
          cashback_status: 'RECEIVED',
          confirmation_date: '2026-10-20',
        },
      ];

      const summary = calculateSavingsSummary(redeemedRecords, mockCards);

      expect(summary.totalConfirmedDiscountINR).toBe(750);
      expect(summary.totalConfirmedCashbackINR).toBe(1500);
      expect(summary.totalConfirmedSavingsINR).toBe(2250);
      expect(summary.redeemedOffersCount).toBe(2);
    });

    it('11. Converts reward points to INR using exact card point valuation', () => {
      const pointsRedemptions: OfferRedemptionRow[] = [
        {
          id: 'pts-infinia',
          offer_id: 'OFF_POINTS_1',
          card_id: 'hdfc-infinia', // point_value_paise = 100 (₹1.00 per point)
          merchant_name: 'Apple',
          transaction_amount: 80000,
          status: 'REDEEMED',
          estimated_discount: 0,
          confirmed_discount: 0,
          estimated_cashback: 0,
          confirmed_cashback: 0,
          estimated_reward_points: 5000,
          confirmed_reward_points: 5000, // 5,000 pts * ₹1.00 = ₹5,000
          cashback_status: 'NOT_APPLICABLE',
          confirmation_date: '2026-10-10',
        },
        {
          id: 'pts-sbi',
          offer_id: 'OFF_POINTS_2',
          card_id: 'sbi-cashback', // point_value_paise = 25 (₹0.25 per point)
          merchant_name: 'Croma',
          transaction_amount: 20000,
          status: 'REDEEMED',
          estimated_discount: 0,
          confirmed_discount: 0,
          estimated_cashback: 0,
          confirmed_cashback: 0,
          estimated_reward_points: 2000,
          confirmed_reward_points: 2000, // 2,000 pts * ₹0.25 = ₹500
          cashback_status: 'NOT_APPLICABLE',
          confirmation_date: '2026-10-12',
        },
      ];

      const summary = calculateSavingsSummary(pointsRedemptions, mockCards);

      expect(summary.totalConfirmedRewardPoints).toBe(7000);
      expect(summary.totalConfirmedRewardPointsValueINR).toBe(5500); // 5000 + 500
      expect(summary.totalConfirmedSavingsINR).toBe(5500);
    });

    it('12. Prevents double counting between instant discounts and cashback', () => {
      const dualBenefitRecord: OfferRedemptionRow = {
        id: 'dual-1',
        offer_id: 'OFF_DUAL_BENEFIT',
        card_id: 'hdfc-infinia',
        merchant_name: 'Samsung',
        transaction_amount: 50000,
        status: 'REDEEMED',
        estimated_discount: 2500,
        confirmed_discount: 2500,
        estimated_cashback: 1000,
        confirmed_cashback: 1000,
        estimated_reward_points: 1000, // 1000 pts * ₹1.00 = ₹1000
        confirmed_reward_points: 1000,
        cashback_status: 'RECEIVED',
        confirmation_date: '2026-10-01',
      };

      const summary = calculateSavingsSummary([dualBenefitRecord], mockCards);

      expect(summary.totalConfirmedDiscountINR).toBe(2500);
      expect(summary.totalConfirmedCashbackINR).toBe(1000);
      expect(summary.totalConfirmedRewardPointsValueINR).toBe(1000);
      // Total is strictly the sum of components without duplicate factor
      expect(summary.totalConfirmedSavingsINR).toBe(4500);
    });

    it('13. Deduplicates identical records by ID to prevent double counting in analytics', () => {
      const duplicateRecord: OfferRedemptionRow = {
        id: 'dup-rec-id',
        offer_id: 'OFF_DUP',
        merchant_name: 'Zomato',
        card_id: 'hdfc-infinia',
        transaction_amount: 2000,
        status: 'REDEEMED',
        estimated_discount: 200,
        confirmed_discount: 200,
        estimated_cashback: 0,
        confirmed_cashback: 0,
        estimated_reward_points: 0,
        confirmed_reward_points: 0,
        cashback_status: 'NOT_APPLICABLE',
      };

      // Passed twice
      const summary = calculateSavingsSummary([duplicateRecord, duplicateRecord], mockCards);

      expect(summary.totalConfirmedSavingsINR).toBe(200);
      expect(summary.redeemedOffersCount).toBe(1);
    });

    it('14. Ranks top merchants and identifies the best-performing card', () => {
      const records: OfferRedemptionRow[] = [
        {
          id: 'r1',
          offer_id: 'O1',
          card_id: 'hdfc-infinia',
          merchant_name: 'Amazon',
          transaction_amount: 10000,
          status: 'REDEEMED',
          confirmed_discount: 1000,
          confirmed_cashback: 0,
          confirmed_reward_points: 0,
          estimated_discount: 1000,
          estimated_cashback: 0,
          estimated_reward_points: 0,
          cashback_status: 'NOT_APPLICABLE',
          confirmation_date: '2026-09-15',
        },
        {
          id: 'r2',
          offer_id: 'O2',
          card_id: 'sbi-cashback',
          merchant_name: 'Amazon',
          transaction_amount: 5000,
          status: 'REDEEMED',
          confirmed_discount: 500,
          confirmed_cashback: 0,
          confirmed_reward_points: 0,
          estimated_discount: 500,
          estimated_cashback: 0,
          estimated_reward_points: 0,
          cashback_status: 'NOT_APPLICABLE',
          confirmation_date: '2026-10-02',
        },
        {
          id: 'r3',
          offer_id: 'O3',
          card_id: 'sbi-cashback',
          merchant_name: 'Swiggy',
          transaction_amount: 2000,
          status: 'REDEEMED',
          confirmed_discount: 200,
          confirmed_cashback: 0,
          confirmed_reward_points: 0,
          estimated_discount: 200,
          estimated_cashback: 0,
          estimated_reward_points: 0,
          cashback_status: 'NOT_APPLICABLE',
          confirmation_date: '2026-10-05',
        },
      ];

      const summary = calculateSavingsSummary(records, mockCards);

      // Best performing card: HDFC Infinia (₹1000) vs SBI Cashback (₹500 + ₹200 = ₹700)
      expect(summary.bestPerformingCard?.cardId).toBe('hdfc-infinia');
      expect(summary.bestPerformingCard?.confirmedSavingsINR).toBe(1000);

      // Top merchant: Amazon (₹1500, 2 redemptions) > Swiggy (₹200, 1 redemption)
      expect(summary.topMerchantsBySavings[0].merchant).toBe('Amazon');
      expect(summary.topMerchantsBySavings[0].confirmedSavingsINR).toBe(1500);
      expect(summary.topMerchantsBySavings[0].redemptionsCount).toBe(2);

      // Monthly trends
      expect(summary.monthlySavingsTrends).toEqual([
        { month: '2026-09', confirmedSavingsINR: 1000, confirmedPoints: 0 },
        { month: '2026-10', confirmedSavingsINR: 700, confirmedPoints: 0 },
      ]);
    });

    it('15. Enforces benefit caps: Prevents advertised percentages from exceeding maximum_benefit', () => {
      const dbCard = mockCards.get('hdfc-infinia')!;
      // Transaction amount ₹20,000 at 10% = ₹2,000, but cap is ₹750
      const evaluation = calculateOfferBenefit(20000, dbCard, mockCappedOffer);

      expect(evaluation.instantDiscount).toBe(750);
      expect(evaluation.isCapped).toBe(true);
      expect(evaluation.netBenefitINR).toBe(750);
    });
  });
});
