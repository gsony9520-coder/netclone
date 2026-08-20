import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

function detectDeviceType(ua: string | null) {
  const v = (ua || '').toLowerCase();
  if (!v) return null;
  if (/bot|spider|crawl|slurp|facebookexternalhit|whatsapp|telegrambot/.test(v)) return 'bot';
  if (/ipad|tablet|silk/.test(v)) return 'tablet';
  if (/mobi|android|iphone|ipod/.test(v)) return 'mobile';
  return 'desktop';
}

function detectCountry(headers: Headers) {
  const raw =
    headers.get('x-vercel-ip-country') ||
    headers.get('cf-ipcountry') ||
    headers.get('x-country') ||
    headers.get('x-geo-country') ||
    '';
  const v = raw.trim().toUpperCase();
  if (!v) return null;
  if (v === 'XX' || v === 'UNKNOWN') return null;
  return v.length > 8 ? v.slice(0, 8) : v;
}

function safeText(value: unknown, maxLen: number) {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!v) return null;
  return v.length > maxLen ? v.slice(0, maxLen) : v;
}

function safeUuid(value: unknown) {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!v) return null;
  const ok = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
  return ok ? v : null;
}

export async function POST(request: Request) {
  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const event_type = safeText(body?.eventType, 32);
  const visitor_id = safeUuid(body?.visitorId);
  if (!event_type || !visitor_id) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const path = safeText(body?.path, 256);
  const query = safeText(body?.query, 200);
  const content_id = safeUuid(body?.contentId);
  const content_title = safeText(body?.contentTitle, 200);
  const content_section = safeText(body?.contentSection, 64);

  const ua = safeText(request.headers.get('user-agent'), 400);
  const device_type = safeText(detectDeviceType(ua), 16);
  const country = safeText(detectCountry(request.headers), 8);
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = safeText((forwardedFor || realIp || '').split(',')[0], 64);

  try {
    const basePayload: any = {
      event_type,
      visitor_id,
      path,
      query,
      content_id,
      content_title,
      content_section,
      user_agent: ua,
      ip,
    };

    const fullPayload: any = {
      ...basePayload,
      device_type,
      country,
    };

    const insertOnce = async (payload: any) => {
      return await supabaseAdmin
        .from('analytics_events')
        .insert(payload as any);
    };

    let { error } = await insertOnce(fullPayload);
    if (error) {
      const msg = String((error as any)?.message || '').toLowerCase();
      const looksLikeMissingColumns =
        msg.includes('device_type') ||
        msg.includes('country') ||
        msg.includes('schema cache') ||
        msg.includes('does not exist') ||
        msg.includes('could not find');
      if (looksLikeMissingColumns) {
        ({ error } = await insertOnce(basePayload));
      }
    }

    if (error) console.error('analytics insert failed', error);
  } catch (e) {
    console.error('analytics insert crashed', e);
  }

  return NextResponse.json({ ok: true });
}
