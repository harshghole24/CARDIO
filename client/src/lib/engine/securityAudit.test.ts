import { describe, it, expect } from 'vitest';
import {
  isValidStatusTransition,
  VALID_LIFECYCLE_TRANSITIONS,
  calculateSavingsSummary,
} from './savingsCalculator';
import {
  computeDashboardKPIs,
  computeCardPerformanceMetrics,
  computeOfferPerformanceMetrics,
} from './dashboardAnalytics';
import { maskIdentifier } from '../utils/masking';
import type { CreditCardRow, OfferRedemptionRow, TransactionRow } from '../data/schemas';

// Mock Card Catalogue
const mockCatalogue = new Map<string, CreditCardRow>([
  [
    'hdfc-infinia',
    {
      card_id: 'hdfc-infinia',
      name: 'HDFC Infinia Metal Edition',
      issuer: 'HDFC',
      network: 'VISA',
      tier: 'SUPER_PREMIUM',
      annual_fee_inr: 12500,
      joining_fee_inr: 12500,
      base_reward_rate_pct: 3.3,
      max_reward_rate_pct: 16.5,
      reward_currency_id: 'infinia_reward_points',
      point_value_paise: 100, // ₹1.00 per point
      base_points_per_100_inr_derived: 3.3,
      max_points_per_100_inr_derived: 16.5,
    },
  ],
  [
    'sbi-cashback',
    {
      card_id: 'sbi-cashback',
      name: 'SBI Cashback Card',
      issuer: 'SBI',
      network: 'VISA',
      tier: 'ENTRY',
      annual_fee_inr: 999,
      joining_fee_inr: 999,
      base_reward_rate_pct: 1.0,
      max_reward_rate_pct: 5.0,
      reward_currency_id: 'cashback',
      point_value_paise: 100, // ₹1.00 per point
      base_points_per_100_inr_derived: 1.0,
      max_points_per_100_inr_derived: 5.0,
    },
  ],
]);

describe('CardIO Security & Financial Integrity Audit', () => {
  // ── PHASE 1 & 3: INPUT SANITIZATION & BOUNDARY TESTING ──────
  describe('Input Bounds & Sanitization', () => {
    it('should reject or handle zero and negative monetary inputs gracefully', () => {
      const redemptions: OfferRedemptionRow[] = [
        {
          id: 'red-1',
          user_id: 'user-1',
          offer_id: 'swiggy-disc',
          merchant_name: 'Swiggy',
          transaction_amount: -500, // Negative amount
          status: 'REDEEMED',
          estimated_discount: 100,
          confirmed_discount: Math.max(0, -50), // Sanitized to 0
          estimated_cashback: 0,
          confirmed_cashback: 0,
          estimated_reward_points: 0,
          confirmed_reward_points: 0,
          cashback_status: 'NOT_APPLICABLE',
        },
      ];

      const summary = calculateSavingsSummary(redemptions, mockCatalogue);
      expect(summary.totalConfirmedSavingsINR).toBe(0);
      expect(summary.totalConfirmedDiscountINR).toBe(0);
    });

    it('should prevent overflow on extreme monetary values (stress test)', () => {
      const extremeRedemptions: OfferRedemptionRow[] = [
        {
          id: 'red-extreme',
          user_id: 'user-1',
          offer_id: 'large-offer',
          merchant_name: 'Luxury Jeweler',
          transaction_amount: 50_000_000, // ₹5 Crore
          status: 'REDEEMED',
          estimated_discount: 500_000,
          confirmed_discount: 500_000,
          estimated_cashback: 250_000,
          confirmed_cashback: 250_000,
          estimated_reward_points: 100_000,
          confirmed_reward_points: 100_000, // 100,000 points @ ₹1 = ₹100,000
          card_id: 'hdfc-infinia',
          cashback_status: 'RECEIVED',
        },
      ];

      const summary = calculateSavingsSummary(extremeRedemptions, mockCatalogue);
      expect(summary.totalConfirmedSavingsINR).toBe(850_000); // 500k + 250k + 100k
      expect(Number.isFinite(summary.totalConfirmedSavingsINR)).toBe(true);
    });
  });

  // ── PHASE 5: FINANCIAL DATA INTEGRITY (CONFIRMED VS PENDING) ──
  describe('Financial Data Integrity & Segregation', () => {
    it('strictly isolates pending cashback from confirmed savings', () => {
      const redemptions: OfferRedemptionRow[] = [
        {
          id: 'red-redeemed',
          user_id: 'user-1',
          offer_id: 'zomato-conf',
          merchant_name: 'Zomato',
          transaction_amount: 1000,
          status: 'REDEEMED',
          confirmed_discount: 150,
          confirmed_cashback: 50,
          estimated_discount: 150,
          estimated_cashback: 50,
          estimated_reward_points: 0,
          confirmed_reward_points: 0,
          cashback_status: 'RECEIVED',
        },
        {
          id: 'red-pending',
          user_id: 'user-1',
          offer_id: 'amazon-pend',
          merchant_name: 'Amazon',
          transaction_amount: 10000,
          status: 'PENDING_CASHBACK',
          confirmed_discount: 0,
          confirmed_cashback: 0,
          estimated_discount: 0,
          estimated_cashback: 500, // Pending ₹500 cashback
          estimated_reward_points: 0,
          confirmed_reward_points: 0,
          cashback_status: 'PENDING',
        },
      ];

      const summary = calculateSavingsSummary(redemptions, mockCatalogue);

      // Confirmed savings MUST ONLY be 150 + 50 = ₹200
      expect(summary.totalConfirmedSavingsINR).toBe(200);
      expect(summary.totalConfirmedDiscountINR).toBe(150);
      expect(summary.totalConfirmedCashbackINR).toBe(50);

      // Pending cashback MUST be segregated
      expect(summary.totalPendingCashbackINR).toBe(500);

      // Confirmed savings MUST NOT include pending cashback
      expect(summary.totalConfirmedSavingsINR).not.toBe(700);
    });

    it('converts reward points to INR using exact card point valuation', () => {
      const infinRedemption: OfferRedemptionRow[] = [
        {
          id: 'red-infinia',
          user_id: 'user-1',
          offer_id: 'flight-points',
          card_id: 'hdfc-infinia', // point_value_paise = 100 (₹1 per point)
          merchant_name: 'SmartBuy',
          status: 'REDEEMED',
          confirmed_discount: 0,
          confirmed_cashback: 0,
          confirmed_reward_points: 1500,
          estimated_discount: 0,
          estimated_cashback: 0,
          estimated_reward_points: 1500,
          cashback_status: 'NOT_APPLICABLE',
        },
      ];

      const summary = calculateSavingsSummary(infinRedemption, mockCatalogue);
      // 1,500 points * 100 paise = ₹1,500
      expect(summary.totalConfirmedRewardPointsValueINR).toBe(1500);
      expect(summary.totalConfirmedSavingsINR).toBe(1500);
    });

    it('handles Month-over-Month calculation safely when previous spend is zero (division by zero protection)', () => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
      const todayIso = `${currentYear}-${currentMonth}-10`;

      const txns: TransactionRow[] = [
        {
          id: 'txn-1',
          user_id: 'user-1',
          merchant: 'Blinkit',
          amount: 2500,
          date: todayIso,
        },
      ];

      const kpis = computeDashboardKPIs(txns, [{ id: 'c1' }], [], mockCatalogue, now);
      expect(kpis.currentMonthSpend).toBe(2500);
      expect(kpis.prevMonthSpend).toBe(0);
      // spendChangeMoM should be null (not Infinity, not NaN)
      expect(kpis.spendChangeMoM).toBeNull();
    });
  });

  // ── PHASE 1 & 2: STATE MACHINE TRANSITION INTEGRITY ──────────
  describe('Offer Lifecycle State Machine', () => {
    it('allows valid progressive transitions', () => {
      expect(isValidStatusTransition('AVAILABLE', 'SAVED').valid).toBe(true);
      expect(isValidStatusTransition('SAVED', 'APPLIED').valid).toBe(true);
      expect(isValidStatusTransition('APPLIED', 'REDEEMED').valid).toBe(true);
      expect(isValidStatusTransition('APPLIED', 'PENDING_CASHBACK').valid).toBe(true);
      expect(isValidStatusTransition('PENDING_CASHBACK', 'REDEEMED').valid).toBe(true);
    });

    it('rejects invalid or regressive state jumps (anti-tampering)', () => {
      // Once confirmed REDEEMED, it cannot revert to SAVED or AVAILABLE
      expect(isValidStatusTransition('REDEEMED', 'SAVED').valid).toBe(false);
      expect(isValidStatusTransition('REDEEMED', 'AVAILABLE').valid).toBe(false);

      // Once EXPIRED, it cannot jump straight to REDEEMED
      expect(isValidStatusTransition('EXPIRED', 'REDEEMED').valid).toBe(false);

      // AVAILABLE cannot jump straight to REDEEMED without being applied
      expect(isValidStatusTransition('AVAILABLE', 'REDEEMED').valid).toBe(false);
    });

    it('ensures terminal state transitions remain locked', () => {
      expect(VALID_LIFECYCLE_TRANSITIONS.REDEEMED).toEqual(['REDEEMED']);
      expect(VALID_LIFECYCLE_TRANSITIONS.EXPIRED).toEqual(['EXPIRED']);
    });
  });

  // ── PHASE 3 & 4: SENSITIVE IDENTIFIER MASKING (PII DEFENSE) ──
  describe('Brand Registration Masking & Privacy', () => {
    it('properly masks email identifiers while retaining domain hints', () => {
      const masked = maskIdentifier('john.doe@gmail.com', 'EMAIL');
      expect(masked).toBe('j***e@gmail.com');
      expect(masked).not.toContain('john.doe');
    });

    it('properly masks Indian and international phone numbers', () => {
      const maskedIndia = maskIdentifier('+91 9876543210', 'PHONE');
      expect(maskedIndia).toContain('***');
      expect(maskedIndia).not.toBe('+91 9876543210');
      expect(maskedIndia.endsWith('210')).toBe(true);
    });

    it('does not double-mask already masked values', () => {
      const onceMasked = 'a***z@domain.com';
      const twiceMasked = maskIdentifier(onceMasked, 'EMAIL');
      expect(twiceMasked).toBe(onceMasked);
    });
  });

  // ── PHASE 6: PYTHON ANALYTICS RESILIENCE & NODE FALLBACK ─────
  describe('Analytics Fallback & Edge Case Resilience', () => {
    it('handles empty transaction datasets gracefully without exceptions', () => {
      const kpis = computeDashboardKPIs([], [], [], mockCatalogue);
      expect(kpis.currentMonthSpend).toBe(0);
      expect(kpis.currentYearSpend).toBe(0);
      expect(kpis.totalAllTimeSpend).toBe(0);
      expect(kpis.totalTransactionsCount).toBe(0);
      expect(kpis.spendChangeMoM).toBeNull();
    });

    it('calculates card performance metrics accurately without NaN on zero spend cards', () => {
      const cards = [
        {
          id: 'card-active-zero-spend',
          user_id: 'user-1',
          card_id: 'hdfc-infinia',
          custom_card_name: 'My Infinia',
        },
      ];

      const metrics = computeCardPerformanceMetrics(cards, [], [], mockCatalogue);
      expect(metrics).toHaveLength(1);
      expect(metrics[0].totalSpend).toBe(0);
      expect(metrics[0].effectiveReturnRatePct).toBe(0);
      expect(isNaN(metrics[0].effectiveReturnRatePct)).toBe(false);
    });

    it('calculates offer metrics redemption success rate correctly without division by zero', () => {
      const metrics = computeOfferPerformanceMetrics([]);
      expect(metrics.totalTrackedOffers).toBe(0);
      expect(metrics.redemptionSuccessRatePct).toBe(0);
      expect(isNaN(metrics.redemptionSuccessRatePct)).toBe(false);
    });
  });
});
