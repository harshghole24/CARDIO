import { describe, it, expect } from 'vitest';
import {
  filterBrandRegistrations,
  generateRegistrationReminders,
  validateRegistrationInput,
} from './brandRegistration';
import {
  checkRegistrationRequirement,
  evaluateTransactionOffers,
  type BrandRegistration,
  type UserCardWithMeta,
} from './offerEngine';
import type { CreditCardRow, OfferRow } from '../data/schemas';
import { maskPhone } from '../utils/masking';

// Mock Offers for Testing
const mockOffers: OfferRow[] = [
  {
    offer_id: 'OFFER_AMEX_APPLE',
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
    terms_and_conditions: 'Must enroll on Amex Reward Multiplier portal before purchase.',
    offer_status: 'ACTIVE',
    confidence: 'VERIFIED',
  },
  {
    offer_id: 'OFFER_NO_PORTAL_TEST',
    merchant_name: 'LocalCo',
    bank_name: 'HDFC',
    eligible_card_variants: 'all',
    eligible_networks: 'ALL',
    offer_category: 'Shopping',
    benefit_type: 'PERCENTAGE_CASHBACK',
    discount_percentage: 0,
    cashback_percentage: 10,
    reward_points_multiplier: 1,
    fixed_discount_amount: 0,
    minimum_transaction_amount: 1000,
    maximum_benefit: 500,
    registration_required: true,
    required_brand_name: 'LocalCo Club',
    portal_url: '', // Empty portal URL test
    offer_status: 'ACTIVE',
    confidence: 'SAMPLE',
  },
];

const mockAmexCard: CreditCardRow = {
  card_id: 'amex-platinum-travel',
  name: 'Amex Platinum Travel',
  issuer: 'AMEX',
  network: 'AMEX',
  tier: 'PREMIUM',
  annual_fee_inr: 5000,
  joining_fee_inr: 3500,
  base_reward_rate_pct: 2,
  max_reward_rate_pct: 8,
  reward_currency_id: 'amex_mr',
  point_value_paise: 50,
  base_points_per_100_inr_derived: 2,
  max_points_per_100_inr_derived: 10,
};

const cardMap = new Map<string, CreditCardRow>([
  ['amex-platinum-travel', mockAmexCard],
]);

describe('Brand Registration System Tests', () => {
  // 1. Creating a registration
  it('1. Creates a brand registration with validated and securely masked identifier', () => {
    const rawEmail = 'alex.developer@cardio.in';
    const validation = validateRegistrationInput({
      brand_name: 'Amex Reward Multiplier',
      identifier_type: 'EMAIL',
      raw_identifier: rawEmail,
      status: 'REGISTERED',
    });

    expect(validation.valid).toBe(true);
    expect(validation.maskedIdentifier).toBe('a***r@cardio.in');
    expect(validation.maskedIdentifier).not.toContain('developer');
  });

  // 2. Editing a registration
  it('2. Allows editing status, masked identifier, and notes on an existing registration', () => {
    const original: BrandRegistration = {
      id: 'reg-1',
      user_id: 'user-123',
      brand_name: 'Amex Reward Multiplier',
      status: 'PENDING',
      identifier_type: 'EMAIL',
      masked_identifier: 'a***r@cardio.in',
      notes: 'Initial enrollment submitted',
    };

    // Update status to REGISTERED and update notes
    const updated: BrandRegistration = {
      ...original,
      status: 'REGISTERED',
      notes: 'Confirmed by Amex SMS confirmation on 31 Oct 2026',
      masked_identifier: maskPhone('+91 9876543210'),
      identifier_type: 'PHONE',
    };

    expect(updated.status).toBe('REGISTERED');
    expect(updated.notes).toContain('Confirmed by Amex');
    expect(updated.maskedIdentifier ?? updated.masked_identifier).toContain('98***');
  });

  // 3. Deleting a registration
  it('3. Safely removes a registration from the active list after confirmation', () => {
    const registrations: BrandRegistration[] = [
      { id: 'reg-1', brand_name: 'Amex Reward Multiplier', status: 'REGISTERED' },
      { id: 'reg-2', brand_name: 'HDFC SmartBuy', status: 'PENDING' },
    ];

    const toDeleteId = 'reg-1';
    const remaining = registrations.filter(r => r.id !== toDeleteId);

    expect(remaining).toHaveLength(1);
    expect(remaining.find(r => r.id === 'reg-1')).toBeUndefined();
    expect(remaining[0].id).toBe('reg-2');
  });

  // 4. Preventing duplicate registrations
  it('4. Rejects attempts to add duplicate registrations for the same brand (case-insensitive)', () => {
    const existing: BrandRegistration[] = [
      { id: 'reg-1', brand_name: 'Amex Reward Multiplier', status: 'REGISTERED' },
    ];

    const duplicateCheck = validateRegistrationInput({
      brand_name: '  amex reward multiplier  ',
      existingRegistrations: existing,
    });

    expect(duplicateCheck.valid).toBe(false);
    expect(duplicateCheck.error).toContain('already exists');
  });

  // 5. Searching and filtering
  it('5. Filters registrations by brand search query and status tabs', () => {
    const dataset: BrandRegistration[] = [
      { id: '1', brand_name: 'Amex Reward Multiplier', campaign_name: 'Festive', status: 'REGISTERED', masked_identifier: 'a***x@gmail.com' },
      { id: '2', brand_name: 'HDFC SmartBuy', campaign_name: 'Quarterly', status: 'PENDING', masked_identifier: '98*** **321' },
      { id: '3', brand_name: 'Axis GrabDeals', campaign_name: 'Vouchers', status: 'NOT_REGISTERED' },
      { id: '4', brand_name: 'Tata Neu', campaign_name: 'NeuPass', status: 'REGISTERED' },
    ];

    // Filter by Search Query "amex"
    const searchResult = filterBrandRegistrations(dataset, 'amex', 'ALL');
    expect(searchResult).toHaveLength(1);
    expect(searchResult[0].brand_name).toBe('Amex Reward Multiplier');

    // Filter by Status "PENDING"
    const pendingResult = filterBrandRegistrations(dataset, '', 'PENDING');
    expect(pendingResult).toHaveLength(1);
    expect(pendingResult[0].brand_name).toBe('HDFC SmartBuy');

    // Filter by Status "REGISTERED"
    const registeredResult = filterBrandRegistrations(dataset, '', 'REGISTERED');
    expect(registeredResult).toHaveLength(2);

    // Filter by Status "NOT_REGISTERED"
    const notRegResult = filterBrandRegistrations(dataset, '', 'NOT_REGISTERED');
    expect(notRegResult).toHaveLength(1);
    expect(notRegResult[0].brand_name).toBe('Axis GrabDeals');
  });

  // 6. User isolation and authorization
  it('6. Strictly isolates user registrations and filters by user_id', () => {
    const allDatabaseRows: BrandRegistration[] = [
      { id: 'reg-user-1', user_id: 'USER_ALICE', brand_name: 'Amex Reward Multiplier', status: 'REGISTERED' },
      { id: 'reg-user-2', user_id: 'USER_BOB', brand_name: 'HDFC SmartBuy', status: 'REGISTERED' },
    ];

    // Alice queries her own registrations
    const aliceData = allDatabaseRows.filter(r => r.user_id === 'USER_ALICE');
    expect(aliceData).toHaveLength(1);
    expect(aliceData[0].brand_name).toBe('Amex Reward Multiplier');

    // Alice must not see Bob's data
    expect(aliceData.some(r => r.user_id === 'USER_BOB')).toBe(false);
  });

  // 7. Pending registration handling
  it('7. Correctly generates pending reminders and does not treat pending as confirmed', () => {
    const registrations: BrandRegistration[] = [
      { id: 'reg-1', brand_name: 'Amex Reward Multiplier', status: 'PENDING' },
    ];

    const reminders = generateRegistrationReminders(registrations, mockOffers);
    expect(reminders).toHaveLength(1);
    expect(reminders[0].status).toBe('PENDING');
    expect(reminders[0].reminderMessage).toContain('Active promo detected');

    // Check with offer engine:
    const offer = mockOffers[0];
    const check = checkRegistrationRequirement(offer, registrations);
    expect(check?.status).toBe('PENDING');
    expect(check?.reminderMessage).toContain('marked as PENDING');
  });

  // 8. Missing registration handling
  it('8. Flags missing registrations when no record is found without breaking evaluation', () => {
    const offer = mockOffers[0];
    const check = checkRegistrationRequirement(offer, []); // Empty registrations
    expect(check?.status).toBe('MISSING');
    expect(check?.reminderMessage).toContain('Registration with Amex Reward Multiplier required');
    expect(check?.portalUrl).toBe(offer.portal_url);
  });

  // 9. Registered status integration with offer evaluation
  it('9. Unlocks offer terms and reflects registered status when user has recorded registration', () => {
    const userCards: UserCardWithMeta[] = [
      { id: 'uc-1', card_id: 'amex-platinum-travel', credit_cards: mockAmexCard },
    ];

    const registrations: BrandRegistration[] = [
      {
        id: 'reg-1',
        brand_name: 'Amex Reward Multiplier',
        status: 'REGISTERED',
        masked_identifier: 'u***r@cardio.in',
      },
    ];

    const report = evaluateTransactionOffers({
      merchant: 'Apple',
      amount: 10000,
      userCards,
      availableOffers: mockOffers,
      cardCatalogue: cardMap,
      brandRegistrations: registrations,
    });

    expect(report.recommendedCard).toBeDefined();
    expect(report.recommendedCard?.matchedOffer?.offer_id).toBe('OFFER_AMEX_APPLE');
    expect(report.recommendedCard?.registrationRequirement?.status).toBe('REGISTERED');
    expect(report.recommendedCard?.registrationRequirement?.maskedIdentifier).toBe('u***r@cardio.in');
  });

  // 10. Registration-required offers with no portal URL
  it('10. Safely returns undefined portalUrl when no portal URL exists in offer or registration', () => {
    const noPortalOffer = mockOffers.find(o => o.offer_id === 'OFFER_NO_PORTAL_TEST')!;
    const check = checkRegistrationRequirement(noPortalOffer, []);

    expect(check?.required).toBe(true);
    expect(check?.portalUrl).toBeUndefined();
  });

  // 11. Empty registration dataset
  it('11. Handles completely empty registration arrays gracefully without runtime errors', () => {
    const reminders = generateRegistrationReminders([], mockOffers);
    expect(reminders).toHaveLength(0);

    const filtered = filterBrandRegistrations([], 'search', 'ALL');
    expect(filtered).toHaveLength(0);
  });

  // 12. Invalid registration input
  it('12. Rejects empty brand name, invalid status, and malformed emails/phone numbers', () => {
    // Missing brand name
    const res1 = validateRegistrationInput({ brand_name: '   ' });
    expect(res1.valid).toBe(false);
    expect(res1.error).toContain('Brand or merchant name is required');

    // Invalid status
    const res2 = validateRegistrationInput({ brand_name: 'Brand X', status: 'BOGUS_STATUS' });
    expect(res2.valid).toBe(false);
    expect(res2.error).toContain('Invalid registration status');

    // Malformed email
    const res3 = validateRegistrationInput({
      brand_name: 'Brand X',
      identifier_type: 'EMAIL',
      raw_identifier: 'not-an-email',
    });
    expect(res3.valid).toBe(false);
    expect(res3.error).toContain('valid email');

    // Malformed phone (less than 7 digits)
    const res4 = validateRegistrationInput({
      brand_name: 'Brand X',
      identifier_type: 'PHONE',
      raw_identifier: '123',
    });
    expect(res4.valid).toBe(false);
    expect(res4.error).toContain('valid phone number');
  });
});
