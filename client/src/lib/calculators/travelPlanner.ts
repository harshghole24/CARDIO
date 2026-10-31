import type { CreditCardRow, CardProgramRatioRow } from '../data/schemas';

/**
 * 1. earnPoints
 * Given a spend amount and a card, how many bank points/miles are earned?
 * Uses the base rate: (spend / base_spend) * base_rate
 */
export function earnPoints(spendAmount: number, card: CreditCardRow): number {
  if (!card.base_points_per_100_inr_derived) return 0;
  // Use the exact derived rate per Rs 100 for simplicity and accuracy
  return (spendAmount / 100) * card.base_points_per_100_inr_derived;
}

/**
 * 2. applyTransfer
 * Convert bank points to program miles based on ratio.
 * Respects min_transfer (rounds up to the nearest multiple if needed).
 */
export function applyTransfer(
  bankPoints: number,
  ratio: CardProgramRatioRow
): { miles: number; actualBankPointsUsed: number; warning?: string } {
  // e.g. 1:2 means out_per_1_in = 2
  // We need to transfer in blocks of min_transfer if it exists, otherwise 1
  const block = ratio.min_transfer > 0 ? ratio.min_transfer : 1;
  
  // Need to find how many blocks we can form
  const blocksToTransfer = Math.floor(bankPoints / block);
  const actualBankPointsUsed = blocksToTransfer * block;
  
  const miles = actualBankPointsUsed * ratio.out_per_1_in;
  
  let warning = undefined;
  if (ratio.annual_cap && actualBankPointsUsed > ratio.annual_cap) {
     warning = `Exceeds annual transfer cap of ${ratio.annual_cap}`;
  }

  return { miles, actualBankPointsUsed, warning };
}

/**
 * 3. requiredSpendForAward
 * Given target miles needed, how much spend is required on this card?
 */
export function requiredSpendForAward(
  targetMiles: number,
  card: CreditCardRow,
  ratio: CardProgramRatioRow
): { spendInr: number; bankPointsNeeded: number; warning?: string } {
  if (ratio.out_per_1_in <= 0 || card.base_points_per_100_inr_derived <= 0) {
    return { spendInr: Infinity, bankPointsNeeded: Infinity, warning: 'No transfer path or zero earn rate' };
  }

  // 1. Exact bank points needed
  let rawBankPoints = Math.ceil(targetMiles / ratio.out_per_1_in);

  // 2. Adjust for min_transfer block multiples
  const block = ratio.min_transfer > 0 ? ratio.min_transfer : 1;
  const bankPointsNeeded = Math.ceil(rawBankPoints / block) * block;

  // 3. Convert to spend
  const earnRatePer100 = card.base_points_per_100_inr_derived;
  const spendInr = (bankPointsNeeded / earnRatePer100) * 100;

  let warning = undefined;
  if (ratio.annual_cap && bankPointsNeeded > ratio.annual_cap) {
     warning = `Requires ${bankPointsNeeded} pts, which exceeds the annual transfer cap of ${ratio.annual_cap}`;
  }

  return { spendInr, bankPointsNeeded, warning };
}

/**
 * 4. monthsToGoal
 * How many months to reach the required spend based on user's monthly spend?
 */
export function monthsToGoal(
  requiredSpendInr: number,
  monthlySpendInr: number
): { months: number; achievable: boolean; message: string } {
  if (monthlySpendInr <= 0) return { months: Infinity, achievable: false, message: 'Monthly spend is zero' };
  
  const months = Math.ceil(requiredSpendInr / monthlySpendInr);
  // Cap it at e.g. 60 months (5 years) for realism
  if (months > 60) {
    return { months, achievable: false, message: `Will take over 5 years (${months} months) at current spend.` };
  }
  
  return { months, achievable: true, message: `Achievable in ${months} months` };
}
