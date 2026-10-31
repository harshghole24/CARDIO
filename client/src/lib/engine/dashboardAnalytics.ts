import type { CreditCardRow, OfferRedemptionRow, OfferRow } from '../data/schemas';

export type DateRangePreset =
  | 'LAST_7_DAYS'
  | 'LAST_30_DAYS'
  | 'LAST_3_MONTHS'
  | 'LAST_6_MONTHS'
  | 'THIS_YEAR'
  | 'ALL_TIME'
  | 'CUSTOM';

export interface DateFilterOptions {
  preset: DateRangePreset;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
}

export interface SpendingKPIs {
  currentMonthSpend: number;
  prevMonthSpend: number;
  spendChangeMoM: number | null; // e.g. +14.2 or -5.1
  currentYearSpend: number;
  totalAllTimeSpend: number;
  totalTransactionsCount: number;
  confirmedSavingsINR: number;
  confirmedDiscountINR: number;
  confirmedCashbackINR: number;
  confirmedRewardPoints: number;
  confirmedRewardPointsValueINR: number;
  pendingCashbackINR: number;
  estimatedPotentialSavingsINR: number;
  activeCardsCount: number;
  redeemedOffersCount: number;
  savedOffersCount: number;
  appliedOffersCount: number;
}

export interface CardPerformanceMetrics {
  cardId: string;
  userCardId?: string;
  cardName: string;
  issuer: string;
  totalSpend: number;
  transactionCount: number;
  confirmedDiscountINR: number;
  confirmedCashbackINR: number;
  confirmedRewardPoints: number;
  confirmedSavingsINR: number;
  estimatedSavingsINR: number;
  effectiveReturnRatePct: number;
  isMostUsed?: boolean;
  isHighestSpend?: boolean;
  isHighestSavings?: boolean;
  isBestReturnRate?: boolean;
}

export interface OfferPerformanceMetrics {
  savedCount: number;
  appliedCount: number;
  redeemedCount: number;
  pendingCashbackCount: number;
  notRedeemedCount: number;
  expiredCount: number;
  totalTrackedOffers: number;
  redemptionSuccessRatePct: number;
  confirmedSavingsByMerchant: Array<{ merchant: string; savingsINR: number; count: number }>;
  confirmedSavingsByCategory: Array<{ category: string; savingsINR: number; count: number }>;
}

export interface TravelGoalProgress {
  id?: string;
  departure: string;
  destination: string;
  targetPoints: number;
  currentPoints: number;
  progressPct: number;
  remainingPoints: number;
  cabin?: string;
  targetDate?: string;
  programName?: string;
}

/**
 * Filters transactions based on date preset or custom range.
 */
export function filterTransactionsByDateRange(
  transactions: any[],
  filter: DateFilterOptions,
  now: Date = new Date()
): any[] {
  if (filter.preset === 'ALL_TIME') return transactions;

  let startStr = '';
  let endStr = now.toISOString().split('T')[0];

  if (filter.preset === 'CUSTOM') {
    startStr = filter.startDate || '1970-01-01';
    endStr = filter.endDate || endStr;
  } else if (filter.preset === 'LAST_7_DAYS') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    startStr = d.toISOString().split('T')[0];
  } else if (filter.preset === 'LAST_30_DAYS') {
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    startStr = d.toISOString().split('T')[0];
  } else if (filter.preset === 'LAST_3_MONTHS') {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 3);
    startStr = d.toISOString().split('T')[0];
  } else if (filter.preset === 'LAST_6_MONTHS') {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 6);
    startStr = d.toISOString().split('T')[0];
  } else if (filter.preset === 'THIS_YEAR') {
    startStr = `${now.getFullYear()}-01-01`;
  }

  return transactions.filter(t => {
    const d = t.date ? t.date.split('T')[0] : '';
    if (!d) return false;
    return d >= startStr && d <= endStr;
  });
}

/**
 * Filter transactions by date range, category, and card.
 */
export function filterTransactions(
  transactions: any[],
  options: {
    dateFilter: DateFilterOptions;
    category?: string;
    userCardId?: string;
  },
  now: Date = new Date()
): any[] {
  let list = filterTransactionsByDateRange(transactions, options.dateFilter, now);

  if (options.category && options.category !== 'ALL') {
    const targetCat = options.category.toUpperCase().trim();
    list = list.filter(t => {
      const cat = (t.category_id || t.category || '').toUpperCase().trim();
      return cat === targetCat;
    });
  }

  if (options.userCardId && options.userCardId !== 'ALL') {
    list = list.filter(t => {
      return (
        t.user_card_id === options.userCardId ||
        t.user_cards?.id === options.userCardId ||
        t.card === options.userCardId
      );
    });
  }

  return list;
}

/**
 * Computes high-level Dashboard KPIs from transactions, user cards, and redemptions.
 */
export function computeDashboardKPIs(
  transactions: any[],
  userCards: any[],
  redemptions: OfferRedemptionRow[],
  cardCatalogue: Map<string, CreditCardRow>,
  now: Date = new Date()
): SpendingKPIs {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0 to 11

  const currentMonthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;

  const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
  const prevYear = prevMonthDate.getFullYear();
  const prevMonth = prevMonthDate.getMonth();
  const prevMonthStart = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-01`;
  const endOfPrevMonthDate = new Date(currentYear, currentMonth, 0);
  const prevMonthEnd = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(endOfPrevMonthDate.getDate()).padStart(2, '0')}`;

  const currentYearStart = `${currentYear}-01-01`;

  let currentMonthSpend = 0;
  let prevMonthSpend = 0;
  let currentYearSpend = 0;
  let totalAllTimeSpend = 0;
  let totalTxnRewards = 0;

  for (const t of transactions) {
    const amt = Number(t.amount) || 0;
    const tDate = t.date ? t.date.split('T')[0] : '';
    totalAllTimeSpend += amt;
    totalTxnRewards += Number(t.reward_earned) || 0;

    if (tDate >= currentMonthStart) {
      currentMonthSpend += amt;
    } else if (tDate >= prevMonthStart && tDate <= prevMonthEnd) {
      prevMonthSpend += amt;
    }

    if (tDate >= currentYearStart) {
      currentYearSpend += amt;
    }
  }

  let spendChangeMoM: number | null = null;
  if (prevMonthSpend > 0) {
    spendChangeMoM = Number((((currentMonthSpend - prevMonthSpend) / prevMonthSpend) * 100).toFixed(1));
  }

  // Deduplicate redemptions
  const seenRedemptionIds = new Set<string>();
  const uniqueRedemptions: OfferRedemptionRow[] = [];
  for (const r of redemptions) {
    const key = r.id || `${r.offer_id}::${r.transaction_id || 'saved'}`;
    if (!seenRedemptionIds.has(key)) {
      seenRedemptionIds.add(key);
      uniqueRedemptions.push(r);
    }
  }

  let confirmedDiscountINR = 0;
  let confirmedCashbackINR = 0;
  let confirmedOfferPoints = 0;
  let confirmedRewardPointsValueINR = 0;
  let pendingCashbackINR = 0;
  let estimatedPotentialSavingsINR = 0;

  let redeemedOffersCount = 0;
  let savedOffersCount = 0;
  let appliedOffersCount = 0;

  for (const r of uniqueRedemptions) {
    const status = r.status;
    const dbCard = r.card_id ? cardCatalogue.get(r.card_id) : undefined;
    const pointValuePaise = dbCard?.point_value_paise || 25;

    if (status === 'REDEEMED') {
      redeemedOffersCount++;
      const disc = Number(r.confirmed_discount) || 0;
      const cb = Number(r.confirmed_cashback) || 0;
      const pts = Number(r.confirmed_reward_points) || 0;
      const ptsVal = Math.round((pts * pointValuePaise) / 100);

      confirmedDiscountINR += disc;
      confirmedCashbackINR += cb;
      confirmedOfferPoints += pts;
      confirmedRewardPointsValueINR += ptsVal;
    } else if (status === 'PENDING_CASHBACK' || r.cashback_status === 'PENDING') {
      pendingCashbackINR += Number(r.estimated_cashback) || 0;
      const estPts = Number(r.estimated_reward_points) || 0;
      estimatedPotentialSavingsINR += (Number(r.estimated_discount) || 0) + (Number(r.estimated_cashback) || 0) + Math.round((estPts * pointValuePaise) / 100);
    } else if (status === 'SAVED') {
      savedOffersCount++;
      const estPts = Number(r.estimated_reward_points) || 0;
      estimatedPotentialSavingsINR += (Number(r.estimated_discount) || 0) + (Number(r.estimated_cashback) || 0) + Math.round((estPts * pointValuePaise) / 100);
    } else if (status === 'APPLIED') {
      appliedOffersCount++;
      const estPts = Number(r.estimated_reward_points) || 0;
      estimatedPotentialSavingsINR += (Number(r.estimated_discount) || 0) + (Number(r.estimated_cashback) || 0) + Math.round((estPts * pointValuePaise) / 100);
    }
  }

  const confirmedSavingsINR = confirmedDiscountINR + confirmedCashbackINR + confirmedRewardPointsValueINR;
  const totalConfirmedRewardPoints = totalTxnRewards + confirmedOfferPoints;

  return {
    currentMonthSpend: Math.round(currentMonthSpend),
    prevMonthSpend: Math.round(prevMonthSpend),
    spendChangeMoM,
    currentYearSpend: Math.round(currentYearSpend),
    totalAllTimeSpend: Math.round(totalAllTimeSpend),
    totalTransactionsCount: transactions.length,
    confirmedSavingsINR: Math.round(confirmedSavingsINR),
    confirmedDiscountINR: Math.round(confirmedDiscountINR),
    confirmedCashbackINR: Math.round(confirmedCashbackINR),
    confirmedRewardPoints: totalConfirmedRewardPoints,
    confirmedRewardPointsValueINR: Math.round(confirmedRewardPointsValueINR),
    pendingCashbackINR: Math.round(pendingCashbackINR),
    estimatedPotentialSavingsINR: Math.round(estimatedPotentialSavingsINR),
    activeCardsCount: userCards.length,
    redeemedOffersCount,
    savedOffersCount,
    appliedOffersCount,
  };
}

/**
 * Computes individual performance metrics for each credit card in the user's wallet.
 */
export function computeCardPerformanceMetrics(
  userCards: any[],
  transactions: any[],
  redemptions: OfferRedemptionRow[],
  cardCatalogue: Map<string, CreditCardRow>
): CardPerformanceMetrics[] {
  if (userCards.length === 0) return [];

  const metricsList: CardPerformanceMetrics[] = userCards.map(uc => {
    const dbCard = uc.card_id ? cardCatalogue.get(uc.card_id) : undefined;
    const cardName = dbCard?.name || uc.custom_card_name || uc.credit_cards?.name || 'Credit Card';
    const issuer = dbCard?.issuer || uc.custom_bank || uc.credit_cards?.issuer || 'Bank';
    const pointValuePaise = dbCard?.point_value_paise || 25;

    // Filter transactions for this card
    const cardTxns = transactions.filter(t =>
      t.user_card_id === uc.id ||
      t.user_cards?.id === uc.id ||
      (t.card && t.card.toLowerCase().includes(cardName.toLowerCase()))
    );

    const totalSpend = cardTxns.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const transactionCount = cardTxns.length;

    // Filter redemptions for this card
    const cardRedemptions = redemptions.filter(r =>
      r.user_card_id === uc.id ||
      r.card_id === uc.card_id
    );

    let confirmedDiscountINR = 0;
    let confirmedCashbackINR = 0;
    let confirmedRewardPoints = 0;
    let estimatedSavingsINR = 0;

    // Add transaction-level base rewards
    const txnRewardsEarned = cardTxns.reduce((sum, t) => sum + (Number(t.reward_earned) || 0), 0);
    confirmedRewardPoints += txnRewardsEarned;

    for (const r of cardRedemptions) {
      if (r.status === 'REDEEMED') {
        confirmedDiscountINR += Number(r.confirmed_discount) || 0;
        confirmedCashbackINR += Number(r.confirmed_cashback) || 0;
        confirmedRewardPoints += Number(r.confirmed_reward_points) || 0;
      } else if (r.status === 'SAVED' || r.status === 'APPLIED' || r.status === 'PENDING_CASHBACK') {
        const estDisc = Number(r.estimated_discount) || 0;
        const estCb = Number(r.estimated_cashback) || 0;
        const estPts = Number(r.estimated_reward_points) || 0;
        estimatedSavingsINR += estDisc + estCb + Math.round((estPts * pointValuePaise) / 100);
      }
    }

    const pointsValueINR = Math.round((confirmedRewardPoints * pointValuePaise) / 100);
    const confirmedSavingsINR = confirmedDiscountINR + confirmedCashbackINR + pointsValueINR;

    const effectiveReturnRatePct =
      totalSpend > 0 ? Number(((confirmedSavingsINR / totalSpend) * 100).toFixed(2)) : 0;

    return {
      cardId: uc.card_id || uc.id,
      userCardId: uc.id,
      cardName,
      issuer,
      totalSpend: Math.round(totalSpend),
      transactionCount,
      confirmedDiscountINR: Math.round(confirmedDiscountINR),
      confirmedCashbackINR: Math.round(confirmedCashbackINR),
      confirmedRewardPoints,
      confirmedSavingsINR: Math.round(confirmedSavingsINR),
      estimatedSavingsINR: Math.round(estimatedSavingsINR),
      effectiveReturnRatePct,
    };
  });

  // Calculate Highlights
  let maxTxns = -1;
  let maxSpend = -1;
  let maxSavings = -1;
  let bestReturn = -1;

  for (const m of metricsList) {
    if (m.transactionCount > maxTxns && m.transactionCount > 0) maxTxns = m.transactionCount;
    if (m.totalSpend > maxSpend && m.totalSpend > 0) maxSpend = m.totalSpend;
    if (m.confirmedSavingsINR > maxSavings && m.confirmedSavingsINR > 0) maxSavings = m.confirmedSavingsINR;
    if (m.effectiveReturnRatePct > bestReturn && m.effectiveReturnRatePct > 0) bestReturn = m.effectiveReturnRatePct;
  }

  return metricsList.map(m => ({
    ...m,
    isMostUsed: maxTxns > 0 && m.transactionCount === maxTxns,
    isHighestSpend: maxSpend > 0 && m.totalSpend === maxSpend,
    isHighestSavings: maxSavings > 0 && m.confirmedSavingsINR === maxSavings,
    isBestReturnRate: bestReturn > 0 && m.effectiveReturnRatePct === bestReturn,
  }));
}

/**
 * Computes offer performance analytics, breakdown by merchant/category, and success rate.
 */
export function computeOfferPerformanceMetrics(
  redemptions: OfferRedemptionRow[],
  offersCatalogue: OfferRow[] = [],
  cardCatalogue: Map<string, CreditCardRow> = new Map()
): OfferPerformanceMetrics {
  let savedCount = 0;
  let appliedCount = 0;
  let redeemedCount = 0;
  let pendingCashbackCount = 0;
  let notRedeemedCount = 0;
  let expiredCount = 0;

  const merchantSavingsMap = new Map<string, { savings: number; count: number }>();
  const categorySavingsMap = new Map<string, { savings: number; count: number }>();

  // Map offer_id to offer metadata
  const offerMetaMap = new Map<string, OfferRow>();
  for (const o of offersCatalogue) {
    offerMetaMap.set(o.offer_id, o);
  }

  for (const r of redemptions) {
    const status = r.status;
    const dbCard = r.card_id ? cardCatalogue.get(r.card_id) : undefined;
    const pointValPaise = dbCard?.point_value_paise || 25;

    if (status === 'SAVED') savedCount++;
    else if (status === 'APPLIED') appliedCount++;
    else if (status === 'REDEEMED') redeemedCount++;
    else if (status === 'PENDING_CASHBACK' || r.cashback_status === 'PENDING') pendingCashbackCount++;
    else if (status === 'NOT_REDEEMED') notRedeemedCount++;
    else if (status === 'EXPIRED') expiredCount++;

    if (status === 'REDEEMED') {
      const disc = Number(r.confirmed_discount) || 0;
      const cb = Number(r.confirmed_cashback) || 0;
      const pts = Number(r.confirmed_reward_points) || 0;
      const savings = disc + cb + Math.round((pts * pointValPaise) / 100);

      // Merchant
      const merch = (r.merchant_name || 'Other').trim();
      const currMerch = merchantSavingsMap.get(merch) || { savings: 0, count: 0 };
      currMerch.savings += savings;
      currMerch.count += 1;
      merchantSavingsMap.set(merch, currMerch);

      // Category
      const offerMeta = offerMetaMap.get(r.offer_id);
      const cat = offerMeta?.offer_category || 'Shopping';
      const currCat = categorySavingsMap.get(cat) || { savings: 0, count: 0 };
      currCat.savings += savings;
      currCat.count += 1;
      categorySavingsMap.set(cat, currCat);
    }
  }

  const totalTrackedOffers = redemptions.length;
  // Non-saved attempted redemptions
  const totalAttempted = redeemedCount + appliedCount + pendingCashbackCount + notRedeemedCount;
  const redemptionSuccessRatePct =
    totalAttempted > 0 ? Number(((redeemedCount / totalAttempted) * 100).toFixed(1)) : 0;

  const confirmedSavingsByMerchant = Array.from(merchantSavingsMap.entries())
    .map(([merchant, data]) => ({
      merchant,
      savingsINR: Math.round(data.savings),
      count: data.count,
    }))
    .sort((a, b) => b.savingsINR - a.savingsINR);

  const confirmedSavingsByCategory = Array.from(categorySavingsMap.entries())
    .map(([category, data]) => ({
      category,
      savingsINR: Math.round(data.savings),
      count: data.count,
    }))
    .sort((a, b) => b.savingsINR - a.savingsINR);

  return {
    savedCount,
    appliedCount,
    redeemedCount,
    pendingCashbackCount,
    notRedeemedCount,
    expiredCount,
    totalTrackedOffers,
    redemptionSuccessRatePct,
    confirmedSavingsByMerchant,
    confirmedSavingsByCategory,
  };
}

/**
 * Calculates travel goal completion percentage and remaining points.
 */
export function calculateTravelGoalProgress(
  goal: any,
  totalPointsEarned: number
): TravelGoalProgress {
  const target = Math.max(1, Number(goal?.target_points) || 1);
  const current = Math.max(0, totalPointsEarned);
  const progressPct = Math.min(100, Math.round((current / target) * 100));
  const remainingPoints = Math.max(0, target - current);

  return {
    id: goal?.id,
    departure: goal?.departure || 'BLR',
    destination: goal?.destination || 'LHR',
    targetPoints: target,
    currentPoints: current,
    progressPct,
    remainingPoints,
    cabin: goal?.cabin,
    targetDate: goal?.departure_date,
    programName: goal?.program_id,
  };
}
