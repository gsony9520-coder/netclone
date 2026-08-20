import 'server-only';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

if (!url || !serviceKey) {
  // eslint-disable-next-line no-console
  console.warn('Supabase service role or URL missing. Admin operations will fail.');
}

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false },
});
