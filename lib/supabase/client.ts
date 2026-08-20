import { createClient } from '@supabase/supabase-js';

// Humne yahan direct sahi chaabiyaan (Keys) daal di hain taake Vercel fail na ho
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://cjvccnzjifbfadgompem.supabase.co";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_Jd6m3nJQxQndVu4SlWbuPA_uep5kcN7";

export const supabase = createClient(url, anon);
