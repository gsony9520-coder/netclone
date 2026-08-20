import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MOVIE_SECTION_LINKS_KEY = 'movie_section_links';
const MOVIE_SECTION_LINKS_ORDER_KEY = 'movie_section_links_order';

function parseJson(raw: unknown) {
  const txt = typeof raw === 'string' ? raw.trim() : '';
  if (!txt) return null;
  try {
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('admin_settings')
      .select('key,value')
      .in('key', ['site_header_settings', 'site_footer_settings', 'site_devtool_settings', MOVIE_SECTION_LINKS_KEY, MOVIE_SECTION_LINKS_ORDER_KEY]);

    if (error) {
      return NextResponse.json({ header: null, footer: null, devtool: null, links: null, linksOrder: null }, { status: 200 });
    }

    const map = new Map<string, any>();
    (data as any[] | null | undefined)?.forEach((row) => {
      const k = String((row as any)?.key || '').trim();
      if (!k) return;
      map.set(k, parseJson((row as any)?.value));
    });

    const res = NextResponse.json(
      {
        header: map.get('site_header_settings') || null,
        footer: map.get('site_footer_settings') || null,
        devtool: map.get('site_devtool_settings') || null,
        links: map.get(MOVIE_SECTION_LINKS_KEY) || null,
        linksOrder: map.get(MOVIE_SECTION_LINKS_ORDER_KEY) || null,
      },
      { status: 200 }
    );
    res.headers.set('Cache-Control', 'no-store, max-age=0');
    return res;
  } catch {
    return NextResponse.json({ header: null, footer: null, devtool: null, links: null, linksOrder: null }, { status: 200 });
  }
}
