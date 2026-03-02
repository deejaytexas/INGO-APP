import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string;
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    '⚠️  Missing Supabase credentials.\n' +
    'Copy .env.example → .env and fill in your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.\n' +
    'Get them at: supabase.com → your project → Settings → API'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,   // enough for smooth GPS updates
    },
  },
});
