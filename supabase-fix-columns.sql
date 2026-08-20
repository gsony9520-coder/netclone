-- Run this in Supabase SQL Editor → https://supabase.com/dashboard → Your Project → SQL Editor

ALTER TABLE movies ADD COLUMN IF NOT EXISTS is_series boolean DEFAULT false;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS episodes jsonb DEFAULT '[]'::jsonb;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS year integer;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS cast text;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS maturity text;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS maturity_detail text;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS genres text;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS mobile_poster_url text;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS mobile_backdrop_url text;
