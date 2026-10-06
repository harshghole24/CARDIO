import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const email = `test.user.${Date.now()}@gmail.com`;
  const password = 'testpassword123';
  
  console.log("Signing up...");
  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: 'Test User' }
    }
  });
  
  if (authErr) {
    console.error("Sign up error:", authErr);
    return;
  }
  
  console.log("Signed up user:", authData.user?.id);
  
  const token = authData.session?.access_token;
  if (!token) {
    console.log("No token, maybe confirm email required?");
    // Try to login?
    return;
  }
  
  const userClient = createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  });
  
  console.log("Trying to upsert profile...");
  const { data: pData, error: pErr } = await userClient.from('profiles').upsert({
    id: authData.user!.id,
    full_name: 'Test Upsert User',
    updated_at: new Date().toISOString()
  }).select();
  
  if (pErr) {
    console.error("UPSERT ERROR:", pErr);
  } else {
    console.log("UPSERT SUCCESS:", pData);
  }
}

run();
