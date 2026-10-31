import type { CreditCardRow, OfferRow } from '../data/schemas';

export interface UserCardWithMeta {
  id: string; // user_card id
  card_id: string; // catalogue card_id
  custom_card_name?: string;
  last_four_digits?: string;
  credit_cards?: CreditCardRow;
}

export interface BrandRegistration {
  id?: string;
  user_id?: string;
  user_card_id?: string | null;
  brand_name: string;
  campaign_name?: string | null;
  identifier_type?: 'EMAIL' | 'PHONE' | 'OTHER' | string;
  masked_identifier?: string | null;
  status: 'REGISTERED' | 'PENDING' | 'NOT_REGISTERED' | 'EXPIRED' | string;
  registration_date?: string | null;
  portal_url?: string | null;
  multiplier_benefit?: string | null;
  valid_until?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface OfferBenefitBreakdown {
  instantDiscount: number;
  cashback: number;
  rewardPoints: number;
  rewardPointsValueINR: number;
  netBenefitINR: number;
  isCapped: boolean;
  appliedCap?: number;
  effectiveReturnPct: number;
  appliedOffer?: OfferRow;
  isStandardBaseRate: boolean;
  explanation: string;
}

export interface CardEvaluationResult {
  userCardId: string;
  cardId: string;
  cardName: string;
  issuer: string;
  network: string;
  isEligible: boolean;
  ineligibilityReason?: string;
  matchedOffer?: OfferRow;
  benefit: OfferBenefitBreakdown;
  registrationRequirement?: {
    required: boolean;
    brandName: string;
    status: 'REGISTERED' | 'PENDING' | 'NOT_REGISTERED' | 'MISSING';
    portalUrl?: string;
    reminderMessage: string;
    maskedIdentifier?: string;
  };
}

export interface TransactionEvaluationParams {
  merchant: string;
  amount: number;
  category?: string;
  transactionDate?: string; // YYYY-MM-DD
  userCards: UserCardWithMeta[];
  availableOffers: OfferRow[];
  cardCatalogue: Map<string, CreditCardRow>;
  brandRegistrations?: BrandRegistration[];
  selectedUserCardId?: string;
}

export interface OfferEngineReport {
  merchant: string;
  normalizedMerchant: string;
  amount: number;
  category?: string;
  allMatchedOffers: OfferRow[];
  recommendedCard: CardEvaluationResult | null;
  selectedCardEvaluation: CardEvaluationResult | null;
  eligibleCards: CardEvaluationResult[];
  ineligibleCards: CardEvaluationResult[];
  potentialSavingsLost: number;
  summaryMessage: string;
}

/**
 * Normalizes merchant names and aliases to canonical merchant keys.
 */
export function normalizeMerchant(merchant: string): string {
  if (!merchant) return '';
  const m = merchant.trim().toLowerCase();

  if (m.includes('amazon')) return 'amazon';
  if (m.includes('flipkart')) return 'flipkart';
  if (m.includes('swiggy')) return 'swiggy';
  if (m.includes('district')) return 'district';
  if (m.includes('zomato')) return 'zomato';
  if (m.includes('blinkit') || m.includes('grofers')) return 'blinkit';
  if (m.includes('apple')) return 'apple';
  if (m.includes('makemytrip') || m === 'mmt') return 'makemytrip';
  if (m.includes('bookmyshow') || m === 'bms') return 'bookmyshow';
  if (m.includes('eazydiner')) return 'eazydiner';

  return m.replace(/[^a-z0-9]/g, '');
}

/**
 * Checks if an offer is currently valid on a given transaction date.
 */
export function checkOfferValidity(offer: OfferRow, transactionDate?: string): { valid: boolean; reason?: string } {
  if (offer.offer_status && offer.offer_status.toUpperCase() !== 'ACTIVE') {
    return { valid: false, reason: `Offer is marked as ${offer.offer_status.toUpperCase()}` };
  }

  const txnDateStr = transactionDate || new Date().toISOString().split('T')[0];
  const txnDate = new Date(txnDateStr);

  if (offer.valid_until) {
    const untilDate = new Date(offer.valid_until);
    if (txnDate > untilDate) {
      return { valid: false, reason: `Offer expired on ${offer.valid_until}` };
    }
  }

  if (offer.valid_from) {
    const fromDate = new Date(offer.valid_from);
    if (txnDate < fromDate) {
      return { valid: false, reason: `Offer starts on ${offer.valid_from}` };
    }
  }

  return { valid: true };
}

/**
 * Checks if a specific credit card is eligible for a given offer.
 */
export function checkCardOfferEligibility(
  card: CreditCardRow,
  offer: OfferRow,
  amount: number,
  transactionDate?: string
): { eligible: boolean; reason?: string } {
  // 1. Offer Validity / Expiry
  const validity = checkOfferValidity(offer, transactionDate);
  if (!validity.valid) {
    return { eligible: false, reason: validity.reason };
  }

  // 2. Bank Issuer Check
  const cardIssuer = (card.issuer || '').toLowerCase().trim();
  const offerBank = (offer.bank_name || '').toLowerCase().trim();
  const isBankMatch =
    cardIssuer.includes(offerBank) ||
    offerBank.includes(cardIssuer) ||
    (offerBank === 'amex' && cardIssuer.includes('american express')) ||
    (offerBank === 'american express' && cardIssuer === 'amex');

  if (!isBankMatch) {
    return {
      eligible: false,
      reason: `Card issuer is ${card.issuer}, but offer is exclusive to ${offer.bank_name}`,
    };
  }

  // 3. Card Variant Specificity Check
  const eligibleVariants = (offer.eligible_card_variants || 'all')
    .split(';')
    .map(v => v.trim().toLowerCase());

  if (!eligibleVariants.includes('all')) {
    const cardIdLower = (card.card_id || '').toLowerCase().trim();
    const isVariantMatch = eligibleVariants.some(v => v === cardIdLower || cardIdLower.includes(v));

    if (!isVariantMatch) {
      return {
        eligible: false,
        reason: `Offer requires specific card variant (${offer.eligible_card_variants}), not applicable to ${card.name}`,
      };
    }
  }

  // 4. Payment Network Check
  const eligibleNetworks = (offer.eligible_networks || 'ALL')
    .split(';')
    .map(n => n.trim().toUpperCase());

  if (!eligibleNetworks.includes('ALL')) {
    const cardNetwork = (card.network || '').trim().toUpperCase();
    if (!eligibleNetworks.includes(cardNetwork)) {
      return {
        eligible: false,
        reason: `Offer requires ${offer.eligible_networks} network; card network is ${card.network}`,
      };
    }
  }

  // 5. Minimum Spend Check
  if (offer.minimum_transaction_amount > 0 && amount < offer.minimum_transaction_amount) {
    return {
      eligible: false,
      reason: `Spend ₹${amount.toLocaleString('en-IN')} is below minimum spend requirement of ₹${offer.minimum_transaction_amount.toLocaleString('en-IN')}`,
    };
  }

  return { eligible: true };
}

/**
 * Checks brand registration status for offers requiring prior merchant/program registration.
 */
export function checkRegistrationRequirement(
  offer: OfferRow,
  brandRegistrations?: BrandRegistration[]
): {
  required: boolean;
  brandName: string;
  status: 'REGISTERED' | 'PENDING' | 'NOT_REGISTERED' | 'MISSING';
  portalUrl?: string;
  reminderMessage: string;
  maskedIdentifier?: string;
} | undefined {
  if (!offer.registration_required) return undefined;

  const brand = offer.required_brand_name || offer.merchant_name;
  const brandLower = brand.toLowerCase().trim();

  const userReg = (brandRegistrations || []).find(r =>
    r.brand_name.toLowerCase().trim().includes(brandLower) ||
    brandLower.includes(r.brand_name.toLowerCase().trim())
  );

  let status: 'REGISTERED' | 'PENDING' | 'NOT_REGISTERED' | 'MISSING' = 'MISSING';
  if (userReg) {
    const rawStatus = (userReg.status || '').toUpperCase().trim();
    if (rawStatus === 'REGISTERED') {
      status = 'REGISTERED';
    } else if (rawStatus === 'NOT_REGISTERED') {
      status = 'NOT_REGISTERED';
    } else {
      status = 'PENDING';
    }
  }

  let reminderMessage = '';
  if (status === 'REGISTERED') {
    reminderMessage = `Verified registered with ${brand}${userReg?.masked_identifier ? ` (${userReg.masked_identifier})` : ''}. Promotional offer criteria active.`;
  } else if (status === 'PENDING') {
    reminderMessage = `Registration with ${brand} is marked as PENDING. Complete enrolment on the merchant portal to guarantee benefits.`;
  } else if (status === 'NOT_REGISTERED') {
    reminderMessage = `You recorded that you are NOT registered with ${brand}. Enroll before transacting to activate this offer.`;
  } else {
    reminderMessage = `Registration with ${brand} required. Enroll before purchase to activate this offer.`;
  }

  const rawUrl = offer.portal_url || userReg?.portal_url;
  const portalUrl = rawUrl && rawUrl.trim().length > 0 ? rawUrl.trim() : undefined;

  return {
    required: true,
    brandName: brand,
    status,
    portalUrl,
    reminderMessage,
    maskedIdentifier: userReg?.masked_identifier || undefined,
  };
}

/**
 * Calculates benefit for an eligible card with an offer.
 */
export function calculateOfferBenefit(
  amount: number,
  card: CreditCardRow,
  offer: OfferRow
): OfferBenefitBreakdown {
  let instantDiscount = 0;
  let cashback = 0;
  let rewardPoints = 0;
  let isCapped = false;
  let appliedCap: number | undefined = undefined;

  const bType = (offer.benefit_type || '').toUpperCase();
  const maxBenefit = offer.maximum_benefit || 0;

  if (bType === 'INSTANT_DISCOUNT') {
    const raw = (amount * (offer.discount_percentage || 0)) / 100;
    if (maxBenefit > 0 && raw > maxBenefit) {
      instantDiscount = maxBenefit;
      isCapped = true;
      appliedCap = maxBenefit;
    } else {
      instantDiscount = Math.round(raw);
    }
  } else if (bType === 'PERCENTAGE_CASHBACK') {
    const raw = (amount * (offer.cashback_percentage || 0)) / 100;
    if (maxBenefit > 0 && raw > maxBenefit) {
      cashback = maxBenefit;
      isCapped = true;
      appliedCap = maxBenefit;
    } else {
      cashback = Math.round(raw);
    }
  } else if (bType === 'FIXED_DISCOUNT') {
    const raw = Math.min(amount, offer.fixed_discount_amount || 0);
    if (maxBenefit > 0 && raw > maxBenefit) {
      instantDiscount = maxBenefit;
      isCapped = true;
      appliedCap = maxBenefit;
    } else {
      instantDiscount = Math.round(raw);
    }
  } else if (bType === 'REWARD_POINTS_MULTIPLIER') {
    const basePtsPer100 = card.base_points_per_100_inr_derived || 2;
    const basePts = Math.floor((amount / 100) * basePtsPer100);
    const multiplier = offer.reward_points_multiplier || 1;
    const totalRaw = Math.floor(basePts * multiplier);
    const bonusPts = totalRaw - basePts;

    if (maxBenefit > 0 && bonusPts > maxBenefit) {
      rewardPoints = basePts + maxBenefit;
      isCapped = true;
      appliedCap = maxBenefit;
    } else {
      rewardPoints = totalRaw;
    }
  }

  // Calculate Reward Points valuation in INR
  const pointValuePaise = card.point_value_paise || 25;
  const rewardPointsValueINR = Math.round((rewardPoints * pointValuePaise) / 100);

  const netBenefitINR = instantDiscount + cashback + rewardPointsValueINR;
  const effectiveReturnPct = amount > 0 ? Number(((netBenefitINR / amount) * 100).toFixed(2)) : 0;

  let explanation = '';
  if (instantDiscount > 0) {
    explanation = `₹${instantDiscount.toLocaleString('en-IN')} instant discount applied (${offer.discount_percentage || 'fixed'}% off${isCapped ? `, capped at ₹${appliedCap}` : ''}).`;
  } else if (cashback > 0) {
    explanation = `₹${cashback.toLocaleString('en-IN')} cashback earned (${offer.cashback_percentage}% back${isCapped ? `, capped at ₹${appliedCap}` : ''}).`;
  } else if (rewardPoints > 0) {
    explanation = `${rewardPoints.toLocaleString('en-IN')} points earned (${offer.reward_points_multiplier}x multiplier, worth ~₹${rewardPointsValueINR.toLocaleString('en-IN')}).`;
  }

  return {
    instantDiscount,
    cashback,
    rewardPoints,
    rewardPointsValueINR,
    netBenefitINR,
    isCapped,
    appliedCap,
    effectiveReturnPct,
    appliedOffer: offer,
    isStandardBaseRate: false,
    explanation,
  };
}

/**
 * Calculates standard card base rewards when no promotional offer is active.
 */
export function calculateBaseBenefit(
  amount: number,
  card: CreditCardRow
): OfferBenefitBreakdown {
  let cashback = 0;
  let rewardPoints = 0;

  const isCashbackCard =
    card.reward_currency_id?.toLowerCase().includes('cashback') ||
    card.name?.toLowerCase().includes('cashback') ||
    card.name?.toLowerCase().includes('amazon pay');

  if (isCashbackCard) {
    const rate = card.base_reward_rate_pct || 1;
    cashback = Math.floor((amount * rate) / 100);
  } else {
    const ptsPer100 = card.base_points_per_100_inr_derived || 2;
    rewardPoints = Math.floor((amount / 100) * ptsPer100);
  }

  const pointValuePaise = card.point_value_paise || 25;
  const rewardPointsValueINR = Math.round((rewardPoints * pointValuePaise) / 100);
  const netBenefitINR = cashback + rewardPointsValueINR;
  const effectiveReturnPct = amount > 0 ? Number(((netBenefitINR / amount) * 100).toFixed(2)) : 0;

  const explanation = isCashbackCard
    ? `Standard base cashback of ₹${cashback.toLocaleString('en-IN')} (${card.base_reward_rate_pct}% rate).`
    : `Standard base earning of ${rewardPoints.toLocaleString('en-IN')} points (~₹${rewardPointsValueINR.toLocaleString('en-IN')}).`;

  return {
    instantDiscount: 0,
    cashback,
    rewardPoints,
    rewardPointsValueINR,
    netBenefitINR,
    isCapped: false,
    effectiveReturnPct,
    isStandardBaseRate: true,
    explanation,
  };
}

/**
 * Master Offer Evaluation and Recommendation Engine.
 */
export function evaluateTransactionOffers(
  params: TransactionEvaluationParams
): OfferEngineReport {
  const {
    merchant,
    amount,
    category,
    transactionDate,
    userCards,
    availableOffers = [],
    cardCatalogue,
    brandRegistrations = [],
    selectedUserCardId,
  } = params;

  const normMerchant = normalizeMerchant(merchant);

  // Filter offers matching merchant and currently valid
  const matchingOffers = availableOffers.filter(o => {
    const oNorm = normalizeMerchant(o.merchant_name);
    const matchesMerchant = oNorm === normMerchant || (normMerchant && oNorm.includes(normMerchant));
    if (!matchesMerchant) return false;
    const validity = checkOfferValidity(o, transactionDate);
    return validity.valid;
  });

  const eligibleCards: CardEvaluationResult[] = [];
  const ineligibleCards: CardEvaluationResult[] = [];

  for (const uc of userCards) {
    const dbCard = uc.credit_cards || cardCatalogue.get(uc.card_id);
    if (!dbCard) continue;

    // Check offers for this card
    const cardOffers = matchingOffers.filter(o => {
      const cardIssuer = (dbCard.issuer || '').toLowerCase();
      const offerBank = (o.bank_name || '').toLowerCase();
      return (
        cardIssuer.includes(offerBank) ||
        offerBank.includes(cardIssuer) ||
        (offerBank === 'amex' && cardIssuer.includes('american express'))
      );
    });

    let bestOfferBenefit: OfferBenefitBreakdown | null = null;
    let bestOffer: OfferRow | null = null;
    let cardIneligibilityReason: string | undefined = undefined;

    if (cardOffers.length > 0) {
      for (const offer of cardOffers) {
        const eligibility = checkCardOfferEligibility(dbCard, offer, amount, transactionDate);
        if (eligibility.eligible) {
          const benefit = calculateOfferBenefit(amount, dbCard, offer);
          // Pick offer with highest net benefit (avoiding double counting/unpermitted stacking)
          if (!bestOfferBenefit || benefit.netBenefitINR > bestOfferBenefit.netBenefitINR) {
            bestOfferBenefit = benefit;
            bestOffer = offer;
          }
        } else {
          cardIneligibilityReason = eligibility.reason;
        }
      }
    }

    if (bestOffer && bestOfferBenefit) {
      const regRequirement = checkRegistrationRequirement(bestOffer, brandRegistrations);
      eligibleCards.push({
        userCardId: uc.id,
        cardId: dbCard.card_id,
        cardName: dbCard.name,
        issuer: dbCard.issuer,
        network: dbCard.network,
        isEligible: true,
        matchedOffer: bestOffer,
        benefit: bestOfferBenefit,
        registrationRequirement: regRequirement,
      });
    } else {
      // If card was matched to an offer but failed conditions (e.g. min spend or variant)
      if (cardOffers.length > 0 && cardIneligibilityReason) {
        const baseBenefit = calculateBaseBenefit(amount, dbCard);
        ineligibleCards.push({
          userCardId: uc.id,
          cardId: dbCard.card_id,
          cardName: dbCard.name,
          issuer: dbCard.issuer,
          network: dbCard.network,
          isEligible: false,
          ineligibilityReason: cardIneligibilityReason,
          benefit: baseBenefit,
        });
      } else {
        // Card has no special offers for this merchant, earns base rewards
        const baseBenefit = calculateBaseBenefit(amount, dbCard);
        eligibleCards.push({
          userCardId: uc.id,
          cardId: dbCard.card_id,
          cardName: dbCard.name,
          issuer: dbCard.issuer,
          network: dbCard.network,
          isEligible: true,
          benefit: baseBenefit,
        });
      }
    }
  }

  // Sort eligible cards by Net Benefit in INR descending
  eligibleCards.sort((a, b) => b.benefit.netBenefitINR - a.benefit.netBenefitINR);

  const recommendedCard = eligibleCards.length > 0 ? eligibleCards[0] : null;

  const selectedCardEvaluation =
    eligibleCards.find(c => c.userCardId === selectedUserCardId) ||
    ineligibleCards.find(c => c.userCardId === selectedUserCardId) ||
    null;

  let potentialSavingsLost = 0;
  if (recommendedCard && selectedCardEvaluation && recommendedCard.userCardId !== selectedCardEvaluation.userCardId) {
    potentialSavingsLost = Math.max(0, recommendedCard.benefit.netBenefitINR - selectedCardEvaluation.benefit.netBenefitINR);
  }

  let summaryMessage = '';
  if (!recommendedCard) {
    summaryMessage = 'No cards available to evaluate for this transaction.';
  } else if (recommendedCard.matchedOffer) {
    summaryMessage = `Recommended: Use ${recommendedCard.cardName} for maximum benefit of ₹${recommendedCard.benefit.netBenefitINR.toLocaleString('en-IN')} (${recommendedCard.benefit.explanation})`;
  } else {
    summaryMessage = `No active merchant promotions found. ${recommendedCard.cardName} earns the highest standard return (~₹${recommendedCard.benefit.netBenefitINR.toLocaleString('en-IN')}).`;
  }

  return {
    merchant,
    normalizedMerchant: normMerchant,
    amount,
    category,
    allMatchedOffers: matchingOffers,
    recommendedCard,
    selectedCardEvaluation,
    eligibleCards,
    ineligibleCards,
    potentialSavingsLost,
    summaryMessage,
  };
}
