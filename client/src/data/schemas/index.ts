import { z } from 'zod';

export const TransferPartnerSchema = z.object({
  partner_id: z.string(),
  ratio_from: z.number(),
  ratio_to: z.number(),
  min_transfer: z.number(),
  transfer_fee: z.number().optional(),
  transfer_time: z.string().optional(),
  monthly_cap: z.number().optional(),
});

export const CreditCardSchema = z.object({
  id: z.string(),
  bank: z.string(),
  name: z.string(),
  network: z.enum(['Visa', 'Mastercard', 'Amex', 'RuPay', 'Diners Club']),
  annual_fee: z.number(),
  joining_fee: z.number(),
  fee_waiver_condition: z.string().optional(),
  tier: z.enum(['entry', 'mid', 'premium', 'super-premium']),
  image_url: z.string().optional(),
  tags: z.array(z.string()),
  reward_currency: z.string(),
  earn_rate: z.object({
    base_rate: z.number(),
    base_spend: z.number(),
    multipliers: z.record(z.string(), z.number()).optional(),
  }),
  earn_caps: z.record(z.string(), z.number()).optional(),
  point_value_in_rupees: z.number(),
  transfer_partners: z.array(TransferPartnerSchema).optional(),
  lounge_benefits: z.string().optional(),
  milestone_benefits: z.string().optional(),
  welcome_benefits: z.string().optional(),
  source_url: z.string(),
  last_checked: z.string(),
  verified: z.boolean(),
});

export const LoyaltyProgramSchema = z.object({
  id: z.string(),
  name: z.string(),
  currency_name: z.string(),
  category: z.enum(['airline', 'hotel']),
});

export const AwardRouteSchema = z.object({
  origin: z.string(),
  destination: z.string(),
  cabin: z.enum(['economy', 'business', 'first']),
  type: z.enum(['one-way', 'return']),
  points_required: z.number(),
  taxes_notes: z.string().optional(),
  is_approximate: z.boolean(),
});

export const AwardChartSchema = z.object({
  program_id: z.string(),
  pricing_model: z.enum(['distance-based', 'zone-based', 'dynamic', 'fixed']),
  popular_routes: z.array(AwardRouteSchema),
  last_checked: z.string(),
});

export const OtherRewardsSchema = z.object({
  category: z.enum(['movies', 'dining', 'shopping', 'fuel', 'lounge', 'vouchers']),
  card_id: z.string(),
  benefit: z.string(),
  value_estimate: z.number().optional(),
  caps: z.string().optional(),
  source_url: z.string(),
  last_checked: z.string(),
  verified: z.boolean(),
});

export const DatabaseSchema = z.object({
  cards: z.array(CreditCardSchema),
  programs: z.array(LoyaltyProgramSchema),
  award_charts: z.array(AwardChartSchema),
  other_rewards: z.array(OtherRewardsSchema),
});
