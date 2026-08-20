"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';

type SiteHeaderSettings = {
  telegramLabel?: string;
  telegramUrl?: string;
};

export default function TelegramPage() {
  const [url, setUrl] = useState<string>('');
  const [label, setLabel] = useState<string>('Telegram');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/site-settings', { method: 'GET' });
        const json = await res.json();
        if (cancelled) return;
        const header = (json?.header as SiteHeaderSettings | null | undefined) || null;
        const u = String(header?.telegramUrl || '').trim();
        const l = String((header as any)?.telegramLabel || '').trim() || 'Telegram';
        setUrl(u);
        setLabel(l);
      } catch {
        if (cancelled) return;
        setUrl('');
        setLabel('Telegram');
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const isExternal = /^https?:\/\//i.test(url) || /^tg:\/\//i.test(url);

  return (
    <div className="min-h-screen bg-[#141414] text-white">
      <div className="mx-auto max-w-3xl px-6 pt-20 pb-10">
        <div className="mb-6">
          <Link href="/" className="text-sm text-zinc-300 hover:text-white">Back to Home</Link>
        </div>
        <h1 className="text-3xl font-extrabold">{label}</h1>
        <p className="mt-2 text-zinc-300">Join our community.</p>

        {url ? (
          <div className="mt-6">
            <a
              href={url}
              target={isExternal ? '_blank' : undefined}
              rel={isExternal ? 'noopener noreferrer' : undefined}
              className="inline-flex items-center justify-center rounded bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500"
            >
              Open
            </a>
          </div>
        ) : (
          <div className="mt-6 rounded border border-white/10 bg-black/30 p-4 text-sm text-zinc-300">
            This page is not available right now.
          </div>
        )}
      </div>
    </div>
  );
}
