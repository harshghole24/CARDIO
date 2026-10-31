-- ============================================================
-- CardIO - Offer Redemption & Savings Tracking Migration
-- Safe, additive migration supporting complete offer lifecycle
-- ============================================================

CREATE TABLE IF NOT EXISTS public.offer_redemptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  offer_id                TEXT NOT NULL,
  transaction_id          UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  user_card_id            UUID REFERENCES public.user_cards(id) ON DELETE SET NULL,
  card_id                 TEXT,
  merchant_name           TEXT NOT NULL,
  transaction_amount      NUMERIC DEFAULT 0,
  status                  TEXT NOT NULL DEFAULT 'SAVED',
  estimated_discount      NUMERIC DEFAULT 0,
  confirmed_discount      NUMERIC DEFAULT 0,
  estimated_cashback      NUMERIC DEFAULT 0,
  confirmed_cashback      NUMERIC DEFAULT 0,
  estimated_reward_points NUMERIC DEFAULT 0,
  confirmed_reward_points NUMERIC DEFAULT 0,
  cashback_status         TEXT DEFAULT 'NOT_APPLICABLE',
  redemption_date         DATE DEFAULT CURRENT_DATE,
  confirmation_date       DATE,
  notes                   TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Lifecycle status constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'offer_redemptions_status_check'
  ) THEN
    ALTER TABLE public.offer_redemptions
      ADD CONSTRAINT offer_redemptions_status_check
      CHECK (status IN (
        'AVAILABLE',
        'SAVED',
        'APPLIED',
        'REDEEMED',
        'PENDING_CASHBACK',
        'EXPIRED',
        'NOT_REDEEMED'
      ));
  END IF;
END $$;

-- Cashback status constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'offer_redemptions_cashback_status_check'
  ) THEN
    ALTER TABLE public.offer_redemptions
      ADD CONSTRAINT offer_redemptions_cashback_status_check
      CHECK (cashback_status IN ('NOT_APPLICABLE', 'PENDING', 'RECEIVED', 'FAILED'));
  END IF;
END $$;

-- Non-negative values constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'offer_redemptions_amounts_check'
  ) THEN
    ALTER TABLE public.offer_redemptions
      ADD CONSTRAINT offer_redemptions_amounts_check
      CHECK (
        transaction_amount >= 0 AND
        estimated_discount >= 0 AND
        confirmed_discount >= 0 AND
        estimated_cashback >= 0 AND
        confirmed_cashback >= 0 AND
        estimated_reward_points >= 0 AND
        confirmed_reward_points >= 0
      );
  END IF;
END $$;

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_offer_redemptions_user_id
  ON public.offer_redemptions(user_id);

CREATE INDEX IF NOT EXISTS idx_offer_redemptions_offer_id
  ON public.offer_redemptions(offer_id);

CREATE INDEX IF NOT EXISTS idx_offer_redemptions_transaction_id
  ON public.offer_redemptions(transaction_id);

CREATE INDEX IF NOT EXISTS idx_offer_redemptions_status
  ON public.offer_redemptions(status);

-- Prevent duplicate redemptions on the same transaction for the same offer
CREATE UNIQUE INDEX IF NOT EXISTS idx_offer_redemptions_txn_offer_unique
  ON public.offer_redemptions(transaction_id, offer_id)
  WHERE transaction_id IS NOT NULL;

-- Prevent duplicate saved offers for the same user
CREATE UNIQUE INDEX IF NOT EXISTS idx_offer_redemptions_user_offer_saved_unique
  ON public.offer_redemptions(user_id, offer_id)
  WHERE transaction_id IS NULL AND status = 'SAVED';

-- Row Level Security
ALTER TABLE public.offer_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own redemptions" ON public.offer_redemptions;
CREATE POLICY "Users can view own redemptions"
  ON public.offer_redemptions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own redemptions" ON public.offer_redemptions;
CREATE POLICY "Users can insert own redemptions"
  ON public.offer_redemptions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own redemptions" ON public.offer_redemptions;
CREATE POLICY "Users can update own redemptions"
  ON public.offer_redemptions FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own redemptions" ON public.offer_redemptions;
CREATE POLICY "Users can delete own redemptions"
  ON public.offer_redemptions FOR DELETE USING (auth.uid() = user_id);

GRANT ALL ON public.offer_redemptions TO authenticated;
