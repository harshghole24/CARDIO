import { describe, it, expect } from 'vitest';
import { earnPoints, applyTransfer, requiredSpendForAward, monthsToGoal } from './travelPlanner';

describe('travelPlanner calculations', () => {
  const mockCard = {
    card_id: 'C1',
    name: 'Test Card',
    issuer: 'Test Bank',
    network: 'VISA',
    tier: 'PREMIUM',
    annual_fee_inr: 1000,
    joining_fee_inr: 0,
    base_reward_rate_pct: 2,
    max_reward_rate_pct: 2,
    reward_currency_id: 'CUR1',
    point_value_paise: 50,
    base_points_per_100_inr_derived: 4, // 4 pts per Rs 100
    max_points_per_100_inr_derived: 4,
  };

  const mockRatio = {
    card_id: 'C1',
    reward_currency_id: 'CUR1',
    program_id: 'P1',
    points_in: 1,
    points_out: 2,
    out_per_1_in: 2, // 1:2 ratio
    ratio_text: '1:2',
    min_transfer: 500,
    confidence: 'HIGH'
  };

  it('earnPoints calculates correctly', () => {
    // 1000 spend at 4 pts per 100 = 40 pts
    expect(earnPoints(1000, mockCard)).toBe(40);
  });

  it('applyTransfer respects min_transfer and ratio', () => {
    // 1200 points. Block is 500. Can transfer 2 blocks = 1000 points.
    // 1000 points * 2 (out_per_1_in) = 2000 miles.
    const result = applyTransfer(1200, mockRatio);
    expect(result.miles).toBe(2000);
    expect(result.actualBankPointsUsed).toBe(1000);
  });

  it('requiredSpendForAward calculates backward correctly', () => {
    // Target: 4000 miles.
    // Ratio 1:2 => 2000 bank points needed exactly.
    // Block size 500 => 2000 is a multiple of 500, so we need 2000 pts.
    // Earn rate: 4 pts per Rs 100 => 2000 / 4 * 100 = Rs 50,000 spend.
    const result = requiredSpendForAward(4000, mockCard, mockRatio);
    expect(result.spendInr).toBe(50000);
    expect(result.bankPointsNeeded).toBe(2000);
  });

  it('requiredSpendForAward handles rounding block correctly', () => {
    // Target: 4001 miles.
    // Ratio 1:2 => 2001 bank points needed.
    // Block size 500 => ceil(2001/500)*500 = 2500 bank points.
    // Spend: 2500 / 4 * 100 = Rs 62,500.
    const result = requiredSpendForAward(4001, mockCard, mockRatio);
    expect(result.spendInr).toBe(62500);
    expect(result.bankPointsNeeded).toBe(2500);
  });

  it('monthsToGoal calculates correctly', () => {
    const res = monthsToGoal(50000, 10000);
    expect(res.months).toBe(5);
    expect(res.achievable).toBe(true);
  });

  it('monthsToGoal handles unachievable', () => {
    const res = monthsToGoal(1000000, 1000);
    expect(res.achievable).toBe(false);
  });
});
