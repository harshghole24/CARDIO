import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'server/.env' });

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

async function run() {
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('*');
  console.log('Profiles:', profiles, pErr);
  const { data: user_cards, error: cErr } = await supabase.from('user_cards').select('*');
  console.log('User Cards:', user_cards, cErr);
}
run();
