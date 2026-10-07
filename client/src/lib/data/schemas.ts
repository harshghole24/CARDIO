import { z } from 'zod';

// ─── Zod Schemas matching actual CSV columns ────────────────────────────

export const CreditCardRowSchema = z.object({
  card_id: z.string().min(1),
  name: z.string().min(1),
  issuer: z.string().min(1),
  network: z.string(),
  tier: z.string(),
  annual_fee_inr: z.coerce.number().default(0),
  joining_fee_inr: z.coerce.number().default(0),
  fee_waiver_spend_inr: z.coerce.number().optional(),
  forex_markup_pct: z.coerce.number().optional(),
  base_reward_rate_pct: z.coerce.number().default(0),
  max_reward_rate_pct: z.coerce.number().default(0),
  reward_currency_id: z.string(),
  point_value_paise: z.coerce.number().default(0),
  base_points_per_100_inr_derived: z.coerce.number().default(0),
  max_points_per_100_inr_derived: z.coerce.number().default(0),
  earns_program_directly: z.string().optional(),
  source: z.string().optional(),
});
export type CreditCardRow = z.infer<typeof CreditCardRowSchema>;

export const CardProgramRatioRowSchema = z.object({
  card_id: z.string().min(1),
  reward_currency_id: z.string().min(1),
  program_id: z.string().min(1),
  points_in: z.coerce.number().min(1),
  points_out: z.coerce.number().min(0),
  out_per_1_in: z.coerce.number(),
  ratio_text: z.string(),
  min_transfer: z.coerce.number().default(0),
  annual_cap: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : Number(val)),
    z.number().optional()
  ),
  basis: z.string().optional(),
  confidence: z.string().default('UNKNOWN'),
  notes: z.string().optional(),
  source_url: z.string().optional(),
  as_of: z.string().optional(),
});
export type CardProgramRatioRow = z.infer<typeof CardProgramRatioRowSchema>;

export const AwardChartRowSchema = z.object({
  program_id: z.string().min(1),
  origin_iata: z.string().min(2),
  destination: z.string().min(2),
  cabin: z.string(),
  trip_type: z.string(),
  points_required: z.coerce.number().min(0),
  fare_tier: z.string().optional(),
  pricing_model: z.string().optional(),
  confidence: z.string().default('MEDIUM'),
  source_url: z.string().optional(),
  as_of: z.string().optional(),
  notes: z.string().optional(),
});
export type AwardChartRow = z.infer<typeof AwardChartRowSchema>;

export const AirportRowSchema = z.object({
  iata: z.string().min(2),
  name: z.string().min(1),
  city: z.string().min(1),
  country_code: z.string().min(2),
  category: z.string(),
  lat: z.coerce.number(),
  lon: z.coerce.number(),
});
export type AirportRow = z.infer<typeof AirportRowSchema>;

export const LoyaltyProgramRowSchema = z.object({
  program_id: z.string().min(1),
  name: z.string().min(1),
  type: z.string(),
  alliance_general_knowledge: z.string().optional(),
  currency_name: z.string(),
  india_status_notes: z.string().optional(),
});
export type LoyaltyProgramRow = z.infer<typeof LoyaltyProgramRowSchema>;

export const RewardCurrencyRowSchema = z.object({
  currency_id: z.string().min(1),
  name: z.string().min(1),
  issuer: z.string(),
  type: z.string(),
});
export type RewardCurrencyRow = z.infer<typeof RewardCurrencyRowSchema>;

export const TransferRouteCurrencyRowSchema = z.object({
  from_currency_id: z.string().min(1),
  to_program_id: z.string().min(1),
  points_in: z.coerce.number(),
  points_out: z.coerce.number(),
  ratio_text: z.string(),
  min_transfer: z.string().optional(),
  cap: z.string().optional(),
  transfer_time: z.string().optional(),
  ratio_scope: z.string().optional(),
  source_tier: z.string().optional(),
  source_url: z.string().optional(),
  as_of: z.string().optional(),
});
export type TransferRouteCurrencyRow = z.infer<typeof TransferRouteCurrencyRowSchema>;

export const MovieDiningBenefitRowSchema = z.object({
  card_id: z.string().min(1),
  category: z.string(),
  platform: z.string().optional(),
  benefit: z.string(),
  cap: z.string().optional(),
  source_url: z.string().optional(),
  confidence: z.string().default('MEDIUM'),
});
export type MovieDiningBenefitRow = z.infer<typeof MovieDiningBenefitRowSchema>;
