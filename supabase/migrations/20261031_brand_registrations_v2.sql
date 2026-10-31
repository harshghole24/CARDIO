-- ============================================================
-- CardIO - Complete Brand Registration System Migration (v2)
-- Safe, idempotent migration preserving all existing records.
-- ============================================================

-- 1. Ensure table exists with core columns
CREATE TABLE IF NOT EXISTS public.brand_registrations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_card_id        UUID REFERENCES public.user_cards(id) ON DELETE SET NULL,
  brand_name          TEXT NOT NULL,
  campaign_name       TEXT,
  status              TEXT DEFAULT 'PENDING',
  portal_url          TEXT,
  multiplier_benefit  TEXT,
  valid_until         DATE,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add upgraded columns if they do not exist
ALTER TABLE public.brand_registrations
  ADD COLUMN IF NOT EXISTS identifier_type TEXT DEFAULT 'EMAIL',
  ADD COLUMN IF NOT EXISTS masked_identifier TEXT,
  ADD COLUMN IF NOT EXISTS registration_date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Relax campaign_name NOT NULL constraint if present from v1
ALTER TABLE public.brand_registrations
  ALTER COLUMN campaign_name DROP NOT NULL;

-- 4. Constraint on status: REGISTERED, PENDING, NOT_REGISTERED, EXPIRED
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'brand_registrations_status_check'
  ) THEN
    ALTER TABLE public.brand_registrations
      ADD CONSTRAINT brand_registrations_status_check
      CHECK (status IN ('REGISTERED', 'PENDING', 'NOT_REGISTERED', 'EXPIRED'));
  END IF;
END $$;

-- 5. Constraint on identifier_type: EMAIL, PHONE, OTHER
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'brand_registrations_identifier_type_check'
  ) THEN
    ALTER TABLE public.brand_registrations
      ADD CONSTRAINT brand_registrations_identifier_type_check
      CHECK (identifier_type IN ('EMAIL', 'PHONE', 'OTHER'));
  END IF;
END $$;

-- 6. Indexes for fast user queries and brand lookups
CREATE INDEX IF NOT EXISTS idx_brand_registrations_user_id 
  ON public.brand_registrations(user_id);

CREATE INDEX IF NOT EXISTS idx_brand_registrations_user_brand 
  ON public.brand_registrations(user_id, lower(trim(brand_name)));

-- 7. Unique index per user per brand (case-insensitive) to prevent accidental duplicate entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_brand_registrations_user_brand_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_brand_registrations_user_brand_unique 
      ON public.brand_registrations(user_id, lower(trim(brand_name)));
  END IF;
END $$;

-- 8. Row Level Security (RLS) policies
ALTER TABLE public.brand_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own registrations" ON public.brand_registrations;
CREATE POLICY "Users can view own registrations"
  ON public.brand_registrations FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own registrations" ON public.brand_registrations;
CREATE POLICY "Users can insert own registrations"
  ON public.brand_registrations FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own registrations" ON public.brand_registrations;
CREATE POLICY "Users can update own registrations"
  ON public.brand_registrations FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own registrations" ON public.brand_registrations;
CREATE POLICY "Users can delete own registrations"
  ON public.brand_registrations FOR DELETE USING (auth.uid() = user_id);

GRANT ALL ON public.brand_registrations TO authenticated;
