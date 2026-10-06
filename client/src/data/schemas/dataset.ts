import { z } from 'zod';

export const TransferPartnerSchema = z.object({
  partner_id: z.string(),
  ratio_from: z.number(),
  ratio_to: z.number(),
  min_transfer: z.number(),
  transfer_fee: z.number().optional(),
  transfer_time: z.string().optional(), // e.g., "Instant", "1-2 days"
  monthly_cap: z.number().optional(),
});

export const CreditCardSchema = z.object({
  id: z.string(),
  bank: z.string(),
  name: z.string(),
  network: z.enum(['Visa', 'Mastercard', 'Amex', 'RuPay', 'Diners Club']),
  annual_fee: z.number(),
  joining_fee: z.number(),
  fee_waiver_condition: z.string(),
  tier: z.enum(['entry', 'mid', 'premium', 'super-premium']),
  image_url: z.string().optional(),
  gradient: z.string().optional(), // Fallback if image_url is missing
  tags: z.array(z.string()),
  reward_currency: z.string(),
  earn_rate: z.object({
    base_rate: z.number(),
    per_rupees: z.number(),
    multipliers: z.record(z.string(), z.number()), // e.g. { "travel_portal": 5, "dining": 2 }
  }),
  caps: z.object({
    monthly_reward_cap: z.number().optional(),
    exclusions: z.array(z.string()), // e.g. ["fuel", "rent", "wallet"]
  }),
  point_value_in_rupees: z.number(),
  transfer_partners: z.array(TransferPartnerSchema).optional(),
  lounge_benefits: z.object({
    domestic: z.number(), // visits per year
    international: z.number(), // visits per year
    network: z.string().optional(), // Priority Pass, DreamFolks, etc.
    spend_condition: z.string().optional(),
  }).optional(),
  milestone_benefits: z.array(z.object({
    spend: z.number(),
    reward: z.string(),
  })).optional(),
  source_url: z.string(),
  last_checked: z.string(),
  verified: z.boolean(),
});

export const LoyaltyProgramSchema = z.object({
  id: z.string(),
  name: z.string(),
  currency_name: z.string(),
  type: z.enum(['airline', 'hotel']),
  alliance: z.string().optional(), // Star Alliance, Oneworld, SkyTeam
  source_url: z.string().optional(),
  last_checked: z.string(),
});

export const AwardChartSchema = z.object({
  id: z.string(),
  program_id: z.string(),
  route_type: z.enum(['domestic', 'international']),
  origin: z.string(),
  destination: z.string(),
  cabin_class: z.enum(['economy', 'business', 'first']),
  trip_type: z.enum(['one-way', 'return']),
  points_required: z.number(),
  taxes_fees_approx: z.number().optional(),
  pricing_model: z.enum(['fixed', 'distance', 'zone', 'dynamic']),
  notes: z.string().optional(),
  last_checked: z.string(),
});

export const CardDatasetSchema = z.array(CreditCardSchema);
export const ProgramsDatasetSchema = z.array(LoyaltyProgramSchema);
export const AwardsDatasetSchema = z.array(AwardChartSchema);
