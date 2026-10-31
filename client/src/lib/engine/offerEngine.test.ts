import { describe, it, expect } from 'vitest';
import {
  checkOfferValidity,
  calculateOfferBenefit,
  evaluateTransactionOffers,
  type UserCardWithMeta,
  type BrandRegistration,
} from './offerEngine';
import type { CreditCardRow, OfferRow } from '../data/schemas';

// Mock Card Catalogue
const mockCards: Record<string, CreditCardRow> = {
  'icici-amazon-pay': {
    card_id: 'icici-amazon-pay',
    name: 'Amazon Pay ICICI Card',
    issuer: 'ICICI',
    network: 'VISA',
    tier: 'ENTRY',
    annual_fee_inr: 0,
    joining_fee_inr: 0,
    base_reward_rate_pct: 1,
    max_reward_rate_pct: 5,
    reward_currency_id: 'amazon_pay_balance',
    point_value_paise: 100,
    base_points_per_100_inr_derived: 1,
    max_points_per_100_inr_derived: 5,
  },
  'icici-coral': {
    card_id: 'icici-coral',
    name: 'ICICI Bank Coral Card',
    issuer: 'ICICI',
    network: 'VISA',
    tier: 'ENTRY',
    annual_fee_inr: 500,
    joining_fee_inr: 500,
    base_reward_rate_pct: 0.5,
    max_reward_rate_pct: 2,
    reward_currency_id: 'icici_reward_points',
    point_value_paise: 25,
    base_points_per_100_inr_derived: 2,
    max_points_per_100_inr_derived: 4,
  },
  'icici-coral-rupay': {
    card_id: 'icici-coral-rupay',
    name: 'ICICI Coral RuPay Credit Card',
    issuer: 'ICICI',
    network: 'RUPAY',
    tier: 'ENTRY',
    annual_fee_inr: 500,
    joining_fee_inr: 500,
    base_reward_rate_pct: 0.5,
    max_reward_rate_pct: 2,
    reward_currency_id: 'icici_reward_points',
    point_value_paise: 25,
    base_points_per_100_inr_derived: 2,
    max_points_per_100_inr_derived: 4,
  },
  'hdfc-swiggy': {
    card_id: 'hdfc-swiggy',
    name: 'Swiggy HDFC Bank Card',
    issuer: 'HDFC',
    network: 'MASTERCARD',
    tier: 'ENTRY',
    annual_fee_inr: 500,
    joining_fee_inr: 500,
    base_reward_rate_pct: 1,
    max_reward_rate_pct: 10,
    reward_currency_id: 'swiggy_money',
    point_value_paise: 100,
    base_points_per_100_inr_derived: 1,
    max_points_per_100_inr_derived: 10,
  },
  'hdfc-infinia': {
    card_id: 'hdfc-infinia',
    name: 'HDFC Bank Infinia Metal',
    issuer: 'HDFC',
    network: 'VISA',
    tier: 'SUPER_PREMIUM',
    annual_fee_inr: 12500,
    joining_fee_inr: 12500,
    base_reward_rate_pct: 3.3,
    max_reward_rate_pct: 33,
    reward_currency_id: 'hdfc_reward_points',
    point_value_paise: 100,
    base_points_per_100_inr_derived: 5,
    max_points_per_100_inr_derived: 33,
  },
  'axis-airtel': {
    card_id: 'axis-airtel',
    name: 'Airtel Axis Bank Credit Card',
    issuer: 'AXIS',
    network: 'VISA',
    tier: 'ENTRY',
    annual_fee_inr: 500,
    joining_fee_inr: 500,
    base_reward_rate_pct: 1,
    max_reward_rate_pct: 25,
    reward_currency_id: 'cashback',
    point_value_paise: 100,
    base_points_per_100_inr_derived: 1,
    max_points_per_100_inr_derived: 25,
  },
  'amex-platinum-travel': {
    card_id: 'amex-platinum-travel',
    name: 'American Express Platinum Travel',
    issuer: 'AMEX',
    network: 'AMEX',
    tier: 'PREMIUM',
    annual_fee_inr: 5000,
    joining_fee_inr: 3500,
    base_reward_rate_pct: 2,
    max_reward_rate_pct: 8,
    reward_currency_id: 'amex_membership_rewards',
    point_value_paise: 50,
    base_points_per_100_inr_derived: 2,
    max_points_per_100_inr_derived: 10,
  },
};

const cardMap = new Map<string, CreditCardRow>(Object.entries(mockCards));

// Mock Offers
const mockOffers: OfferRow[] = [
  {
    offer_id: 'OFFER_AMAZON_ICICI_PRIME',
    merchant_name: 'Amazon',
    bank_name: 'ICICI',
    eligible_card_variants: 'icici-amazon-pay',
    eligible_networks: 'ALL',
    offer_category: 'Shopping',
    benefit_type: 'PERCENTAGE_CASHBACK',
    discount_percentage: 0,
    cashback_percentage: 5,
    reward_points_multiplier: 1,
    fixed_discount_amount: 0,
    minimum_transaction_amount: 0,
    maximum_benefit: 0,
    valid_from: '2026-01-01',
    valid_until: '2026-12-31',
    registration_required: false,
    offer_status: 'ACTIVE',
    confidence: 'VERIFIED',
  },
  {
    offer_id: 'OFFER_HDFC_AMAZON_10PCT',
    merchant_name: 'Amazon',
    bank_name: 'HDFC',
    eligible_card_variants: 'all',
    eligible_networks: 'ALL',
    offer_category: 'Shopping',
    benefit_type: 'INSTANT_DISCOUNT',
    discount_percentage: 10,
    cashback_percentage: 0,
    reward_points_multiplier: 1,
    fixed_discount_amount: 0,
    minimum_transaction_amount: 5000,
    maximum_benefit: 1500,
    valid_from: '2026-01-01',
    valid_until: '2026-12-31',
    registration_required: false,
    offer_status: 'ACTIVE',
    confidence: 'VERIFIED',
  },
  {
    offer_id: 'OFFER_SWIGGY_HDFC_10PCT',
    merchant_name: 'Swiggy',
    bank_name: 'HDFC',
    eligible_card_variants: 'hdfc-swiggy',
    eligible_networks: 'ALL',
    offer_category: 'Dining',
    benefit_type: 'PERCENTAGE_CASHBACK',
    discount_percentage: 0,
    cashback_percentage: 10,
    reward_points_multiplier: 1,
    fixed_discount_amount: 0,
    minimum_transaction_amount: 0,
    maximum_benefit: 1500,
    valid_from: '2026-01-01',
    valid_until: '2026-12-31',
    registration_required: false,
    offer_status: 'ACTIVE',
    confidence: 'VERIFIED',
  },
  {
    offer_id: 'OFFER_AIRTEL_AXIS_ZOMATO',
    merchant_name: 'Zomato',
    bank_name: 'AXIS',
    eligible_card_variants: 'axis-airtel',
    eligible_networks: 'ALL',
    offer_category: 'Dining',
    benefit_type: 'PERCENTAGE_CASHBACK',
    discount_percentage: 0,
    cashback_percentage: 10,
    reward_points_multiplier: 1,
    fixed_discount_amount: 0,
    minimum_transaction_amount: 499,
    maximum_benefit: 200,
    valid_from: '2026-01-01',
    valid_until: '2026-12-31',
    registration_required: false,
    offer_status: 'ACTIVE',
    confidence: 'VERIFIED',
  },
  {
    offer_id: 'OFFER_EXPIRED_FLIPKART_AXIS',
    merchant_name: 'Flipkart',
    bank_name: 'AXIS',
    eligible_card_variants: 'all',
    eligible_networks: 'ALL',
    offer_category: 'Shopping',
    benefit_type: 'INSTANT_DISCOUNT',
    discount_percentage: 10,
    cashback_percentage: 0,
    reward_points_multiplier: 1,
    fixed_discount_amount: 0,
    minimum_transaction_amount: 5000,
    maximum_benefit: 1250,
    valid_from: '2026-08-01',
    valid_until: '2026-09-30',
    registration_required: false,
    offer_status: 'EXPIRED',
    confidence: 'SAMPLE',
  },
  {
    offer_id: 'OFFER_ICICI_RUPAY_BLINKIT_15PCT',
    merchant_name: 'Blinkit',
    bank_name: 'ICICI',
    eligible_card_variants: 'all',
    eligible_networks: 'RUPAY',
    offer_category: 'Grocery',
    benefit_type: 'INSTANT_DISCOUNT',
    discount_percentage: 15,
    cashback_percentage: 0,
    reward_points_multiplier: 1,
    fixed_discount_amount: 0,
    minimum_transaction_amount: 750,
    maximum_benefit: 150,
    valid_from: '2026-01-01',
    valid_until: '2026-12-31',
    registration_required: false,
    offer_status: 'ACTIVE',
    confidence: 'VERIFIED',
  },
  {
    offer_id: 'OFFER_AMEX_MULTIPLIER_APPLE',
    merchant_name: 'Apple',
    bank_name: 'AMEX',
    eligible_card_variants: 'amex-platinum-travel',
    eligible_networks: 'AMEX',
    offer_category: 'Shopping',
    benefit_type: 'REWARD_POINTS_MULTIPLIER',
    discount_percentage: 0,
    cashback_percentage: 0,
    reward_points_multiplier: 5,
    fixed_discount_amount: 0,
    minimum_transaction_amount: 5000,
    maximum_benefit: 25000,
    valid_from: '2026-01-01',
    valid_until: '2026-12-31',
    registration_required: true,
    required_brand_name: 'Amex Reward Multiplier',
    portal_url: 'https://www.rewardmultiplier.americanexpress.com',
    offer_status: 'ACTIVE',
    confidence: 'VERIFIED',
  },
];

describe('Intelligent Offer Matching Engine Tests', () => {
  // Scenario 1: Multiple cards from different banks
  it('Scenario 1: Evaluates and ranks multiple cards from different banks accurately', () => {
    const userCards: UserCardWithMeta[] = [
      { id: 'uc-1', card_id: 'icici-amazon-pay', credit_cards: mockCards['icici-amazon-pay'] },
      { id: 'uc-2', card_id: 'hdfc-infinia', credit_cards: mockCards['hdfc-infinia'] },
    ];

    // Amazon transaction for ₹6,000
    // HDFC has 10% instant discount (₹600 savings)
    // ICICI Amazon Pay has 5% cashback (₹300 savings)
    const report = evaluateTransactionOffers({
      merchant: 'Amazon',
      amount: 6000,
      userCards,
      availableOffers: mockOffers,
      cardCatalogue: cardMap,
    });

    expect(report.recommendedCard).toBeDefined();
    expect(report.recommendedCard?.cardId).toBe('hdfc-infinia');
    expect(report.recommendedCard?.benefit.instantDiscount).toBe(600);
    expect(report.eligibleCards[0].benefit.netBenefitINR).toBe(600);
    expect(report.eligibleCards[1].benefit.netBenefitINR).toBe(300);
  });

  // Scenario 2: Same bank with different card variants
  it('Scenario 2: Differentiates card variants from the same bank (Amazon Pay vs Coral)', () => {
    const userCards: UserCardWithMeta[] = [
      { id: 'uc-1', card_id: 'icici-amazon-pay', credit_cards: mockCards['icici-amazon-pay'] },
      { id: 'uc-2', card_id: 'icici-coral', credit_cards: mockCards['icici-coral'] },
    ];

    const report = evaluateTransactionOffers({
      merchant: 'Amazon.in',
      amount: 4000,
      userCards,
      availableOffers: mockOffers,
      cardCatalogue: cardMap,
    });

    // Amazon Pay ICICI matches the 5% cashback offer
    const amazonPayCard = report.eligibleCards.find(c => c.cardId === 'icici-amazon-pay');
    expect(amazonPayCard?.matchedOffer?.offer_id).toBe('OFFER_AMAZON_ICICI_PRIME');
    expect(amazonPayCard?.benefit.cashback).toBe(200);

    // ICICI Coral does not match the variant-specific offer and is flagged in ineligibleCards
    const coralCard = report.ineligibleCards.find(c => c.cardId === 'icici-coral');
    expect(coralCard).toBeDefined();
    expect(coralCard?.ineligibilityReason).toContain('Offer requires specific card variant');
  });

  // Scenario 3: Expired offers
  it('Scenario 3: Disqualifies expired offers and does not recommend them', () => {
    const expiredOffer = mockOffers.find(o => o.offer_id === 'OFFER_EXPIRED_FLIPKART_AXIS')!;
    const validity = checkOfferValidity(expiredOffer, '2026-10-31');
    expect(validity.valid).toBe(false);
    expect(validity.reason).toContain('EXPIRED');

    const userCards: UserCardWithMeta[] = [
      { id: 'uc-airtel', card_id: 'axis-airtel', credit_cards: mockCards['axis-airtel'] },
    ];

    const report = evaluateTransactionOffers({
      merchant: 'Flipkart',
      amount: 6000,
      transactionDate: '2026-10-31',
      userCards,
      availableOffers: mockOffers,
      cardCatalogue: cardMap,
    });

    // Expired offer should not be applied; card earns standard base rewards
    expect(report.recommendedCard?.matchedOffer).toBeUndefined();
    expect(report.recommendedCard?.benefit.isStandardBaseRate).toBe(true);
  });

  // Scenario 4: Invalid / Unknown merchant matches
  it('Scenario 4: Handles unknown merchants gracefully with base rewards only', () => {
    const userCards: UserCardWithMeta[] = [
      { id: 'uc-1', card_id: 'hdfc-infinia', credit_cards: mockCards['hdfc-infinia'] },
    ];

    const report = evaluateTransactionOffers({
      merchant: 'Local Hardware Store Pune',
      amount: 10000,
      userCards,
      availableOffers: mockOffers,
      cardCatalogue: cardMap,
    });

    expect(report.allMatchedOffers).toHaveLength(0);
    expect(report.recommendedCard?.matchedOffer).toBeUndefined();
    expect(report.recommendedCard?.benefit.isStandardBaseRate).toBe(true);
    // Infinia earns 5 pts per 100 INR = 500 pts (~₹500 value at 100 paise)
    expect(report.recommendedCard?.benefit.rewardPoints).toBe(500);
    expect(report.recommendedCard?.benefit.netBenefitINR).toBe(500);
  });

  // Scenario 5: Minimum spending requirements
  it('Scenario 5: Enforces minimum spending thresholds accurately', () => {
    const userCards: UserCardWithMeta[] = [
      { id: 'uc-1', card_id: 'hdfc-infinia', credit_cards: mockCards['hdfc-infinia'] },
    ];

    // Transaction below minimum spend of ₹5,000
    const reportBelow = evaluateTransactionOffers({
      merchant: 'Amazon',
      amount: 3000,
      userCards,
      availableOffers: mockOffers,
      cardCatalogue: cardMap,
    });

    // Card should be ineligible for the 10% offer due to spend requirement
    const ineligible = reportBelow.ineligibleCards.find(c => c.cardId === 'hdfc-infinia');
    expect(ineligible).toBeDefined();
    expect(ineligible?.ineligibilityReason).toContain('below minimum spend requirement');

    // Transaction at or above minimum spend of ₹5,000
    const reportAbove = evaluateTransactionOffers({
      merchant: 'Amazon',
      amount: 5000,
      userCards,
      availableOffers: mockOffers,
      cardCatalogue: cardMap,
    });
    expect(reportAbove.recommendedCard?.matchedOffer?.offer_id).toBe('OFFER_HDFC_AMAZON_10PCT');
    expect(reportAbove.recommendedCard?.benefit.instantDiscount).toBe(500);
  });

  // Scenario 6: Maximum cashback limits / caps
  it('Scenario 6: Correctly caps benefits at maximum cashback/discount limits', () => {
    const userCards: UserCardWithMeta[] = [
      { id: 'uc-1', card_id: 'axis-airtel', credit_cards: mockCards['axis-airtel'] },
    ];

    // Zomato offer: 10% cashback, capped at ₹200, min spend ₹499
    // On ₹5,000 spend: raw 10% is ₹500, but cap is ₹200
    const report = evaluateTransactionOffers({
      merchant: 'Zomato',
      amount: 5000,
      userCards,
      availableOffers: mockOffers,
      cardCatalogue: cardMap,
    });

    expect(report.recommendedCard?.benefit.cashback).toBe(200);
    expect(report.recommendedCard?.benefit.isCapped).toBe(true);
    expect(report.recommendedCard?.benefit.appliedCap).toBe(200);
  });

  // Scenario 7: Ineligible cards due to network mismatch
  it('Scenario 7: Rejects cards with wrong payment network (Visa vs RuPay)', () => {
    const userCards: UserCardWithMeta[] = [
      { id: 'uc-visa', card_id: 'icici-coral', credit_cards: mockCards['icici-coral'] }, // VISA
      { id: 'uc-rupay', card_id: 'icici-coral-rupay', credit_cards: mockCards['icici-coral-rupay'] }, // RUPAY
    ];

    // Blinkit ICICI offer requires RUPAY network
    const report = evaluateTransactionOffers({
      merchant: 'Blinkit',
      amount: 1000,
      userCards,
      availableOffers: mockOffers,
      cardCatalogue: cardMap,
    });

    const rupayCard = report.eligibleCards.find(c => c.cardId === 'icici-coral-rupay');
    expect(rupayCard?.matchedOffer?.offer_id).toBe('OFFER_ICICI_RUPAY_BLINKIT_15PCT');
    expect(rupayCard?.benefit.instantDiscount).toBe(150);

    const visaCard = report.ineligibleCards.find(c => c.cardId === 'icici-coral');
    expect(visaCard).toBeDefined();
    expect(visaCard?.ineligibilityReason).toContain('requires RUPAY network');
  });

  // Scenario 8: Merchant registration requirements
  it('Scenario 8: Integrates Brand Registration and generates reminders/portal links', () => {
    const userCards: UserCardWithMeta[] = [
      { id: 'uc-amex', card_id: 'amex-platinum-travel', credit_cards: mockCards['amex-platinum-travel'] },
    ];

    // Test 8A: User with verified registration
    const registrationsRegistered: BrandRegistration[] = [
      { brand_name: 'Amex Reward Multiplier', status: 'REGISTERED' },
    ];

    const reportRegistered = evaluateTransactionOffers({
      merchant: 'Apple',
      amount: 50000,
      userCards,
      availableOffers: mockOffers,
      cardCatalogue: cardMap,
      brandRegistrations: registrationsRegistered,
    });

    const reqRegistered = reportRegistered.recommendedCard?.registrationRequirement;
    expect(reqRegistered?.status).toBe('REGISTERED');
    expect(reqRegistered?.reminderMessage).toContain('Verified registered');

    // Test 8B: User without registration
    const reportMissing = evaluateTransactionOffers({
      merchant: 'Apple',
      amount: 50000,
      userCards,
      availableOffers: mockOffers,
      cardCatalogue: cardMap,
      brandRegistrations: [],
    });

    const reqMissing = reportMissing.recommendedCard?.registrationRequirement;
    expect(reqMissing?.status).toBe('MISSING');
    expect(reqMissing?.portalUrl).toContain('rewardmultiplier.americanexpress.com');
    expect(reqMissing?.reminderMessage).toContain('Enroll before purchase');
  });

  // Scenario 9: Multiple eligible offers picking the highest net value
  it('Scenario 9: Evaluates multiple offers and selects highest net monetary benefit', () => {
    const dualOffers: OfferRow[] = [
      {
        offer_id: 'OFFER_A',
        merchant_name: 'Flipkart',
        bank_name: 'HDFC',
        eligible_card_variants: 'all',
        eligible_networks: 'ALL',
        offer_category: 'Shopping',
        benefit_type: 'INSTANT_DISCOUNT',
        discount_percentage: 5,
        cashback_percentage: 0,
        reward_points_multiplier: 1,
        fixed_discount_amount: 0,
        minimum_transaction_amount: 1000,
        maximum_benefit: 1000,
        offer_status: 'ACTIVE',
        confidence: 'VERIFIED',
      },
      {
        offer_id: 'OFFER_B',
        merchant_name: 'Flipkart',
        bank_name: 'HDFC',
        eligible_card_variants: 'all',
        eligible_networks: 'ALL',
        offer_category: 'Shopping',
        benefit_type: 'INSTANT_DISCOUNT',
        discount_percentage: 10,
        cashback_percentage: 0,
        reward_points_multiplier: 1,
        fixed_discount_amount: 0,
        minimum_transaction_amount: 1000,
        maximum_benefit: 1500,
        offer_status: 'ACTIVE',
        confidence: 'VERIFIED',
      },
    ];

    const userCards: UserCardWithMeta[] = [
      { id: 'uc-1', card_id: 'hdfc-infinia', credit_cards: mockCards['hdfc-infinia'] },
    ];

    const report = evaluateTransactionOffers({
      merchant: 'Flipkart',
      amount: 10000,
      userCards,
      availableOffers: dualOffers,
      cardCatalogue: cardMap,
    });

    // Should choose OFFER_B (10% = ₹1,000) over OFFER_A (5% = ₹500)
    expect(report.recommendedCard?.matchedOffer?.offer_id).toBe('OFFER_B');
    expect(report.recommendedCard?.benefit.instantDiscount).toBe(1000);
  });

  // Scenario 10: Prevents double counting / stacking
  it('Scenario 10: Prevents unpermitted stacking of cashback and instant discount', () => {
    const card = mockCards['icici-amazon-pay'];
    const offer = mockOffers.find(o => o.offer_id === 'OFFER_AMAZON_ICICI_PRIME')!;

    const benefit = calculateOfferBenefit(10000, card, offer);
    expect(benefit.cashback).toBe(500);
    expect(benefit.instantDiscount).toBe(0);
    expect(benefit.rewardPoints).toBe(0);
    expect(benefit.netBenefitINR).toBe(500);
  });

  // Scenario 11: Empty or unavailable offer datasets
  it('Scenario 11: Safely handles empty or unavailable offer datasets without crashing', () => {
    const userCards: UserCardWithMeta[] = [
      { id: 'uc-1', card_id: 'hdfc-swiggy', credit_cards: mockCards['hdfc-swiggy'] },
    ];

    const report = evaluateTransactionOffers({
      merchant: 'Swiggy',
      amount: 1200,
      userCards,
      availableOffers: [],
      cardCatalogue: cardMap,
    });

    expect(report.allMatchedOffers).toHaveLength(0);
    expect(report.recommendedCard).toBeDefined();
    expect(report.recommendedCard?.benefit.isStandardBaseRate).toBe(true);
    expect(report.ineligibleCards).toHaveLength(0);
  });
});
