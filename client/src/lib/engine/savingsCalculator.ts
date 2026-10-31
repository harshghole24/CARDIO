import type { OfferLifecycleStatus, OfferRedemptionRow, CreditCardRow } from '../data/schemas';

export interface SavingsSummaryReport {
  totalConfirmedSavingsINR: number;
  totalConfirmedDiscountINR: number;
  totalConfirmedCashbackINR: number;
  totalConfirmedRewardPoints: number;
  totalConfirmedRewardPointsValueINR: number;
  totalPendingCashbackINR: number;
  totalEstimatedPotentialSavingsINR: number;
  redeemedOffersCount: number;
  pendingRedemptionsCount: number;
  appliedRedemptionsCount: number;
  savedOffersCount: number;
  bestPerformingCard?: {
    cardId: string;
    cardName: string;
    confirmedSavingsINR: number;
  };
  topMerchantsBySavings: Array<{
    merchant: string;
    confirmedSavingsINR: number;
    redemptionsCount: number;
  }>;
  monthlySavingsTrends: Array<{
    month: string; // YYYY-MM
    confirmedSavingsINR: number;
    confirmedPoints: number;
  }>;
}

/**
 * Valid lifecycle transitions for offer redemptions.
 */
export const VALID_LIFECYCLE_TRANSITIONS: Record<OfferLifecycleStatus, OfferLifecycleStatus[]> = {
  AVAILABLE: ['SAVED', 'APPLIED', 'EXPIRED'],
  SAVED: ['AVAILABLE', 'APPLIED', 'NOT_REDEEMED', 'EXPIRED'],
  APPLIED: ['REDEEMED', 'PENDING_CASHBACK', 'NOT_REDEEMED', 'EXPIRED'],
  PENDING_CASHBACK: ['REDEEMED', 'NOT_REDEEMED', 'EXPIRED'],
  REDEEMED: ['REDEEMED'], // Terminal confirmed status
  NOT_REDEEMED: ['NOT_REDEEMED', 'APPLIED'],
  EXPIRED: ['EXPIRED'],
};

/**
 * Validates if an offer status transition is allowed.
 */
export function isValidStatusTransition(
  currentStatus: OfferLifecycleStatus,
  nextStatus: OfferLifecycleStatus
): { valid: boolean; reason?: string } {
  if (currentStatus === nextStatus) {
    return { valid: true };
  }

  const allowed = VALID_LIFECYCLE_TRANSITIONS[currentStatus] || [];
  if (allowed.includes(nextStatus)) {
    return { valid: true };
  }

  return {
    valid: false,
    reason: `Invalid offer lifecycle transition from ${currentStatus} to ${nextStatus}. Allowed: ${allowed.join(', ') || 'none'}.`,
  };
}

/**
 * Calculates confirmed and pending savings across an array of offer redemption records.
 * Strictly adheres to fintech accounting rules:
 * - Never counts estimated benefits as confirmed.
 * - Prevents double counting between instant discounts and cashback.
 * - Uses card-specific point valuations in INR.
 * - Deduplicates records by ID.
 */
export function calculateSavingsSummary(
  redemptions: OfferRedemptionRow[],
  cardCatalogue: Map<string, CreditCardRow>
): SavingsSummaryReport {
  // Deduplicate by record ID
  const seenIds = new Set<string>();
  const uniqueRedemptions: OfferRedemptionRow[] = [];

  for (const r of redemptions) {
    const key = r.id || `${r.offer_id}::${r.transaction_id || 'saved'}`;
    if (!seenIds.has(key)) {
      seenIds.add(key);
      uniqueRedemptions.push(r);
    }
  }

  let totalConfirmedDiscountINR = 0;
  let totalConfirmedCashbackINR = 0;
  let totalConfirmedRewardPoints = 0;
  let totalConfirmedRewardPointsValueINR = 0;
  let totalPendingCashbackINR = 0;
  let totalEstimatedPotentialSavingsINR = 0;

  let redeemedOffersCount = 0;
  let pendingRedemptionsCount = 0;
  let appliedRedemptionsCount = 0;
  let savedOffersCount = 0;

  const cardSavingsMap = new Map<string, { cardId: string; cardName: string; savings: number }>();
  const merchantSavingsMap = new Map<string, { merchant: string; savings: number; count: number }>();
  const monthlyTrendsMap = new Map<string, { confirmedSavingsINR: number; confirmedPoints: number }>();

  for (const record of uniqueRedemptions) {
    const status = record.status;
    const dbCard = record.card_id ? cardCatalogue.get(record.card_id) : undefined;
    const pointValuePaise = dbCard?.point_value_paise || 25;

    // Track status counts
    if (status === 'REDEEMED') {
      redeemedOffersCount++;
    } else if (status === 'PENDING_CASHBACK') {
      pendingRedemptionsCount++;
    } else if (status === 'APPLIED') {
      appliedRedemptionsCount++;
    } else if (status === 'SAVED') {
      savedOffersCount++;
    }

    // 1. Confirmed Savings (ONLY when status is REDEEMED)
    if (status === 'REDEEMED') {
      const confDisc = Number(record.confirmed_discount) || 0;
      const confCb = Number(record.confirmed_cashback) || 0;
      const confPts = Number(record.confirmed_reward_points) || 0;
      const ptsValINR = Math.round((confPts * pointValuePaise) / 100);

      totalConfirmedDiscountINR += confDisc;
      totalConfirmedCashbackINR += confCb;
      totalConfirmedRewardPoints += confPts;
      totalConfirmedRewardPointsValueINR += ptsValINR;

      const recordConfirmedSavings = confDisc + confCb + ptsValINR;

      // Group by Card
      if (record.card_id) {
        const cardName = dbCard?.name || record.card_id;
        const curr = cardSavingsMap.get(record.card_id) || { cardId: record.card_id, cardName, savings: 0 };
        curr.savings += recordConfirmedSavings;
        cardSavingsMap.set(record.card_id, curr);
      }

      // Group by Merchant
      const merchantKey = (record.merchant_name || 'Other').trim();
      const currMerch = merchantSavingsMap.get(merchantKey) || { merchant: merchantKey, savings: 0, count: 0 };
      currMerch.savings += recordConfirmedSavings;
      currMerch.count += 1;
      merchantSavingsMap.set(merchantKey, currMerch);

      // Group by Month (using confirmation_date or redemption_date)
      const dateStr = record.confirmation_date || record.redemption_date || record.created_at;
      if (dateStr) {
        const monthKey = dateStr.slice(0, 7); // YYYY-MM
        const currMonth = monthlyTrendsMap.get(monthKey) || { confirmedSavingsINR: 0, confirmedPoints: 0 };
        currMonth.confirmedSavingsINR += recordConfirmedSavings;
        currMonth.confirmedPoints += confPts;
        monthlyTrendsMap.set(monthKey, currMonth);
      }
    }

    // 2. Pending Cashback
    if (status === 'PENDING_CASHBACK' || record.cashback_status === 'PENDING') {
      const pendingCb = Number(record.estimated_cashback) || 0;
      totalPendingCashbackINR += pendingCb;
    }

    // 3. Estimated Potential Benefits (Saved, Applied, or Pending)
    if (status === 'SAVED' || status === 'APPLIED' || status === 'PENDING_CASHBACK') {
      const estDisc = Number(record.estimated_discount) || 0;
      const estCb = Number(record.estimated_cashback) || 0;
      const estPts = Number(record.estimated_reward_points) || 0;
      const estPtsValINR = Math.round((estPts * pointValuePaise) / 100);
      totalEstimatedPotentialSavingsINR += (estDisc + estCb + estPtsValINR);
    }
  }

  const totalConfirmedSavingsINR =
    totalConfirmedDiscountINR + totalConfirmedCashbackINR + totalConfirmedRewardPointsValueINR;

  // Find Best-performing Card
  let bestPerformingCard: { cardId: string; cardName: string; confirmedSavingsINR: number } | undefined = undefined;
  for (const val of cardSavingsMap.values()) {
    if (!bestPerformingCard || val.savings > bestPerformingCard.confirmedSavingsINR) {
      bestPerformingCard = {
        cardId: val.cardId,
        cardName: val.cardName,
        confirmedSavingsINR: val.savings,
      };
    }
  }

  // Top Merchants sorted by confirmed savings descending
  const topMerchantsBySavings = Array.from(merchantSavingsMap.values())
    .sort((a, b) => b.savings - a.savings)
    .slice(0, 5)
    .map(m => ({
      merchant: m.merchant,
      confirmedSavingsINR: m.savings,
      redemptionsCount: m.count,
    }));

  // Monthly trends sorted chronologically
  const monthlySavingsTrends = Array.from(monthlyTrendsMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, data]) => ({
      month,
      confirmedSavingsINR: data.confirmedSavingsINR,
      confirmedPoints: data.confirmedPoints,
    }));

  return {
    totalConfirmedSavingsINR,
    totalConfirmedDiscountINR,
    totalConfirmedCashbackINR,
    totalConfirmedRewardPoints,
    totalConfirmedRewardPointsValueINR,
    totalPendingCashbackINR,
    totalEstimatedPotentialSavingsINR,
    redeemedOffersCount,
    pendingRedemptionsCount,
    appliedRedemptionsCount,
    savedOffersCount,
    bestPerformingCard,
    topMerchantsBySavings,
    monthlySavingsTrends,
  };
}
