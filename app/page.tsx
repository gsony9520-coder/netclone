"use client";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import type { Movie } from "@/lib/types";

type AnalyticsEventType = 'page_view' | 'search' | 'content_view';

type SiteHeaderSettings = {
  titleText?: string;
  titleColor?: string;
  titleSizePx?: number | null;
  telegramLabel?: string;
  telegramUrl?: string;
  nav?: {
    home?: string;
    tv?: string;
    movies?: string;
    new?: string;
  };
  searchIconColor?: string;
  searchIconSizePx?: number | null;
  searchIconUrl?: string;
};

type SiteFooterSettings = {
  questionsText?: string;
  createdText?: string;
  brandText?: string;
};

type SiteDevtoolSettings = {
  enabled?: boolean;
};

function createVisitorId() {
  try {
    if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
      return (crypto as any).randomUUID() as string;
    }
  } catch {
  }
  const hex = (n: number) => Math.floor(n).toString(16).padStart(2, '0');
  const bytes = Array.from({ length: 16 }, () => hex(Math.random() * 256));
  bytes[6] = hex((parseInt(bytes[6], 16) & 0x0f) | 0x40);
  bytes[8] = hex((parseInt(bytes[8], 16) & 0x3f) | 0x80);
  return `${bytes.slice(0, 4).join('')}-${bytes.slice(4, 6).join('')}-${bytes.slice(6, 8).join('')}-${bytes.slice(8, 10).join('')}-${bytes.slice(10, 16).join('')}`;
}

function getVisitorId() {
  if (typeof window === 'undefined') return null;
  try {
    const k = 'visitor_id';
    const existing = window.localStorage.getItem(k);
    if (existing) return existing;
    const next = createVisitorId();
    window.localStorage.setItem(k, next);
    return next;
  } catch {
    return null;
  }
}

function trackEvent(payload: { eventType: AnalyticsEventType; path?: string; query?: string; contentId?: string; contentTitle?: string; contentSection?: string }) {
  try {
    const visitorId = getVisitorId();
    if (!visitorId) return;
    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ visitorId, ...payload }),
      keepalive: true,
    }).catch(() => {});
  } catch {
  }
}

const defaultSectionLabels: Record<string, string> = {
  top10: "Top 10 Global",
  trending: "Trending TV Shows",
  bollywood: "Bollywood Movies",
  hollywood: "Hollywood Movies",
    hollywood: "Action Movies",
  korean: "Korean TV Shows",
  anime: "Anime",
  animated: "Animated Movies",
};

const defaultRowSections = [
  { key: "trending", label: defaultSectionLabels.trending },
  { key: "bollywood", label: defaultSectionLabels.bollywood },
  { key: "hollywood", label: defaultSectionLabels.hollywood },
  { key: "korean", label: defaultSectionLabels.korean },
  { key: "anime", label: defaultSectionLabels.anime },
  { key: "animated", label: defaultSectionLabels.animated },
];

const defaultOrderedSections = [
  { key: "top10", label: defaultSectionLabels.top10 },
  ...defaultRowSections,
];

function isAllowedForNextImage(src?: string | null) {
  if (!src) return false;
  try {
    const u = new URL(src);
    const host = u.hostname.toLowerCase();
    if (host === "image.tmdb.org") return true; // Only TMDB uses Next/Image
    return false;
  } catch {
    return false;
  }
}

function Poster({ src, alt, sizes, className }: { src?: string | null; alt: string; sizes?: string; className?: string }) {
  const [loaded, setLoaded] = useState(false);

  if (!src) {
    return <div className={`absolute inset-0 skeleton ${className || ''}`} aria-hidden="true" />;
  }

  const imgClassName = `${className || ''} transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`;

  if (isAllowedForNextImage(src)) {
    return (
      <div className="absolute inset-0">
        {!loaded ? <div className="absolute inset-0 skeleton" aria-hidden="true" /> : null}
        <Image
          src={src as string}
          alt={alt}
          fill
          sizes={sizes}
          className={imgClassName}
          onLoadingComplete={() => setLoaded(true)}
        />
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      {!loaded ? <div className="absolute inset-0 skeleton" aria-hidden="true" /> : null}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={`${imgClassName} w-full h-full object-cover`}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}

function Header({ scrolled, movies, onSelect, isMobile, settings }: { scrolled: boolean; movies: Movie[]; onSelect: (m: Movie) => void; isMobile: boolean; settings?: SiteHeaderSettings | null }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [titleHovered, setTitleHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevHtmlOverflowRef = useRef<string>("");
  const prevBodyOverflowRef = useRef<string>("");
  const lastSearchSentRef = useRef<string>('');
  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
    else setQuery("");
  }, [searchOpen]);
  const q = query.trim().toLowerCase();
  const headerDark = isMobile || scrolled || (searchOpen && !!q);
  const results = q
    ? movies.filter((m) => (m?.title || "").toLowerCase().includes(q)).slice(0, 60)
    : [];
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const open = searchOpen && !!q;
    if (open) {
      prevHtmlOverflowRef.current = document.documentElement.style.overflow || '';
      prevBodyOverflowRef.current = document.body.style.overflow || '';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else {
      document.documentElement.style.overflow = prevHtmlOverflowRef.current;
      document.body.style.overflow = prevBodyOverflowRef.current;
    }
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflowRef.current;
      document.body.style.overflow = prevBodyOverflowRef.current;
    };
  }, [searchOpen, q]);

  useEffect(() => {
    if (!searchOpen) {
      lastSearchSentRef.current = '';
      return;
    }
    if (!q || q.length < 2) return;
    const t = setTimeout(() => {
      if (lastSearchSentRef.current === q) return;
      lastSearchSentRef.current = q;
      trackEvent({ eventType: 'search', query: q, path: typeof window !== 'undefined' ? window.location.pathname : '' });
    }, 700);
    return () => clearTimeout(t);
  }, [q, searchOpen]);

  const titleText = String(settings?.titleText || '').trim() || 'NETFLIX';
  const baseTitleColor = String(settings?.titleColor || '').trim();
  const titleActiveColor = titleHovered ? '#e50914' : (baseTitleColor || '');
  const titleStyle: CSSProperties = {
    ...(titleActiveColor ? { color: titleActiveColor } : {}),
    ...(typeof settings?.titleSizePx === 'number' && Number.isFinite(settings.titleSizePx) ? { fontSize: settings.titleSizePx } : {}),
  };
  const rawNavHome = (settings as any)?.nav?.home as unknown;
  const rawNavTv = (settings as any)?.nav?.tv as unknown;
  const rawNavMovies = (settings as any)?.nav?.movies as unknown;
  const rawNavNew = (settings as any)?.nav?.new as unknown;
  const navHomeText = rawNavHome === undefined ? 'Home' : String(rawNavHome || '').trim();
  const navTvText = rawNavTv === undefined ? 'TV Shows' : String(rawNavTv || '').trim();
  const navMoviesText = rawNavMovies === undefined ? 'Movies' : String(rawNavMovies || '').trim();
  const navNewText = rawNavNew === undefined ? 'New & Popular' : String(rawNavNew || '').trim();

  const rawTelegramLabel = (settings as any)?.telegramLabel as unknown;
  const telegramLabel = rawTelegramLabel === undefined ? 'Telegram' : String(rawTelegramLabel || '').trim();
  const telegramUrl = String((settings as any)?.telegramUrl || '').trim();
  const telegramLabelText = telegramLabel || 'Telegram';
  const searchIconSize = typeof settings?.searchIconSizePx === 'number' && Number.isFinite(settings.searchIconSizePx) ? settings.searchIconSizePx : 24;
  const searchIconColor = String(settings?.searchIconColor || '').trim();
  const searchIconUrl = String(settings?.searchIconUrl || '').trim();

  return (
    <header id="site-header"
      className={`fixed top-0 left-0 right-0 z-50 w-full pointer-events-auto isolate transition-colors duration-300 ${
        headerDark ? "bg-black" : "bg-black/0"
      }`}
      style={{ backgroundColor: headerDark ? "#000000" : "transparent", backgroundImage: "none" }}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-8 px-6 py-3 overflow-visible min-h-[64px]">
        <Link
          href="/"
          aria-label="Home"
          className="text-red-600 text-2xl font-extrabold tracking-wider cursor-pointer transition-colors duration-150"
          style={titleStyle}
          onMouseEnter={() => setTitleHovered(true)}
          onMouseLeave={() => setTitleHovered(false)}
        >
          {titleText}
        </Link>
        {isMobile && navHomeText ? (
          <span className="md:hidden text-base font-semibold text-white">{navHomeText}</span>
        ) : null}
        <nav className="hidden md:flex items-center gap-6 text-sm text-zinc-200">
          {navHomeText ? <a className="hover:text-white" href="#home">{navHomeText}</a> : null}
          {navTvText ? <a className="hover:text-white" href="#tv">{navTvText}</a> : null}
          {navMoviesText ? <a className="hover:text-white" href="#movies">{navMoviesText}</a> : null}
          {navNewText ? <a className="hover:text-white" href="#new">{navNewText}</a> : null}
          {telegramUrl ? (
            <a className="hover:text-white" href={telegramUrl} target="_blank" rel="noopener noreferrer">
              {telegramLabelText}
            </a>
          ) : null}
        </nav>
        <div className="ml-auto flex items-center gap-3 relative">
          <div
            className={`absolute right-0 top-1/2 -translate-y-1/2 z-50 transition-[width,opacity] duration-300 ${
              searchOpen ? "w-60 md:w-72 opacity-100 pointer-events-auto" : "w-0 opacity-0 pointer-events-none"
            }`}
          >
            <div className="relative">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search Movies & Series"
                className="w-full rounded-lg border border-red-600/80 bg-zinc-900/95 pl-10 pr-16 py-2.5 text-sm md:text-base text-white placeholder-white/70 outline-none focus:border-red-500 focus:ring-0 shadow-lg"
              />
              <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400">
                <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close search"
            onClick={() => { setSearchOpen(false); setQuery(""); }}
            className={`absolute right-[15px] top-1/2 -translate-y-1/2 text-zinc-300 hover:text-white cursor-pointer z-[70] ${searchOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <button
            aria-label="Search"
            onClick={() => setSearchOpen((v) => !v)}
            type="button"
            aria-expanded={searchOpen}
            className={`relative z-[60] text-zinc-200 hover:text-white p-2 cursor-pointer ${searchOpen ? "invisible pointer-events-none" : ""}`}
          >
            {searchIconUrl ? (
              <span
                aria-hidden="true"
                className="inline-block"
                style={{
                  width: searchIconSize,
                  height: searchIconSize,
                  backgroundColor: searchIconColor || 'currentColor',
                  WebkitMaskImage: `url(${searchIconUrl})`,
                  maskImage: `url(${searchIconUrl})`,
                  WebkitMaskRepeat: 'no-repeat',
                  maskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center',
                  maskPosition: 'center',
                  WebkitMaskSize: 'contain',
                  maskSize: 'contain',
                }}
              />
            ) : (
              <span className="inline-flex items-center justify-center" style={{ color: searchIconColor || undefined }}>
                <svg aria-hidden="true" viewBox="0 0 24 24" width={searchIconSize} height={searchIconSize} fill="none" stroke="currentColor" strokeWidth="2" className="opacity-90 cursor-pointer select-none">
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
            )}
          </button>
        </div>
      </div>
      {searchOpen && q ? (
        <div className={`hide-scrollbar fixed left-0 right-0 top-[64px] bottom-0 ${isMobile ? 'bg-black' : 'bg-[#141414]'} overflow-y-auto overscroll-contain`}>
          <div className="mx-auto max-w-7xl px-6 py-6">
            {results.length === 0 ? (
              <p className="text-zinc-400 text-sm">No results for &quot;{query}&quot;</p>
            ) : (
              <div className="flex flex-wrap gap-[1px] md:gap-x-1 md:gap-y-2">
                {results.map((m) => {
                  const src = isMobile
                    ? (m.mobile_poster_url || m.mobile_poster_url_external || m.poster_url || m.poster_url_external)
                    : (String((m as any)?.section || '') === 'top10'
                      ? (m.backdrop_url || m.backdrop_url_external || m.poster_url || m.poster_url_external)
                      : (m.poster_url || m.poster_url_external || m.backdrop_url || m.backdrop_url_external));
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        onSelect(m);
                      }}
                      className={`group relative shrink-0 overflow-hidden rounded-[2px] bg-zinc-800 ${
                        isMobile
                          ? 'h-[143px] w-28'
                          : 'h-[96px] w-[170px] sm:h-[106px] sm:w-[190px] md:h-[118px] md:w-[210px]'
                      }`}
                    >
                      {src ? (
                        <Poster
                          src={src}
                          alt={m.title}
                          sizes={isMobile
                            ? "(min-width:1024px) calc(((100vw-78px)/5.3)+5px), 112px"
                            : "(min-width:1024px) 210px, (min-width:768px) 190px, 170px"}
                          className="object-cover transition-transform duration-200 group-hover:scale-105"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-500 px-2 text-center">
                          {m.title}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}

function Hero({ movie, onSelect, isMobile, loading }: { movie: Movie | null; onSelect: (m: Movie) => void; isMobile: boolean; loading: boolean }) {
  const mobilePosterUrl = movie?.mobile_poster_url || movie?.mobile_poster_url_external || null;
  const desktopPosterUrl = movie?.poster_url || movie?.poster_url_external || null;
  const desktopBgUrl = desktopPosterUrl || movie?.backdrop_url || movie?.backdrop_url_external || null;
  const mobileHeroUrl = mobilePosterUrl || desktopPosterUrl || movie?.mobile_backdrop_url || movie?.mobile_backdrop_url_external || movie?.backdrop_url || movie?.backdrop_url_external || null;
  if (isMobile) {
    const poster = mobileHeroUrl || "https://image.tmdb.org/t/p/original/9FAWc6DIKxE2iMM3pMtIEUnfBOU.jpg";
    return (
      <section id="home" className="relative w-full pt-2">
        <div className="w-full px-2">
          <div className="relative overflow-hidden rounded-[5px] bg-zinc-900 shadow-2xl ring-1 ring-white/10">
            <div className="pointer-events-none absolute inset-0 z-10">
              <div className="absolute left-0 top-0 bottom-0 w-px bg-[linear-gradient(to_bottom,transparent_0%,transparent_48%,rgba(255,255,255,0.10)_68%,rgba(255,255,255,0.35)_100%)]" />
              <div className="absolute right-0 top-0 bottom-0 w-px bg-[linear-gradient(to_bottom,transparent_0%,transparent_48%,rgba(255,255,255,0.10)_68%,rgba(255,255,255,0.35)_100%)]" />
              <div className="absolute left-0 right-0 bottom-0 h-px bg-[linear-gradient(to_right,transparent_0%,rgba(255,255,255,0.28)_50%,transparent_100%)]" />
            </div>
            <div className="relative aspect-[3/4] w-full">
              <img
                src={poster}
                alt={movie?.title || 'Hero'}
                className="absolute inset-0 h-full w-full object-cover"
                loading="eager"
                decoding="async"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />

              <div className="absolute inset-x-0 bottom-0 p-4">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (movie) onSelect(movie);
                    }}
                    className="inline-flex h-[43px] w-full items-center justify-center gap-2 rounded bg-white px-4 py-2 font-bold text-black hover:bg-white/90"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" width="32" height="32" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className="block">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    <span className="leading-none">Play</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (movie) onSelect(movie);
                    }}
                    className="inline-flex h-[43px] w-full items-center justify-center gap-2 rounded bg-[#4D4949] px-4 py-2 font-semibold text-white hover:bg-[#524D4D]"
                  >
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-white/90">
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        width="22"
                        height="22"
                        className="block"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 11v5" />
                        <path d="M12 8h.01" />
                      </svg>
                    </span>
                    <span className="leading-none">Info</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {!movie && loading ? (
            <div className="mt-4 grid grid-cols-2 gap-3" aria-hidden="true">
              <div className="h-[43px] rounded skeleton" />
              <div className="h-[43px] rounded skeleton" />
            </div>
          ) : null}
        </div>
      </section>
    );
  }
  return (
    <section id="home" className="relative h-[calc(95vh+40px)] md:h-[calc(105vh+40px)] w-full">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: desktopBgUrl
            ? `url(${desktopBgUrl})`
            : "url(https://image.tmdb.org/t/p/original/9FAWc6DIKxE2iMM3pMtIEUnfBOU.jpg)",
        }}
      />
      <div className="absolute inset-0 hero-gradient pointer-events-none" />

      <div className="relative z-10 flex h-full flex-col justify-center pt-16">
        <div className="mx-auto w-full max-w-7xl px-6">
          {movie ? (
            <>
              {(movie.logo_url || movie.logo_url_external) ? (
                <div className="max-w-2xl">
                  <img
                    src={(movie.logo_url || movie.logo_url_external) as string}
                    alt={movie.title}
                    className="h-[180px] w-[520px] max-w-full object-contain"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              ) : (
                <h1 className="max-w-2xl text-4xl font-extrabold md:text-6xl">{movie.title}</h1>
              )}
              {movie.description ? (
                <p className="mt-4 max-w-xl text-sm text-zinc-200 md:text-base">{movie.description}</p>
              ) : null}
            </>
          ) : loading ? (
            <div className="max-w-2xl">
              <div className="h-10 w-72 md:h-16 md:w-[520px] rounded skeleton" />
              <div className="mt-4 h-4 w-80 rounded skeleton" />
              <div className="mt-2 h-4 w-64 rounded skeleton" />
            </div>
          ) : null}
        </div>

        <div className="mt-10 md:mt-[84px] relative w-full">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 px-6">
            {movie ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (movie) onSelect(movie);
                  }}
                  className="inline-flex h-[43px] min-w-[120px] items-center justify-center gap-2 rounded bg-white px-6 py-2 font-bold text-black hover:bg-white/90"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" width="32" height="32" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className="block">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Play
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (movie) onSelect(movie);
                  }}
                  className="inline-flex h-[43px] items-center gap-2 rounded bg-[#4D4949] px-4 py-2 font-semibold text-white hover:bg-[#524D4D]"
                >
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-white/90">
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        width="22"
                        height="22"
                        className="block"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 11v5" />
                        <path d="M12 8h.01" />
                      </svg>
                  </span>
                  <span className="leading-none">More Info</span>
                </button>
              </>
            ) : loading ? (
              <>
                <div className="h-10 w-[120px] rounded skeleton" />
                <div className="h-10 w-[120px] rounded skeleton" />
              </>
            ) : null}
          </div>

          {movie?.maturity ? (
            <div className="absolute right-0 top-1/2 z-20 -translate-y-1/2">
              <div className="border-l-2 border-white/80 bg-zinc-900/35 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
                {movie.maturity}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Row({ title, movies, onSelect, isMobile, loading }: { title: string; movies: Movie[]; onSelect: (m: Movie) => void; isMobile: boolean; loading: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [rowCanLeft, setRowCanLeft] = useState(false);
  const [rowCanRight, setRowCanRight] = useState(false);
  const [rowSteps, setRowSteps] = useState(1);
  const [rowStepIndex, setRowStepIndex] = useState(0);
  const posterSizes = "(min-width:1024px) calc(((100vw-78px)/5.3)+5px), 112px";

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      const left = el.scrollLeft;
      const hasOverflow = max > 2;
      setRowCanLeft(hasOverflow && left > 2);
      setRowCanRight(hasOverflow && left < max - 2);

      if (!hasOverflow) {
        setRowSteps(1);
        setRowStepIndex(0);
        return;
      }

      const stepSize = Math.max(1, Math.round(el.clientWidth * 0.85));
      const stepsRaw = Math.ceil(max / stepSize) + 1;
      const steps = Math.min(10, Math.max(1, stepsRaw));
      const ratio = max > 0 ? left / max : 0;
      const idx = steps <= 1 ? 0 : Math.round(ratio * (steps - 1));
      setRowSteps(steps);
      setRowStepIndex(Math.max(0, Math.min(steps - 1, idx)));
    };
    update();
    const onResize = () => update();
    window.addEventListener('resize', onResize);
    el.addEventListener('scroll', update, { passive: true } as any);
    return () => {
      window.removeEventListener('resize', onResize);
      el.removeEventListener('scroll', update as any);
    };
  }, [movies, loading, isMobile]);

  const scrollRowBy = (dir: -1 | 1) => {
    const el = ref.current;
    if (!el) return;
    const amt = Math.round(el.clientWidth * 0.85);
    el.scrollBy({ left: dir * amt, behavior: 'smooth' });
  };
  return (
    <section className="relative z-10 mb-6 group/row">
      {isMobile ? (
        <h2 className="mb-2 px-[5px] md:px-6 text-xl font-semibold">{title}</h2>
      ) : (
        <div className="mb-2 flex items-center justify-between px-[5px] md:px-6">
          <h2 className="text-xl font-semibold">{title}</h2>
          {rowSteps > 1 ? (
            <div className="hidden md:flex items-center gap-1" aria-hidden="true">
              {Array.from({ length: rowSteps }).map((_, i) => (
                <span key={i} className={`h-[2px] w-2 rounded-sm ${i === rowStepIndex ? 'bg-zinc-200/80' : 'bg-white/20'}`} />
              ))}
            </div>
          ) : null}
        </div>
      )}
      <div className="relative">
        <div
          ref={ref}
          onWheel={(e) => {
            if (!e.shiftKey && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
              e.preventDefault();
              window.scrollBy({ top: e.deltaY, left: 0 });
            }
          }}
          className={`row-scrollbar flex overflow-x-auto pb-2 ${isMobile ? 'gap-[5px] px-[5px]' : 'gap-[6px] px-[2px] md:px-6'}`}
        >
          {(loading && movies.length === 0 ? Array.from({ length: 14 }).map((_, idx) => ({ id: `skeleton-${title}-${idx}` })) : movies).map((m: any, idx: number) => (
            typeof m?.title === 'string' ? (
              <button
                key={m.id}
                onClick={() => onSelect(m)}
                className={`group relative ${isMobile ? 'h-[153px]' : 'h-[143px] lg:h-auto lg:aspect-[262/143]'} w-28 shrink-0 overflow-hidden rounded-[3px] bg-zinc-800 lg:w-[calc(((100%-30px)/5.3)+5px)]`}
              >
                {(isMobile ? (m.mobile_poster_url || m.mobile_poster_url_external || m.poster_url || m.poster_url_external) : (m.poster_url || m.poster_url_external)) ? (
                  <Poster
                    src={isMobile ? (m.mobile_poster_url || m.mobile_poster_url_external || m.poster_url || m.poster_url_external) : (m.poster_url || m.poster_url_external)}
                    alt={m.title}
                    sizes={posterSizes}
                    className="object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 bg-zinc-700" />
                )}
              </button>
            ) : (
              <div
                key={m.id || `skeleton-${title}-${idx}`}
                className={`relative ${isMobile ? 'h-[153px]' : 'h-[143px] lg:h-auto lg:aspect-[262/143]'} w-28 shrink-0 overflow-hidden rounded-[3px] bg-zinc-800 lg:w-[calc(((100%-30px)/5.3)+5px)]`}
                aria-hidden="true"
              >
                <div className="absolute inset-0 skeleton" />
              </div>
            )
          ))}
        </div>

        {!isMobile ? (
          <>
            {rowCanLeft ? (
              <button
                type="button"
                aria-label="Scroll left"
                onClick={() => scrollRowBy(-1)}
                className="hidden md:flex absolute left-0 top-0 bottom-2 w-16 items-center justify-start pl-2 opacity-0 transition-opacity duration-200 group-hover/row:opacity-100"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-black/35 via-black/10 to-transparent" aria-hidden="true" />
                <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="butt" strokeLinejoin="miter" className="relative -ml-1 text-white/90">
                  <polyline points="15 4 9 12 15 20" />
                </svg>
              </button>
            ) : null}
            {rowCanRight ? (
              <button
                type="button"
                aria-label="Scroll right"
                onClick={() => scrollRowBy(1)}
                className="hidden md:flex absolute right-0 top-0 bottom-2 w-16 items-center justify-end pr-2 opacity-0 transition-opacity duration-200 group-hover/row:opacity-100"
              >
                <span className="absolute inset-0 bg-gradient-to-l from-black/35 via-black/10 to-transparent" aria-hidden="true" />
                <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="butt" strokeLinejoin="miter" className="relative ml-1 text-white/90">
                  <polyline points="9 4 15 12 9 20" />
                </svg>
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}

function Top10Row({ title, movies, onSelect, isMobile, loading }: { title: string; movies: Movie[]; onSelect: (m: Movie) => void; isMobile: boolean; loading: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [topCanLeft, setTopCanLeft] = useState(false);
  const [topCanRight, setTopCanRight] = useState(false);
  const [topSteps, setTopSteps] = useState(1);
  const [topStepIndex, setTopStepIndex] = useState(0);

  const dragRef = useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    startScrollLeft: number;
    lock: 'x' | 'y' | null;
  }>({ pointerId: null, startX: 0, startY: 0, startScrollLeft: 0, lock: null });

  const endDrag = (el: HTMLDivElement | null) => {
    const st = dragRef.current;
    if (st.pointerId !== null && el && el.hasPointerCapture(st.pointerId)) {
      try {
        el.releasePointerCapture(st.pointerId);
      } catch {
        // ignore
      }
    }
    dragRef.current.pointerId = null;
    dragRef.current.lock = null;
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      const left = el.scrollLeft;
      const hasOverflow = max > 2;
      setTopCanLeft(hasOverflow && left > 2);
      setTopCanRight(hasOverflow && left < max - 2);

      if (!hasOverflow) {
        setTopSteps(1);
        setTopStepIndex(0);
        return;
      }

      const stepSize = Math.max(1, Math.round(el.clientWidth * 0.85));
      const stepsRaw = Math.ceil(max / stepSize) + 1;
      const steps = Math.min(10, Math.max(1, stepsRaw));
      const ratio = max > 0 ? left / max : 0;
      const idx = steps <= 1 ? 0 : Math.round(ratio * (steps - 1));
      setTopSteps(steps);
      setTopStepIndex(Math.max(0, Math.min(steps - 1, idx)));
    };
    update();
    const onResize = () => update();
    window.addEventListener('resize', onResize);
    el.addEventListener('scroll', update, { passive: true } as any);
    return () => {
      window.removeEventListener('resize', onResize);
      el.removeEventListener('scroll', update as any);
    };
  }, [movies, loading, isMobile]);

  const scrollTop10By = (dir: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    const amt = Math.round(el.clientWidth * 0.85);
    el.scrollBy({ left: dir * amt, behavior: 'smooth' });
  };

  return (
    <section className="relative z-10 mt-3 md:-mt-[104px] mb-6 group/top10">
      {isMobile ? (
        <h2 className="mb-1 px-6 text-xl font-semibold">{title}</h2>
      ) : (
        <div className="mb-1 flex items-center justify-between px-6">
          <h2 className="text-xl font-semibold">{title}</h2>
          {topSteps > 1 ? (
            <div className="hidden md:flex items-center gap-1" aria-hidden="true">
              {Array.from({ length: topSteps }).map((_, i) => (
                <span key={i} className={`h-[2px] w-2 rounded-sm ${i === topStepIndex ? 'bg-zinc-200/80' : 'bg-white/20'}`} />
              ))}
            </div>
          ) : null}
        </div>
      )}
      <div className="relative">
        <div
          ref={scrollRef}
          style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain', overscrollBehaviorY: 'auto' }}
          onPointerDown={(e) => {
            if (e.pointerType !== 'touch') return;
            if (!e.isPrimary) return;
            const el = scrollRef.current;
            if (!el) return;
            dragRef.current.pointerId = e.pointerId;
            dragRef.current.startX = e.clientX;
            dragRef.current.startY = e.clientY;
            dragRef.current.startScrollLeft = el.scrollLeft;
            dragRef.current.lock = null;
          }}
          onPointerMove={(e) => {
            const el = scrollRef.current;
            if (!el) return;
            const st = dragRef.current;
            if (e.pointerType !== 'touch') return;
            if (st.pointerId === null || e.pointerId !== st.pointerId) return;

            const dx = e.clientX - st.startX;
            const dy = e.clientY - st.startY;
            const ax = Math.abs(dx);
            const ay = Math.abs(dy);

            if (!st.lock) {
              if (ay >= 8 && ay > ax) {
                dragRef.current.pointerId = null;
                dragRef.current.lock = null;
                return;
              }

              if (ax >= 24 && ax > ay * 2.5) {
                st.lock = 'x';
                try {
                  el.setPointerCapture(e.pointerId);
                } catch {
                  // ignore
                }
              } else {
                return;
              }
            }

            if (st.lock === 'x') {
              e.preventDefault();
              el.scrollLeft = st.startScrollLeft - dx;
            }
          }}
          onPointerUp={() => endDrag(scrollRef.current)}
          onPointerCancel={() => endDrag(scrollRef.current)}
          onPointerLeave={() => endDrag(scrollRef.current)}
          onWheel={(e) => {
            if (!e.shiftKey && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
              e.preventDefault();
              window.scrollBy({ top: e.deltaY, left: 0 });
            }
          }}
          className="row-scrollbar flex gap-4 overflow-x-auto overflow-y-hidden pl-20 pr-6 pb-1"
        >
          {(loading && movies.length === 0 ? Array.from({ length: 10 }).map((_, idx) => ({ id: `skeleton-top10-${idx}`, rank: idx + 1 })) : movies).map((m: any, idx: number) => (
            typeof m?.title === 'string' ? (
              <button
                key={m.id}
                onClick={() => {
                  onSelect(m as Movie);
                }}
                style={{ touchAction: 'pan-y' }}
                className="group relative flex h-44 w-[220px] shrink-0 items-end md:h-56"
              >
                <span className="pointer-events-none absolute -left-16 bottom-[-26px] z-0 top10-rank text-[190px] leading-none select-none md:bottom-[-30px] md:text-[224px]">
                  {(m.rank ?? idx + 1).toString()}
                </span>
                <div className="absolute left-8 bottom-0 z-10 h-40 w-[116px] overflow-hidden rounded-none bg-zinc-800 shadow-lg shadow-black/30 md:h-44 md:w-[124px] md:transition-transform md:duration-300 md:group-hover:scale-105">
                  {(isMobile ? (m.mobile_poster_url || m.mobile_poster_url_external || m.poster_url || m.poster_url_external) : (m.poster_url || m.poster_url_external)) ? (
                    <Poster src={isMobile ? (m.mobile_poster_url || m.mobile_poster_url_external || m.poster_url || m.poster_url_external) : (m.poster_url || m.poster_url_external)} alt={m.title} sizes="124px" className="object-cover" />
                  ) : (
                    <div className="absolute inset-0 skeleton" aria-hidden="true" />
                  )}
                </div>
              </button>
            ) : (
              <div key={m.id} className="relative flex h-44 w-[220px] shrink-0 items-end md:h-56" aria-hidden="true">
                <span className="pointer-events-none absolute -left-16 bottom-[-26px] z-0 top10-rank text-[190px] leading-none select-none md:bottom-[-30px] md:text-[224px]">
                  {(m.rank ?? idx + 1).toString()}
                </span>
                <div className="absolute left-8 bottom-0 z-10 h-40 w-[116px] overflow-hidden rounded-none bg-zinc-800 shadow-lg shadow-black/30 md:h-44 md:w-[124px]">
                  <div className="absolute inset-0 skeleton" />
                </div>
              </div>
            )
          ))}
        </div>

        {!isMobile ? (
          <>
            {topCanLeft ? (
              <button
                type="button"
                aria-label="Scroll left"
                onClick={() => scrollTop10By(-1)}
                className="hidden md:flex absolute left-0 top-0 bottom-1 w-16 items-center justify-start pl-2 opacity-0 transition-opacity duration-200 group-hover/top10:opacity-100"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-black/35 via-black/10 to-transparent" aria-hidden="true" />
                <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="butt" strokeLinejoin="miter" className="relative -ml-1 text-white/90">
                  <polyline points="15 4 9 12 15 20" />
                </svg>
              </button>
            ) : null}
            {topCanRight ? (
              <button
                type="button"
                aria-label="Scroll right"
                onClick={() => scrollTop10By(1)}
                className="hidden md:flex absolute right-0 top-0 bottom-1 w-16 items-center justify-end pr-2 opacity-0 transition-opacity duration-200 group-hover/top10:opacity-100"
              >
                <span className="absolute inset-0 bg-gradient-to-l from-black/35 via-black/10 to-transparent" aria-hidden="true" />
                <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="butt" strokeLinejoin="miter" className="relative ml-1 text-white/90">
                  <polyline points="9 4 15 12 9 20" />
                </svg>
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
}

function Modal({ movie, onClose, isMobile, allMovies, onSelectMovie, telegramUrl }: { movie: Movie | null; onClose: () => void; isMobile: boolean; allMovies?: Movie[]; onSelectMovie?: (m: Movie) => void; telegramUrl?: string }) {
  const [show, setShow] = useState(false);
  const [selectedModalSeason, setSelectedModalSeason] = useState<number>(1);
  const [activeEmbed, setActiveEmbed] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'episodes' | 'more_like_this' | 'more_details'>('episodes');
  useEffect(() => {
    if (movie) {
      setShow(false);
      setActiveEmbed(null);
      const id = requestAnimationFrame(() => setShow(true));
      const raw = (movie as any).episodes as any;
      let eps: any[] = [];
      if (Array.isArray(raw)) {
        eps = raw;
      } else if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) eps = parsed;
        } catch {
          eps = [];
        }
      }
      const sorted = [...eps].sort((a: any, b: any) => {
        const as = Number(a?.season ?? 1);
        const bs = Number(b?.season ?? 1);
        if (as !== bs) return as - bs;
        const an = Number(a?.number ?? 0);
        const bn = Number(b?.number ?? 0);
        return an - bn;
      });
      const firstSeason = sorted.length > 0 ? (sorted[0].season ?? 1) : 1;
      setSelectedModalSeason(firstSeason);
      const isSeriesLike = !!(movie as any).is_series || sorted.length > 0;
      setActiveTab(isSeriesLike ? 'episodes' : 'more_like_this');
      return () => cancelAnimationFrame(id);
    } else {
      setShow(false);
    }
  }, [movie]);
  if (!movie) return null;
  const handleClose = () => {
    setShow(false);
    setTimeout(() => {
      onClose();
    }, 500);
  };
  const mediaSrc = isMobile
    ? (movie.mobile_backdrop_url || movie.mobile_backdrop_url_external || movie.backdrop_url || movie.backdrop_url_external || movie.mobile_poster_url || movie.mobile_poster_url_external || movie.poster_url || movie.poster_url_external)
    : (movie.backdrop_url || movie.backdrop_url_external || movie.poster_url || movie.poster_url_external);
  const rawTags = (movie as any).tags as unknown;
  const tagList = Array.isArray(rawTags)
    ? (rawTags as string[])
    : typeof rawTags === 'string'
      ? rawTags.split(',').map((t) => t.trim()).filter(Boolean)
      : [];
  const rawLanguages = (movie as any).languages as unknown;
  const languageList = Array.isArray(rawLanguages)
    ? (rawLanguages as any[]).map((t) => String(t).trim()).filter(Boolean)
    : typeof rawLanguages === 'string'
      ? rawLanguages.split(',').map((t) => t.trim()).filter(Boolean)
      : [];
  const episodesRaw = (movie as any).episodes as any;
  let episodesList: any[] = [];
  if (Array.isArray(episodesRaw)) {
    episodesList = episodesRaw;
  } else if (typeof episodesRaw === 'string') {
    try {
      const parsed = JSON.parse(episodesRaw);
      if (Array.isArray(parsed)) {
        episodesList = parsed;
      } else if (typeof parsed === 'string') {
        const parsed2 = JSON.parse(parsed);
        if (Array.isArray(parsed2)) episodesList = parsed2;
      }
    } catch {
      episodesList = [];
    }
  }
  const allSeasons = Array.from(new Set(episodesList.map((ep: any) => ep.season ?? 1))).sort((a: any, b: any) => a - b) as number[];
  const looksLikeSeries = !!(movie as any).is_series || episodesList.length > 0;
  const showEpisodesTab = looksLikeSeries;
  const seasonsCount = looksLikeSeries ? allSeasons.length : 0;
  const visibleEpisodes = episodesList.filter((ep: any) => (ep.season ?? 1) === selectedModalSeason);
  const sortedEpisodes = [...episodesList].sort((a: any, b: any) => {
    const as = Number(a?.season ?? 1);
    const bs = Number(b?.season ?? 1);
    if (as !== bs) return as - bs;
    const an = Number(a?.number ?? 0);
    const bn = Number(b?.number ?? 0);
    return an - bn;
  });
  const getEmbedValue = (value: any) => {
    const code = String(value?.embed_code || '').trim();
    if (code) return code;
    const link = String(value?.embed_link || '').trim();
    if (link) return link;
    return '';
  };
  const firstPlayableEpisode = sortedEpisodes.find((ep: any) => !!getEmbedValue(ep)) || sortedEpisodes[0];
  const isPlaying = !!activeEmbed;
  // Mobile me auto Fullscreen nahi chahiye.
  // Isliye theater layout (h-[100vh] + fullscreen-style) sirf non-mobile me.
  // Mobile me video modal ke backdrop area me hi play hogi.
  const isTheater = !isMobile && isPlaying;
  const primaryTag = tagList[0] ? String(tagList[0]).trim() : '';
  const primaryTagLower = primaryTag ? primaryTag.toLowerCase() : '';
  const similarMovies = Array.isArray(allMovies)
    ? allMovies
        .filter((m) => m && (m as any).id && (m as any).id !== movie.id)
        .filter((m) => {
          if (primaryTagLower) {
            const raw = (m as any).tags as unknown;
            const list = Array.isArray(raw)
              ? (raw as any[]).map((t) => String(t).trim()).filter(Boolean)
              : typeof raw === 'string'
                ? raw.split(',').map((t) => t.trim()).filter(Boolean)
                : [];
            return list.some((t) => String(t).toLowerCase() === primaryTagLower);
          }
          const sameSection = String((m as any).section || '') && String((m as any).section || '') === String((movie as any).section || '');
          if (sameSection) return true;
          const g0 = String((movie as any).genres || '').split(',').map((t) => t.trim()).filter(Boolean)[0] || '';
          if (!g0) return false;
          return String((m as any).genres || '').toLowerCase().includes(g0.toLowerCase());
        })
        .slice(0, 18)
    : [];
  const handlePlay = () => {
    if (looksLikeSeries && firstPlayableEpisode) {
      setSelectedModalSeason(Number(firstPlayableEpisode?.season ?? 1));
      const v = getEmbedValue(firstPlayableEpisode);
      if (v) setActiveEmbed(v);
      return;
    }
    const v = getEmbedValue(movie);
    if (v) setActiveEmbed(v);
  };
  const handleCloseClick = () => {
    if (isTheater) {
      setActiveEmbed(null);
      return;
    }
    handleClose();
  };

  const theaterClosePortal =
    isTheater && typeof document !== 'undefined'
      ? createPortal(
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              handleCloseClick();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                handleCloseClick();
              }
            }}
            aria-label="Close"
            data-theater="1"
            className="modal-close"
          >
            <svg viewBox="0 0 24 24" className="modal-close-icon" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>,
          document.body
        )
      : null;

  return (
    <div
      className={`hide-scrollbar fixed inset-0 z-[2000] ${isTheater ? 'overflow-hidden' : 'overflow-y-auto'} ${isMobile ? 'bg-black' : 'bg-black/70'} transition-opacity duration-500 ${
        show ? "opacity-100" : "opacity-0"
      }`}
      style={{ zIndex: 3000, WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', touchAction: 'pan-y' }}
      onClick={() => {
        if (isTheater) return;
        handleClose();
      }}
    >
      {theaterClosePortal}
      {(isTheater || isMobile) ? null : <div className="h-5" />}
      <div
        className={`mx-auto ${isMobile ? 'bg-black' : 'bg-[#181818]'} shadow-2xl transition-all duration-500 origin-center ${
          show ? "scale-100 opacity-100" : "scale-95 opacity-0"
        } ${(isTheater || isMobile) ? 'w-screen max-w-none min-h-[100vh] rounded-none' : 'w-[93vw] max-w-[1030px] rounded-t-lg'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`modal-player relative w-full ${isMobile ? 'bg-black' : 'bg-[#181818]'} ${isTheater ? 'h-[100vh] w-screen max-w-none min-h-[100vh] rounded-none' : isMobile ? 'h-[230px] rounded-none' : 'h-[400px] sm:h-[480px] md:h-[560px] rounded-t-lg'}`}>
          <div className={`absolute inset-0 overflow-hidden ${(isTheater || isMobile) ? 'rounded-none' : 'rounded-t-lg'}`}>
            <div className="relative h-full w-full">
              {activeEmbed ? (
                (() => {
                  const code = (activeEmbed || '').trim();
                  const looksLikeHtml = code.startsWith('<');
                  if (looksLikeHtml) {
                    return <div className="absolute inset-0 w-full h-full" dangerouslySetInnerHTML={{ __html: code }} />;
                  }
                  try {
                    const u = new URL(code);
                    return (
                      <iframe
                        src={u.toString()}
                        className="absolute inset-0 w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                        allowFullScreen
                        frameBorder={0}
                      />
                    );
                  } catch {
                    return <Poster src={mediaSrc} alt={movie.title} className="object-cover" />;
                  }
                })()
              ) : (
                <Poster src={mediaSrc} alt={movie.title} className="object-cover" />
              )}
            </div>
          </div>

          {!isPlaying ? (
            <>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[58%] bg-[linear-gradient(to_top,#181818_0%,rgba(24,24,24,0.82)_30%,rgba(24,24,24,0.35)_55%,rgba(24,24,24,0)_100%)]" />
              <div className="pointer-events-none absolute inset-x-0 -bottom-20 h-[70%] bg-[radial-gradient(ellipse_at_bottom,rgba(0,0,0,0.55)_0%,rgba(0,0,0,0.26)_40%,rgba(0,0,0,0)_72%)] blur-2xl opacity-70" />
            </>
          ) : null}

          {!isTheater && !isMobile ? (
            <div
              className={`absolute z-20 ${
                `left-6 md:left-14 ${isPlaying ? 'bottom-12' : 'bottom-9'}`
              }`}
            >
              <div className="relative flex items-center gap-3">
                {isPlaying ? (
                  <div className="pointer-events-none absolute -inset-4 rounded-md bg-black/35 backdrop-blur-md" aria-hidden="true" />
                ) : null}
                <button
                  type="button"
                  onClick={handlePlay}
                  className="relative z-10 flex h-11 items-center gap-2 rounded bg-white px-7 text-base font-semibold text-black shadow hover:bg-white/90"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                    <path d="M7 5v14l12-7z" />
                  </svg>
                  Play
                </button>
                <button
                  type="button"
                  aria-label="Add"
                  className="relative z-10 grid h-10 w-10 place-items-center rounded-md border border-white/40 bg-black/30 text-white hover:bg-black/50"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
                <button
                  type="button"
                  aria-label="Like"
                  className="relative z-10 grid h-10 w-10 place-items-center rounded-md border border-white/40 bg-black/30 text-white hover:bg-black/50"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 9V5a3 3 0 0 0-3-3L7 11v11h11.28a2 2 0 0 0 2-1.72l1.38-9A2 2 0 0 0 20.66 9H14z" />
                    <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                  </svg>
                </button>
              </div>
            </div>
          ) : null}

          {!isTheater ? (
            <div
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                handleCloseClick();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  handleCloseClick();
                }
              }}
              aria-label="Close"
              data-theater="0"
              className="modal-close"
            >
              <svg viewBox="0 0 24 24" className="modal-close-icon" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
          ) : null}
        </div>

        {!isTheater ? (
          isMobile ? (
            <div className="px-[5px] pb-8">
              <div className="pt-4">
                <div className="text-2xl font-extrabold text-white">{movie.title}</div>
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white">
                  {movie.year ? <span className="font-semibold">{movie.year}</span> : null}
                  {movie.maturity ? (
                    <span className="rounded-none px-2 py-0.5 text-[11px] font-semibold text-white ring-inset ring-[0.8px] ring-white/70">
                      {movie.maturity}
                    </span>
                  ) : null}
                  {looksLikeSeries && seasonsCount > 0 ? (
                    <span className="font-semibold text-white/90">{seasonsCount} Season{seasonsCount !== 1 ? 's' : ''}</span>
                  ) : null}
                  <span className="rounded px-2 py-0.5 text-[10px] font-semibold text-white ring-inset ring-[0.8px] ring-white/70">HD</span>
                </div>
              </div>

              {languageList.length ? (
                <div className="mt-3">
                  <div className="hide-scrollbar flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                    {languageList.map((lang: string, idx: number) => (
                      <span key={`${lang}-${idx}`} className={`relative pb-2 ${idx === 0 ? 'text-white font-semibold' : 'text-[#b3b3b3]'}`}>
                        {lang}
                        {idx === 0 ? <span className="absolute left-0 right-0 -bottom-[1px] h-[3px] bg-red-600" /> : null}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-4 space-y-3">
                <button
                  type="button"
                  onClick={handlePlay}
                  className="inline-flex h-10 w-full items-center justify-center gap-3 rounded bg-white px-6 text-[15px] font-bold text-black hover:bg-white/90"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className="block">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Play
                </button>
                <button
                  type="button"
                  className="inline-flex h-10 w-full items-center justify-center gap-3 rounded bg-[#333] px-6 text-[15px] font-bold text-white"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="block">
                    <path d="M12 3v12" />
                    <path d="M7 10l5 5 5-5" />
                    <path d="M5 21h14" />
                  </svg>
                  Download
                </button>
              </div>

              {movie.description ? (
                <p className="mt-4 text-sm leading-6 text-white/95">{movie.description}</p>
              ) : null}
              {movie.cast ? (
                <p className="mt-3 text-sm text-white/90"><span className="text-[#b3b3b3]">Cast: </span>{movie.cast}</p>
              ) : null}

              <div className="mt-5 grid grid-cols-4 items-start text-white">
                <button type="button" className="flex flex-col items-center gap-2 text-xs text-white">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span className="text-white/90">My List</span>
                </button>
                <button type="button" className="flex flex-col items-center gap-2 text-xs text-white">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 9V5a3 3 0 0 0-3-3L7 11v11h11.28a2 2 0 0 0 2-1.72l1.38-9A2 2 0 0 0 20.66 9H14z" />
                    <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                  </svg>
                  <span className="text-white/90">Rate</span>
                </button>
                {String(telegramUrl || '').trim() ? (
                  <a
                    href={String(telegramUrl || '').trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-2 text-xs text-white"
                  >
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 2L11 13" />
                      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
                    </svg>
                    <span className="text-white/90">Join</span>
                  </a>
                ) : (
                  <div />
                )}
                <button type="button" className="flex flex-col items-center gap-2 text-xs text-white">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 22V4" />
                    <path d="M4 4h14l-2 4 2 4H4" />
                  </svg>
                  <span className="text-white/90">Report</span>
                </button>
              </div>

              <div className="mt-6">
                <div className="flex items-center text-sm font-semibold">
                  {showEpisodesTab ? (
                    <button
                      type="button"
                      onClick={() => setActiveTab('episodes')}
                      className={`flex-1 pb-3 text-center ${activeTab === 'episodes' ? 'text-white border-b-[3px] border-red-600' : 'text-[#b3b3b3] border-b-[3px] border-transparent'}`}
                    >
                      Episodes
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setActiveTab('more_like_this')}
                    className={`flex-1 pb-3 text-center ${activeTab === 'more_like_this' ? 'text-white border-b-[3px] border-red-600' : 'text-[#b3b3b3] border-b-[3px] border-transparent'}`}
                  >
                    More Like This
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('more_details')}
                    className={`flex-1 pb-3 text-center ${activeTab === 'more_details' ? 'text-white border-b-[3px] border-red-600' : 'text-[#b3b3b3] border-b-[3px] border-transparent'}`}
                  >
                    More Details
                  </button>
                </div>
              </div>

              {showEpisodesTab && activeTab === 'episodes' ? (
                <div className="mt-4">
                  {looksLikeSeries && allSeasons.length > 0 ? (
                    <div className="relative inline-block ml-[5px]">
                      <select
                        value={selectedModalSeason}
                        onChange={(e) => setSelectedModalSeason(Number(e.target.value))}
                        className="min-w-[140px] max-w-[190px] appearance-none rounded bg-[#2b2b2b] py-2 pl-3 pr-10 text-[14px] font-semibold text-white outline-none ring-1 ring-white/10"
                      >
                        {allSeasons.map((s) => {
                          const count = episodesList.filter((ep: any) => (ep.season ?? 1) === s).length;
                          return (
                            <option key={s} value={s}>
                              Season {s} ({count} EP)
                            </option>
                          );
                        })}
                      </select>
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </span>
                    </div>
                  ) : null}

                  <div className="mt-4 space-y-4">
                    {visibleEpisodes.map((ep: any, idx: number) => {
                      const epNo = Number(ep.number ?? idx + 1);
                      const dur = String(ep.duration || '').trim();
                      return (
                        <button
                          key={String(ep.number ?? idx)}
                          type="button"
                          onClick={() => {
                            const v = getEmbedValue(ep);
                            setSelectedModalSeason(Number(ep?.season ?? selectedModalSeason));
                            if (v) setActiveEmbed(v);
                          }}
                          className="w-full text-left pl-[7px]"
                        >
                          <div className="flex items-center gap-4">
                            <div className="relative h-[76px] w-[132px] shrink-0 overflow-hidden rounded-md border border-red-600 bg-zinc-800">
                              {ep.thumbnail ? (
                                <img src={ep.thumbnail} alt={ep.title || `Episode ${epNo}`} className="h-full w-full object-cover object-center" />
                              ) : (
                                <div className="absolute inset-0 bg-zinc-700" />
                              )}
                              <div className="absolute inset-0 grid place-items-center bg-black/20">
                                <svg viewBox="0 0 24 24" width="38" height="38" className="drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)]">
                                  <circle cx="12" cy="12" r="9.5" fill="rgba(0,0,0,0.35)" stroke="white" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
                                  <path d="M10 8v8l8-4z" fill="white" stroke="white" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
                                </svg>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0 flex min-h-[76px] flex-col justify-center">
                              <div className="text-[15px] font-semibold text-white">Episode {epNo}</div>
                              <div className="mt-1 text-xs font-semibold text-white/70">
                                E{epNo}
                                <span className="mx-2 inline-block h-1 w-1 rounded-full bg-red-600 align-middle" />
                                S{Number(ep.season ?? selectedModalSeason)}
                                {dur ? (
                                  <>
                                    <span className="mx-2 inline-block h-1 w-1 rounded-full bg-red-600 align-middle" />
                                    {dur}
                                  </>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : activeTab === 'more_like_this' ? (
                <div className="mt-4">
                  <div className="grid grid-cols-3 gap-[5px]">
                    {similarMovies.map((m: Movie) => {
                      const src = isMobile
                        ? ((m as any).mobile_poster_url || (m as any).mobile_poster_url_external || (m as any).poster_url || (m as any).poster_url_external)
                        : ((m as any).poster_url || (m as any).poster_url_external);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            if (onSelectMovie) onSelectMovie(m);
                          }}
                          className="relative aspect-[2/2.8] w-full overflow-hidden bg-zinc-800"
                        >
                          {src ? <Poster src={src} alt={m.title} className="object-cover" /> : <div className="absolute inset-0 bg-zinc-700" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-3 text-sm">
                  {(movie as any).creator ? (
                    <div className="rounded bg-[#2b2b2b] p-3">
                      <div className="text-[#b3b3b3]">Creator:</div>
                      <div className="mt-1 text-white">{String((movie as any).creator)}</div>
                    </div>
                  ) : null}
                  {movie.cast ? (
                    <div className="rounded bg-[#2b2b2b] p-3">
                      <div className="text-[#b3b3b3]">Cast:</div>
                      <div className="mt-1 text-white">{movie.cast}</div>
                    </div>
                  ) : null}
                  {movie.genres ? (
                    <div className="rounded bg-[#2b2b2b] p-3">
                      <div className="text-[#b3b3b3]">Genres:</div>
                      <div className="mt-1 text-white">{movie.genres}</div>
                    </div>
                  ) : null}
                  {movie.maturity ? (
                    <div className="rounded bg-[#2b2b2b] p-3">
                      <div className="text-[#b3b3b3]">Maturity rating:</div>
                      <div className="mt-2">
                        <span className="rounded-none px-3 py-1 text-xs font-semibold text-white ring-inset ring-[0.8px] ring-white/70">{movie.maturity}</span>
                      </div>
                      {(movie as any).maturity_detail ? (
                        <div className="mt-2 text-white/90">{String((movie as any).maturity_detail)}</div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ) : (
            <>
            <div className="px-6 pt-5 pb-8 md:px-10">
              <div className="grid gap-x-8 gap-y-2 md:grid-cols-[1fr_0.55fr]">
                <div>
                  {/* Row 1: year · seasons/episodes · HD */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
                    {movie.year ? <span className="font-medium text-white">{movie.year}</span> : null}
                    {looksLikeSeries && seasonsCount > 0 ? (
                      <span className="font-medium text-[#e5e5e5]">{seasonsCount} Season{seasonsCount !== 1 ? 's' : ''}</span>
                    ) : null}
                    <span className="rounded px-2.5 py-0.5 text-[10px] font-semibold text-white ring-inset ring-[0.8px] ring-white/70">HD</span>
                  </div>
                </div>

                <div className="text-sm md:text-right">
                  {movie.cast ? (
                    <p><span className="text-[#b3b3b3]">Cast: </span><span className="text-white">{movie.cast}</span></p>
                  ) : null}
                </div>

                <div>
                  {/* Row 2: maturity badge + detail */}
                  {(movie.maturity || (movie as any).maturity_detail) ? (
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                      {movie.maturity ? (
                        <span className="rounded-none px-3 py-1 text-xs font-semibold text-white ring-inset ring-[0.8px] ring-white/70">{movie.maturity}</span>
                      ) : null}
                      {(movie as any).maturity_detail ? (
                        <span className="text-sm text-white">{(movie as any).maturity_detail}</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="mt-2 space-y-2 text-sm md:text-right">
                  {movie.genres ? (
                    <p><span className="text-[#b3b3b3]">Genres: </span><span className="text-white">{movie.genres}</span></p>
                  ) : null}
                </div>
              </div>

              {movie.description ? (
                <div className="mt-4">
                  <p className="text-sm leading-6 text-white">{movie.description}</p>
                </div>
              ) : null}
            </div>

            {looksLikeSeries && episodesList.length > 0 ? (
              <div className="px-6 pb-8 pt-6 md:px-10">
                {languageList.length ? (
                  <div className="mb-2">
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                      {languageList.map((lang: string, idx: number) => (
                        <span
                          key={`${lang}-${idx}`}
                          className={`relative pb-2 ${idx === 0 ? 'text-white font-semibold' : 'text-[#b3b3b3]'}`}
                        >
                          {lang}
                          {idx === 0 ? (
                            <span className="absolute left-0 right-0 -bottom-[1px] h-[3px] bg-red-600" />
                          ) : null}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* Header: Episodes title + Season selector */}
                <div className="relative flex items-center justify-between gap-4 mb-0 pt-2 pb-3 after:content-[''] after:absolute after:left-0 after:right-0 after:bottom-0 after:h-px after:bg-white/10">
                  <h3 className="text-2xl font-bold text-white">Episodes</h3>
                  {allSeasons.length > 0 ? (
                    <div className="relative">
                      <select
                        value={selectedModalSeason}
                        onChange={(e) => setSelectedModalSeason(Number(e.target.value))}
                        className="appearance-none rounded bg-[#2b2b2b] py-3.5 pl-4 pr-10 text-base font-semibold text-white outline-none ring-1 ring-white/10 hover:ring-white/20 cursor-pointer"
                      >
                        {allSeasons.map((s) => {
                          const count = episodesList.filter((ep: any) => (ep.season ?? 1) === s).length;
                          return (
                            <option key={s} value={s}>
                              Season {s} ({count} EP)
                            </option>
                          );
                        })}
                      </select>
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </span>
                    </div>
                  ) : null}
                </div>

                {/* Episode list */}
                <div className="space-y-0">
                  {visibleEpisodes.map((ep: any, idx: number) => (
                    <div
                      key={String(ep.number ?? idx)}
                      onClick={() => {
                        const v = getEmbedValue(ep);
                        setSelectedModalSeason(Number(ep?.season ?? selectedModalSeason));
                        if (v) setActiveEmbed(v);
                      }}
                      className="group relative flex items-center gap-4 rounded-sm px-2 py-3 hover:bg-[#2b2b2b] transition-colors cursor-pointer after:content-[''] after:absolute after:left-0 after:right-0 after:bottom-0 after:h-px after:bg-white/10"
                    >
                      {/* Episode number */}
                      <div className="w-14 shrink-0 self-stretch flex items-center justify-center">
                        <span
                          className="text-[18px] font-normal leading-[1] text-white/60"
                          style={{
                            fontFamily:
                              'var(--font-sans), Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans"',
                          }}
                        >
                          {ep.number ?? idx + 1}
                        </span>
                      </div>
                      {/* Thumbnail */}
                      <div className="relative h-[96px] w-[172px] shrink-0 overflow-hidden rounded-md bg-zinc-800">
                        {ep.thumbnail ? (
                          <img
                            src={ep.thumbnail}
                            alt={ep.title || `Episode ${ep.number ?? idx + 1}`}
                            className="h-full w-full object-cover object-center"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-600">
                              <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                          </div>
                        )}
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                          <svg viewBox="0 0 24 24" width="58" height="58" className="drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)]">
                            <circle cx="12" cy="12" r="9.5" fill="rgba(0,0,0,0.35)" stroke="white" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
                            <path d="M9 7v10l10-5z" fill="white" stroke="white" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
                          </svg>
                        </div>
                      </div>
                      {/* Title + duration + description */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[15px] font-semibold text-white truncate">{ep.title || `Episode ${ep.number ?? idx + 1}`}</p>
                          {ep.duration ? (
                            <span className="shrink-0 text-sm font-semibold text-white">
                              {ep.duration}
                            </span>
                          ) : null}
                        </div>
                        {ep.description ? (
                          <p className="mt-1 text-sm leading-5 text-[#b3b3b3] line-clamp-2">{ep.description}</p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            </>
          )
        ) : null}
      </div>
    </div>
  );
}

export default function Home() {
  const [scrolled, setScrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [top10, setTop10] = useState<Movie[]>([]);
  const [selected, setSelected] = useState<Movie | null>(null);
  const [hero, setHero] = useState<Movie | null>(null);
  const [orderedSections, setOrderedSections] = useState<Array<{ key: string; label: string }>>(defaultOrderedSections);
  const [rowMovies, setRowMovies] = useState<Record<string, Movie[]>>({});
  const [isMobile, setIsMobile] = useState(false);
  const [siteHeader, setSiteHeader] = useState<SiteHeaderSettings | null>(null);
  const [siteFooter, setSiteFooter] = useState<SiteFooterSettings | null>(null);
  const [siteDevtool, setSiteDevtool] = useState<SiteDevtoolSettings | null>(null);
  const [movieSectionLinks, setMovieSectionLinks] = useState<Record<string, string[]>>({});
  const [movieSectionLinksOrder, setMovieSectionLinksOrder] = useState<Record<string, string[]>>({});
  const [linksReady, setLinksReady] = useState(false);
  const [devtoolBlocked, setDevtoolBlocked] = useState(false);
  const modalOpenRef = useRef(false);
  const applyScrolledRef = useRef<() => void>(() => {});
  

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 768px)');
    const apply = () => setIsMobile(mq.matches);
    apply();
    if ('addEventListener' in mq) {
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
    (mq as any).addListener(apply);
    return () => (mq as any).removeListener(apply);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/site-settings', { method: 'GET', cache: 'no-store' });
        const json = await res.json();
        if (cancelled) return;
        setSiteHeader((json?.header || null) as SiteHeaderSettings | null);
        setSiteFooter((json?.footer || null) as SiteFooterSettings | null);
        setSiteDevtool((json?.devtool || null) as SiteDevtoolSettings | null);
        const rawLinks = (json?.links || null) as any;
        const rawLinksOrder = (json?.linksOrder || null) as any;
        if (rawLinks && typeof rawLinks === 'object' && !Array.isArray(rawLinks)) {
          setMovieSectionLinks(rawLinks as Record<string, string[]>);
        } else {
          setMovieSectionLinks({});
        }
        if (rawLinksOrder && typeof rawLinksOrder === 'object' && !Array.isArray(rawLinksOrder)) {
          setMovieSectionLinksOrder(rawLinksOrder as Record<string, string[]>);
        } else {
          setMovieSectionLinksOrder({});
        }
      } catch {
        if (cancelled) return;
        setSiteHeader(null);
        setSiteFooter(null);
        setSiteDevtool(null);
        setMovieSectionLinks({});
        setMovieSectionLinksOrder({});
      } finally {
        if (cancelled) return;
        setLinksReady(true);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const devtoolEnabled = !!(siteDevtool as any)?.enabled;

  useEffect(() => {
    if (!devtoolEnabled && devtoolBlocked) {
      setDevtoolBlocked(false);
    }
  }, [devtoolEnabled, devtoolBlocked]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!devtoolEnabled) return;

    const prevUserSelect = document.body.style.userSelect;
    const prevWebkitUserSelect = (document.body.style as any).webkitUserSelect;
    document.body.style.userSelect = 'none';
    (document.body.style as any).webkitUserSelect = 'none';

    const stop = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const onContextMenu = (e: Event) => stop(e);
    const onCopy = (e: Event) => stop(e);
    const onCut = (e: Event) => stop(e);
    const onPaste = (e: Event) => stop(e);
    const onSelectStart = (e: Event) => stop(e);
    const onDragStart = (e: Event) => stop(e);
    const onKeyDown = (e: KeyboardEvent) => {
      const key = String(e.key || '').toLowerCase();
      const isF12 = key === 'f12';
      const isCtrlShift = (e.ctrlKey || e.metaKey) && e.shiftKey;
      const isInspectCombo = isCtrlShift && (key === 'i' || key === 'j' || key === 'c');
      const isViewSourceCombo = (e.ctrlKey || e.metaKey) && (key === 'u' || key === 's');
      if (isF12 || isInspectCombo || isViewSourceCombo) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener('contextmenu', onContextMenu, { capture: true });
    document.addEventListener('copy', onCopy, { capture: true });
    document.addEventListener('cut', onCut, { capture: true });
    document.addEventListener('paste', onPaste, { capture: true });
    document.addEventListener('selectstart', onSelectStart, { capture: true });
    document.addEventListener('dragstart', onDragStart, { capture: true });
    document.addEventListener('keydown', onKeyDown, { capture: true });

    return () => {
      document.body.style.userSelect = prevUserSelect;
      (document.body.style as any).webkitUserSelect = prevWebkitUserSelect;
      document.removeEventListener('contextmenu', onContextMenu, { capture: true } as any);
      document.removeEventListener('copy', onCopy, { capture: true } as any);
      document.removeEventListener('cut', onCut, { capture: true } as any);
      document.removeEventListener('paste', onPaste, { capture: true } as any);
      document.removeEventListener('selectstart', onSelectStart, { capture: true } as any);
      document.removeEventListener('dragstart', onDragStart, { capture: true } as any);
      document.removeEventListener('keydown', onKeyDown, { capture: true } as any);
    };
  }, [devtoolEnabled]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!devtoolEnabled) return;
    if (isMobile) return;
    if (devtoolBlocked) return;

    let consecutive = 0;
    let stopped = false;
    const threshold = 160;

    const check = () => {
      if (stopped) return;
      const w = Math.abs(window.outerWidth - window.innerWidth);
      const h = Math.abs(window.outerHeight - window.innerHeight);
      const open = w > threshold || h > threshold;
      consecutive = open ? consecutive + 1 : 0;
      if (consecutive >= 2) {
        stopped = true;
        setDevtoolBlocked(true);
      }
    };

    const id = window.setInterval(check, 700);
    check();
    return () => {
      window.clearInterval(id);
    };
  }, [devtoolEnabled, devtoolBlocked, isMobile]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    trackEvent({ eventType: 'page_view', path: window.location.pathname });
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!linksReady) return;
      setLoading(true);
      try {
        const getLinkedIdsForSection = (key: string) => {
          const membership = new Set<string>();
          Object.entries(movieSectionLinks || {}).forEach(([movieId, secs]) => {
            if (!movieId) return;
            if (!Array.isArray(secs)) return;
            if (secs.includes(key)) membership.add(movieId);
          });

          const ordered = Array.isArray((movieSectionLinksOrder as any)?.[key]) ? ((movieSectionLinksOrder as any)[key] as any[]) : [];
          const out: string[] = [];
          const outSet = new Set<string>();
          ordered.forEach((mid) => {
            const id = String(mid || '').trim();
            if (!id) return;
            if (!membership.has(id)) return;
            if (outSet.has(id)) return;
            out.push(id);
            outSet.add(id);
          });
          membership.forEach((id) => {
            if (!outSet.has(id)) {
              out.push(id);
              outSet.add(id);
            }
          });
          return out;
        };

        const fetchMoviesForSection = async (key: string, limit: number) => {
          const res = await supabase
            .from("movies")
            .select('*')
            .eq("section", key)
            .order('created_at', { ascending: false })
            .order('id', { ascending: false })
            .limit(limit);

          const base = (res.data as Movie[] || []);
          const baseIds = new Set(base.map((m) => String((m as any)?.id || '')).filter(Boolean));

          const linkedAllIds = getLinkedIdsForSection(key);

          const promotedOrdered = Array.isArray((movieSectionLinksOrder as any)?.[key])
            ? ((movieSectionLinksOrder as any)[key] as any[])
              .map((x) => String(x || '').trim())
              .filter(Boolean)
            : [];
          const effectivePromotedOrdered: string[] = [];
          const effectiveSet = new Set<string>();
          [...promotedOrdered, ...linkedAllIds].forEach((id) => {
            const k = String(id || '').trim();
            if (!k) return;
            if (effectiveSet.has(k)) return;
            effectiveSet.add(k);
            effectivePromotedOrdered.push(k);
          });
          const promotedIndex = new Map<string, number>();
          effectivePromotedOrdered.forEach((id, idx) => {
            if (!promotedIndex.has(id)) promotedIndex.set(id, idx);
          });

          const missingLinkedIds = linkedAllIds.filter((id) => !baseIds.has(id));
          if (!missingLinkedIds.length) {
            return [...base].sort((a: any, b: any) => {
              const aid = String(a?.id || '');
              const bid = String(b?.id || '');
              const ai = promotedIndex.get(aid);
              const bi = promotedIndex.get(bid);
              const ap = ai !== undefined;
              const bp = bi !== undefined;
              if (ap !== bp) return ap ? -1 : 1;
              if (ap && bp && ai !== bi) return (ai as number) - (bi as number);
              const at = a?.created_at ? Date.parse(String(a.created_at)) : 0;
              const bt = b?.created_at ? Date.parse(String(b.created_at)) : 0;
              if (bt !== at) return bt - at;
              return bid.localeCompare(aid);
            });
          }
          const linkedRes = await supabase
            .from('movies')
            .select('*')
            .in('id', missingLinkedIds.slice(0, limit))
            .limit(Math.min(limit, missingLinkedIds.length));
          const merged = [...base, ...((linkedRes.data as Movie[]) || [])];
          const seen = new Set<string>();
          const deduped = merged.filter((m) => {
            const id = String((m as any)?.id || '');
            if (!id) return false;
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
          });
          return deduped.sort((a: any, b: any) => {
            const aid = String(a?.id || '');
            const bid = String(b?.id || '');
            const ai = promotedIndex.get(aid);
            const bi = promotedIndex.get(bid);
            const ap = ai !== undefined;
            const bp = bi !== undefined;
            if (ap !== bp) return ap ? -1 : 1;
            if (ap && bp && ai !== bi) return (ai as number) - (bi as number);
            const at = a?.created_at ? Date.parse(String(a.created_at)) : 0;
            const bt = b?.created_at ? Date.parse(String(b.created_at)) : 0;
            if (bt !== at) return bt - at;
            return bid.localeCompare(aid);
          });
        };

        const defaultOrderMap = new Map(defaultOrderedSections.map((s, index) => [s.key, index + 1]));
        let labelRows: any[] = [];
        let supportsSortOrder = false;
        const labelWithOrder = await supabase
          .from("section_labels")
          .select("key,label,sort_order");
        if (!labelWithOrder.error) {
          labelRows = (labelWithOrder.data as any[]) || [];
          supportsSortOrder = true;
        } else {
          const fallback = await supabase
            .from("section_labels")
            .select("key,label");
          labelRows = (fallback.data as any[]) || [];
        }
        const labelMap = new Map<string, string>();
        (labelRows as any[] | null | undefined)?.forEach((row) => {
          const key = String(row?.key || "");
          const label = String(row?.label || "");
          if (key && label) {
            labelMap.set(key, label);
          }
        });
        const orderMap = new Map<string, number>();
        let maxOrder = defaultOrderedSections.length;
        if (supportsSortOrder) {
          (labelRows as any[] | null | undefined)?.forEach((row) => {
            const key = String(row?.key || "").trim();
            const orderValue = Number(row?.sort_order);
            if (key && Number.isFinite(orderValue)) {
              orderMap.set(key, orderValue);
              if (orderValue > maxOrder) maxOrder = orderValue;
            }
          });
        }
        const defaultRowKeys = new Set(defaultOrderedSections.map((s) => s.key));
        const extraRows = (labelRows as any[] | null | undefined)
          ?.map((row) => ({
            key: String(row?.key || "").trim(),
            label: String(row?.label || "").trim(),
          }))
          .filter((row) => row.key && !defaultRowKeys.has(row.key) && row.key !== "hero")
          .map((row, index) => ({
            key: row.key,
            label: row.label || row.key,
            order: orderMap.get(row.key) ?? (maxOrder + index + 1),
          })) || [];
        const nextOrderedSections = defaultOrderedSections.map((s, index) => ({
          ...s,
          label: labelMap.get(s.key) || s.label,
          order: orderMap.get(s.key) ?? defaultOrderMap.get(s.key) ?? (index + 1),
        }));
        const ordered = [...nextOrderedSections, ...extraRows]
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .map(({ order, ...rest }) => rest);
        const orderedRows = ordered.filter((row) => row.key !== "top10");
        setOrderedSections(ordered);

        const rowsData: Array<[string, Movie[]]> = await Promise.all(
          orderedRows.map(async (section) => [section.key, await fetchMoviesForSection(section.key, 20)] as const)
        );
        const nextMovies: Record<string, Movie[]> = {};
        rowsData.forEach(([key, data]) => {
          nextMovies[key] = data;
        });
        setRowMovies(nextMovies);

        const topRes = await supabase
          .from("movies")
          .select('*')
          .eq("section", "top10")
          .order("rank", { ascending: true })
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(10);
        const topBase = (topRes.data as Movie[] || []);
        const topLinkedIds = getLinkedIdsForSection('top10');
        let topLinked: Movie[] = [];
        if (topLinkedIds.length) {
          const capped = topLinkedIds.slice(0, 50);
          const linkedTopRes = await supabase
            .from('movies')
            .select('*')
            .in('id', capped)
            .limit(Math.min(50, capped.length));
          topLinked = (linkedTopRes.data as Movie[] || []);
        }
        const topMerged = [...topLinked, ...topBase];
        const seen = new Set<string>();
        const dedupedTop = topMerged.filter((m) => {
          const id = String((m as any)?.id || '');
          if (!id) return false;
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        }).sort((a: any, b: any) => {
          const ar = a?.rank ?? null;
          const br = b?.rank ?? null;
          if (ar != null && br != null && Number(ar) !== Number(br)) return Number(ar) - Number(br);
          if (ar == null && br != null) return 1;
          if (ar != null && br == null) return -1;
          const at = a?.created_at ? Date.parse(String(a.created_at)) : 0;
          const bt = b?.created_at ? Date.parse(String(b.created_at)) : 0;
          if (bt !== at) return bt - at;
          const aid = String(a?.id || '');
          const bid = String(b?.id || '');
          return bid.localeCompare(aid);
        }).slice(0, 10);
        setTop10(dedupedTop);

        const heroRes = await supabase
          .from("movies")
          .select('*')
          .eq("section", "hero")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        setHero((heroRes.data as unknown as Movie) || null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [linksReady, movieSectionLinks, movieSectionLinksOrder]);
  
  useEffect(() => {
    const getY = () => {
      if (typeof document !== 'undefined') {
        return (
          document.documentElement.scrollTop ||
          document.body.scrollTop ||
          window.scrollY ||
          0
        );
      }
      return 0;
    };
    const apply = () => {
      if (modalOpenRef.current) return;
      const s = getY() > 10;
      setScrolled(s);
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('scrolled', s);
      }
    };
    applyScrolledRef.current = apply;
    apply();
    const onScroll = () => apply();
    const onWheel = () => apply();
    const onTouchMove = () => apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    const raf = requestAnimationFrame(apply);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    modalOpenRef.current = !!selected;

    document.documentElement.classList.toggle('modal-open', !!selected);

    if (!selected) {
      requestAnimationFrame(() => applyScrolledRef.current());
    }

    return () => {
      document.documentElement.classList.remove('modal-open');
    };
  }, [selected]);

  const handleSelect = (m: Movie) => {
    if (m?.id) {
      trackEvent({
        eventType: 'content_view',
        path: typeof window !== 'undefined' ? window.location.pathname : '',
        contentId: m.id,
        contentTitle: m.title,
        contentSection: String((m as any)?.section || ''),
      });
    }
    setSelected(m);
  };

  const allMovies = (() => {
    const all: Movie[] = [];
    if (hero) all.push(hero);
    all.push(...top10);
    Object.values(rowMovies).forEach((arr) => all.push(...(arr || [])));
    const seen = new Set<string>();
    return all.filter((m) => {
      if (!m || !m.id) return false;
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  })();

  const telegramUrl = String((siteHeader as any)?.telegramUrl || '').trim();

  if (devtoolBlocked) {
    return <div className="min-h-screen bg-white" />;
  }

  return (
    <div className={`min-h-screen text-white ${isMobile ? 'bg-black' : 'bg-[#141414]'}`}>
      <Header
        scrolled={scrolled}
        movies={allMovies}
        onSelect={handleSelect}
        isMobile={isMobile}
        settings={siteHeader}
      />
      <main className={isMobile ? 'bg-black pt-[72px]' : undefined}>
        {isMobile ? (
          <div className="md:hidden bg-black px-0 pt-3 pb-4">
            {(() => {
              const rawNavTv = (siteHeader as any)?.nav?.tv as unknown;
              const rawNavMovies = (siteHeader as any)?.nav?.movies as unknown;
              const rawNavNew = (siteHeader as any)?.nav?.new as unknown;
              const navTvText = rawNavTv === undefined ? 'TV Shows' : String(rawNavTv || '').trim();
              const navMoviesText = rawNavMovies === undefined ? 'Movies' : String(rawNavMovies || '').trim();
              const navNewText = rawNavNew === undefined ? 'New & Popular' : String(rawNavNew || '').trim();
              const telegramUrl = String((siteHeader as any)?.telegramUrl || '').trim();
              const rawTelegramLabel = (siteHeader as any)?.telegramLabel as unknown;
              const telegramLabel = rawTelegramLabel === undefined ? 'Telegram' : String(rawTelegramLabel || '').trim();
              const telegramLabelText = telegramLabel || 'Telegram';
              return (
                <div className="hide-scrollbar flex items-center gap-3 overflow-x-auto px-3">
                  {navTvText ? (
                    <a
                      href="#tv"
                      className="whitespace-nowrap rounded-full border border-white/30 bg-black px-5 py-[9px] text-[13px] font-semibold text-white/95"
                    >
                      {navTvText}
                    </a>
                  ) : null}
                  {navMoviesText ? (
                    <a
                      href="#movies"
                      className="whitespace-nowrap rounded-full border border-white/30 bg-black px-5 py-[9px] text-[13px] font-semibold text-white/95"
                    >
                      {navMoviesText}
                    </a>
                  ) : null}
                  {navNewText ? (
                    <a
                      href="#new"
                      className="whitespace-nowrap rounded-full border border-white/30 bg-black px-5 py-[9px] text-[13px] font-semibold text-white/95"
                    >
                      {navNewText}
                    </a>
                  ) : null}
                  {telegramUrl ? (
                    <a
                      href={telegramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="whitespace-nowrap rounded-full border border-white/30 bg-black px-5 py-[9px] text-[13px] font-semibold text-white/95"
                    >
                      {telegramLabelText}
                    </a>
                  ) : null}
                </div>
              );
            })()}
          </div>
        ) : null}
        <Hero movie={hero} onSelect={handleSelect} isMobile={isMobile} loading={loading} />
        {(() => {
          let nonTopIdx = -1;
          return orderedSections.map((section) => {
            const isTop10 = section.key === "top10";
            if (!isTop10) nonTopIdx += 1;
            const anchorId = isTop10 ? 'new' : nonTopIdx === 0 ? 'tv' : nonTopIdx === 1 ? 'movies' : undefined;
            const anchorClass = anchorId ? 'scroll-mt-32' : undefined;
            return isTop10 ? (
              <div key={section.key} id={anchorId} className={anchorClass}>
                <Top10Row title={section.label} movies={top10} onSelect={handleSelect} isMobile={isMobile} loading={loading} />
              </div>
            ) : (
              <div key={section.key} id={anchorId} className={anchorClass}>
                <Row
                  title={section.label}
                  movies={rowMovies[section.key] || []}
                  onSelect={handleSelect}
                  isMobile={isMobile}
                  loading={loading}
                />
              </div>
            );
          });
        })()}
      </main>
      <footer className="mt-10 border-t border-white/10 bg-[#0b0b0b]">
        <div className="mx-auto max-w-7xl px-6 py-10 text-sm text-zinc-400">
          {(siteFooter?.questionsText || '').trim() ? (
            <div className="text-zinc-300">{String(siteFooter?.questionsText || '').trim()}</div>
          ) : null}
          {(siteFooter?.createdText || '').trim() ? (
            <div className="mt-3 text-zinc-500">{String(siteFooter?.createdText || '').trim()}</div>
          ) : null}
          {(siteFooter?.brandText || '').trim() ? (
            <div className="mt-2 text-zinc-500">{String(siteFooter?.brandText || '').trim()}</div>
          ) : null}
        </div>
      </footer>
      <Modal movie={selected} onClose={() => setSelected(null)} isMobile={isMobile} allMovies={allMovies} onSelectMovie={handleSelect} telegramUrl={telegramUrl} />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[3500] bg-[rgba(255,178,102,0.12)] mix-blend-soft-light"
      />
    </div>
  );
}
