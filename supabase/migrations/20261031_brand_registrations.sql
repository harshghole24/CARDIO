-- ============================================================
-- CardIO - Brand Registration Tracker Migration
-- Tracks user registration for credit card accelerated campaigns
-- ============================================================

CREATE TABLE IF NOT EXISTS public.brand_registrations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_card_id        UUID REFERENCES public.user_cards(id) ON DELETE CASCADE,
  brand_name          TEXT NOT NULL,
  campaign_name       TEXT NOT NULL,
  status              TEXT DEFAULT 'PENDING', -- 'REGISTERED', 'PENDING', 'EXPIRED'
  portal_url          TEXT,
  multiplier_benefit  TEXT,
  valid_until         DATE,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

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
