-- Supabase PostgreSQL Schema

-- 1. PROFILES
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  full_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CREDIT CARDS CATALOGUE (Public)
CREATE TABLE credit_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank TEXT NOT NULL,
  card_name TEXT NOT NULL,
  network TEXT NOT NULL, -- VISA, Mastercard, Amex, etc.
  annual_fee NUMERIC DEFAULT 0,
  reward_type TEXT NOT NULL, -- points, miles, cashback
  reward_rate JSONB, -- stores category-wise multiplier or fixed rate
  travel_benefits JSONB,
  lounge_access JSONB,
  milestone_rewards JSONB
);

-- 3. USER CARDS
CREATE TABLE user_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  card_id UUID REFERENCES credit_cards(id), -- Null if custom
  custom_bank TEXT,
  custom_card_name TEXT,
  custom_network TEXT,
  last_four_digits VARCHAR(4),
  credit_limit NUMERIC,
  billing_cycle_day INT,
  payment_due_day INT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CATEGORIES
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  icon TEXT
);

-- 5. TRANSACTIONS
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  user_card_id UUID REFERENCES user_cards(id) ON DELETE CASCADE,
  merchant TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  date DATE NOT NULL,
  category_id UUID REFERENCES categories(id),
  reward_earned NUMERIC DEFAULT 0,
  cashback_earned NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. AIRLINE LOYALTY PROGRAMS (Public)
CREATE TABLE airline_loyalty_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airline TEXT NOT NULL,
  program_name TEXT NOT NULL,
  points_name TEXT NOT NULL
);

-- 7. USER LOYALTY ACCOUNTS
CREATE TABLE user_loyalty_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  program_id UUID REFERENCES airline_loyalty_programs(id),
  membership_number TEXT,
  current_balance NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. TRAVEL GOALS
CREATE TABLE travel_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  departure TEXT NOT NULL,
  destination TEXT NOT NULL,
  departure_date DATE,
  return_date DATE,
  estimated_cash_fare NUMERIC,
  program_id UUID REFERENCES airline_loyalty_programs(id),
  target_points NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. BILLS
CREATE TABLE bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  user_card_id UUID REFERENCES user_cards(id) ON DELETE CASCADE,
  statement_date DATE,
  due_date DATE,
  amount_due NUMERIC,
  minimum_due NUMERIC,
  status TEXT DEFAULT 'Upcoming', -- Paid, Upcoming, Due Soon, Overdue
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- User Cards
CREATE POLICY "Users can view own cards" ON user_cards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cards" ON user_cards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cards" ON user_cards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cards" ON user_cards FOR DELETE USING (auth.uid() = user_id);

-- Add similar basic policies for other tables
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ==========================================
-- AUTHENTICATION TRIGGER
-- Automatically creates a profile when a new user signs up
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (new.id, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
