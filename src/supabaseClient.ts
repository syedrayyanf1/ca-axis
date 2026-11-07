import { createClient } from '@supabase/supabase-js';

const RAW_SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'vqsvtiptjllzgnorzemx';

export const SUPABASE_URL = RAW_SUPABASE_URL.startsWith('http')
  ? RAW_SUPABASE_URL
  : `https://${RAW_SUPABASE_URL}.supabase.co`;

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_Jm2ZDMlkZ1vAgrfFzU8aDA_N1sVvK2-';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
