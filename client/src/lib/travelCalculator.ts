export interface CardEarnRate {
    base_rate: number;
    base_spend: number;
    multipliers?: Record<string, number>;
}

export interface TransferPartner {
    partner_id: string;
    ratio_from: number;
    ratio_to: number;
}

/**
 * Forward Calculator
 * Given a spend amount and a card's earning rate, how many points are earned?
 */
export function calculatePointsEarned(spendAmount: number, earnRate: CardEarnRate, category: string = 'base'): number {
    const multiplier = earnRate.multipliers?.[category] || 1;
    const blocks = Math.floor(spendAmount / earnRate.base_spend);
    return blocks * earnRate.base_rate * multiplier;
}

/**
 * Convert bank points to airline miles
 */
export function convertPointsToMiles(points: number, partner: TransferPartner): number {
    const transferBlocks = Math.floor(points / partner.ratio_from);
    return transferBlocks * partner.ratio_to;
}

/**
 * Reverse Calculator
 * Given a target miles requirement (e.g. for a flight), how much spend is needed on a specific card?
 */
export function calculateRequiredSpend(
    targetMiles: number,
    partner: TransferPartner,
    earnRate: CardEarnRate,
    category: string = 'base'
): number {
    const multiplier = earnRate.multipliers?.[category] || 1;

    // 1. How many bank points are needed? (Round up to cover exact requirement based on transfer ratio)
    const requiredBankPoints = Math.ceil((targetMiles / partner.ratio_to) * partner.ratio_from);

    // 2. How many spend blocks to get those points?
    const pointsPerBlock = earnRate.base_rate * multiplier;
    const blocksNeeded = Math.ceil(requiredBankPoints / pointsPerBlock);

    // 3. Total exact spend required
    return blocksNeeded * earnRate.base_spend;
}
