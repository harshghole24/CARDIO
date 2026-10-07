-- ============================================================
-- CardIO - Complete Supabase Setup (Run this ONCE in SQL Editor)
-- ============================================================

-- ── 1. PROFILES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Users can insert own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ── 2. USER_CARDS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_cards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id       TEXT,                    -- FK into CSV dataset (card_id field)
  custom_bank   TEXT,
  custom_card_name TEXT,
  custom_network TEXT,
  last_four_digits TEXT,
  credit_limit  NUMERIC,
  billing_cycle_day INT,
  payment_due_day INT,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_cards ENABLE ROW LEVEL SECURITY;

-- Unique: one user can't add the same catalogue card twice
CREATE UNIQUE INDEX IF NOT EXISTS user_cards_user_card_unique
  ON public.user_cards(user_id, card_id)
  WHERE card_id IS NOT NULL;

DROP POLICY IF EXISTS "Users can view own cards" ON public.user_cards;
CREATE POLICY "Users can view own cards"
  ON public.user_cards FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own cards" ON public.user_cards;
CREATE POLICY "Users can insert own cards"
  ON public.user_cards FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own cards" ON public.user_cards;
CREATE POLICY "Users can update own cards"
  ON public.user_cards FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own cards" ON public.user_cards;
CREATE POLICY "Users can delete own cards"
  ON public.user_cards FOR DELETE USING (auth.uid() = user_id);


-- ── 3. TRANSACTIONS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_card_id    UUID REFERENCES public.user_cards(id) ON DELETE SET NULL,
  merchant        TEXT NOT NULL,
  amount          NUMERIC NOT NULL,
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  category_id     TEXT,
  reward_earned   NUMERIC DEFAULT 0,
  cashback_earned NUMERIC DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
CREATE POLICY "Users can view own transactions"
  ON public.transactions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
CREATE POLICY "Users can insert own transactions"
  ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
CREATE POLICY "Users can update own transactions"
  ON public.transactions FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own transactions" ON public.transactions;
CREATE POLICY "Users can delete own transactions"
  ON public.transactions FOR DELETE USING (auth.uid() = user_id);


-- ── 4. TRAVEL_GOALS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.travel_goals (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  departure           TEXT NOT NULL,         -- IATA code
  destination         TEXT NOT NULL,         -- IATA code
  cabin               TEXT DEFAULT 'ECONOMY',
  trip_type           TEXT DEFAULT 'ONE_WAY',
  departure_date      DATE,
  return_date         DATE,
  program_id          TEXT,                  -- loyalty program ID from CSV
  target_points       NUMERIC DEFAULT 0,
  estimated_cash_fare NUMERIC,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.travel_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own travel goals" ON public.travel_goals;
CREATE POLICY "Users can view own travel goals"
  ON public.travel_goals FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own travel goals" ON public.travel_goals;
CREATE POLICY "Users can insert own travel goals"
  ON public.travel_goals FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own travel goals" ON public.travel_goals;
CREATE POLICY "Users can update own travel goals"
  ON public.travel_goals FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own travel goals" ON public.travel_goals;
CREATE POLICY "Users can delete own travel goals"
  ON public.travel_goals FOR DELETE USING (auth.uid() = user_id);


-- ── 5. GRANT permissions to authenticated role ───────────────
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.user_cards TO authenticated;
GRANT ALL ON public.transactions TO authenticated;
GRANT ALL ON public.travel_goals TO authenticated;
