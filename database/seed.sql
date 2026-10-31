-- Seed Data for CardIO

-- 1. CREDIT CARDS CATALOGUE
INSERT INTO credit_cards (id, bank, card_name, network, annual_fee, reward_type, reward_rate, travel_benefits, lounge_access, milestone_rewards)
VALUES
(gen_random_uuid(), 'Axis Bank', 'Atlas', 'VISA', 5000, 'miles', 
  '{"travel": 5, "dining": 2, "base": 2}', 
  '{"airline_partners": ["Air India", "Singapore Airlines", "Emirates", "Qatar Airways"], "transfer_ratio": "1:2"}', 
  '{"domestic": 18, "international": 6}', 
  '{"750000": 5000, "1500000": 10000}'),

(gen_random_uuid(), 'SBI Card', 'Cashback', 'VISA', 999, 'cashback', 
  '{"online": 5, "offline": 1, "base": 1}', 
  '{}', 
  '{"domestic": 4}', 
  '{}'),

(gen_random_uuid(), 'ICICI Bank', 'Amazon Pay', 'VISA', 0, 'cashback', 
  '{"amazon": 5, "partner": 2, "base": 1}', 
  '{}', 
  '{}', 
  '{}'),

(gen_random_uuid(), 'HDFC Bank', 'Regalia Gold', 'VISA', 2500, 'points', 
  '{"retail": 4, "marks_and_spencer": 20, "base": 4}', 
  '{"airline_partners": ["Air India", "Singapore Airlines"], "transfer_ratio": "1:0.5"}', 
  '{"domestic": 12, "international": 6}', 
  '{"150000": 1500, "800000": 5000}');

-- 2. CATEGORIES
INSERT INTO categories (name, icon) VALUES
('Travel', 'Plane'),
('Dining', 'Utensils'),
('Shopping', 'ShoppingBag'),
('Grocery', 'ShoppingCart'),
('Fuel', 'Fuel'),
('Entertainment', 'Ticket'),
('Online', 'Globe');

-- 3. AIRLINE LOYALTY PROGRAMS
INSERT INTO airline_loyalty_programs (id, airline, program_name, points_name)
VALUES
(gen_random_uuid(), 'Air India', 'Maharaja Club', 'Points'),
(gen_random_uuid(), 'IndiGo', 'BluChip', 'BluChips'),
(gen_random_uuid(), 'Emirates', 'Skywards', 'Miles'),
(gen_random_uuid(), 'Qatar Airways', 'Privilege Club', 'Avios'),
(gen_random_uuid(), 'Singapore Airlines', 'KrisFlyer', 'Miles');
