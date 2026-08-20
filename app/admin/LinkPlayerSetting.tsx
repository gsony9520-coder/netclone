'use client';

import { useState, useEffect, useRef } from 'react';

type Episode = {
  id: string;
  season: number;
  number: number;
  title: string;
  thumbnail: string;
  description: string;
  duration: string;
  embed_link: string;
};

type Props = {
  initialPlayerType?: 'movie' | 'series';
  initialEmbedCode?: string;
  initialEpisodes?: any[];
};

export default function LinkPlayerSetting({
  initialPlayerType = 'movie',
  initialEmbedCode = '',
  initialEpisodes = [],
}: Props) {
  const [playerType, setPlayerType] = useState<'movie' | 'series'>(initialPlayerType);
  const [thumbnailPreviews, setThumbnailPreviews] = useState<Record<string, string>>({});
  const blobUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    return () => { blobUrlsRef.current.forEach((u) => URL.revokeObjectURL(u)); };
  }, []);

  const [episodes, setEpisodes] = useState<Episode[]>(() => {
    if (initialEpisodes && initialEpisodes.length > 0) {
      return initialEpisodes.map((ep: any, idx: number) => ({
        id: String(idx),
        season: ep.season ?? 1,
        number: ep.number ?? idx + 1,
        title: ep.title ?? '',
        thumbnail: ep.thumbnail ?? '',
        description: ep.description ?? '',
        duration: ep.duration ?? '',
        embed_link: ep.embed_link ?? '',
      }));
    }
    if (initialPlayerType === 'series') {
      return [{ id: String(Date.now()), season: 1, number: 1, title: '', thumbnail: '', description: '', duration: '', embed_link: '' }];
    }
    return [];
  });

  const firstInitialSeason = (initialEpisodes && initialEpisodes.length > 0) ? (initialEpisodes[0].season ?? 1) : 1;
  const [selectedSeason, setSelectedSeason] = useState(firstInitialSeason);
  const [embedCode, setEmbedCode] = useState(initialEmbedCode);

  const seasonEpisodes = episodes.filter((ep) => ep.season === selectedSeason);

  const ensureSeasonHasEpisode = (season: number) => {
    setEpisodes((prev) => {
      const hasAny = prev.some((ep) => ep.season === season);
      if (hasAny) return prev;
      return [
        ...prev,
        {
          id: String(Date.now()),
          season,
          number: 1,
          title: '',
          thumbnail: '',
          description: '',
          duration: '',
          embed_link: '',
        },
      ];
    });
  };

  const addEpisode = () => {
    const seasonEps = episodes.filter((ep) => ep.season === selectedSeason);
    setEpisodes((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        season: selectedSeason,
        number: seasonEps.length + 1,
        title: '',
        thumbnail: '',
        description: '',
        duration: '',
        embed_link: '',
      },
    ]);
  };

  const removeEpisode = (id: string) => {
    setEpisodes((prev) => prev.filter((ep) => ep.id !== id));
  };

  const updateEpisode = (id: string, field: keyof Omit<Episode, 'id' | 'season' | 'number'>, value: string) => {
    setEpisodes((prev) =>
      prev.map((ep) => (ep.id === id ? { ...ep, [field]: value } : ep))
    );
  };

  const episodesJson = JSON.stringify(
    episodes.map(({ id, ...rest }) => rest)
  );

  return (
    <div className="md:col-span-2 space-y-4">
      <div className="md:col-span-2 h-[2px] bg-emerald-600/60" />
      <div className="text-center text-sm font-semibold text-emerald-400">Link / Player Setting</div>

      {/* Movie / Series Toggle */}
      <div className="flex rounded-lg overflow-hidden ring-1 ring-zinc-700">
        <button
          type="button"
          onClick={() => setPlayerType('movie')}
          className={`flex-1 px-4 py-2.5 text-sm font-semibold transition-colors ${
            playerType === 'movie'
              ? 'bg-emerald-600 text-white'
              : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
          }`}
        >
          Movie
        </button>
        <button
          type="button"
          onClick={() => {
            setPlayerType('series');
            setEpisodes((prev) => {
              if (prev.length === 0) {
                return [{
                  id: String(Date.now()),
                  season: 1,
                  number: 1,
                  title: '',
                  thumbnail: '',
                  description: '',
                  duration: '',
                  embed_link: '',
                }];
              }
              return prev;
            });
            setSelectedSeason(1);
          }}
          className={`flex-1 px-4 py-2.5 text-sm font-semibold transition-colors ${
            playerType === 'series'
              ? 'bg-emerald-600 text-white'
              : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800'
          }`}
        >
          Series
        </button>
      </div>

      <input type="hidden" name="player_type" value={playerType} />

      {playerType === 'movie' ? (
        /* ── MOVIE MODE ── */
        <div className="space-y-3">
          <textarea
            name="embed_code"
            value={embedCode}
            onChange={(e) => setEmbedCode(e.target.value)}
            placeholder="Embed Code / Embed Link (SeekStreaming/JW Player/URL)"
            className="min-h-40 w-full rounded bg-zinc-900 p-3 text-sm outline-none ring-1 ring-zinc-800"
          />
          <input type="hidden" name="embed_link" value="" />
          <input type="hidden" name="episodes" value="[]" />
        </div>
      ) : (
        /* ── SERIES MODE ── */
        <div className="space-y-4">
          <input type="hidden" name="embed_code" value="" />
          <input type="hidden" name="embed_link" value="" />

          {/* Season Selector */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-400 shrink-0">Season:</span>
            <div className="relative w-44">
              <select
                value={selectedSeason}
                onChange={(e) => {
                  const nextSeason = Number(e.target.value);
                  setSelectedSeason(nextSeason);
                  ensureSeasonHasEpisode(nextSeason);
                }}
                className="w-full appearance-none rounded bg-zinc-900 p-3 pr-10 text-sm outline-none ring-1 ring-zinc-800"
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map((s) => (
                  <option key={s} value={s}>
                    Season {s}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
                <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </div>
            <span className="text-xs text-zinc-500">
              {seasonEpisodes.length} episode{seasonEpisodes.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Episode List for selected season */}
          <div className="space-y-3">
            {seasonEpisodes.length === 0 && (
              <p className="rounded bg-zinc-900/60 p-3 text-sm text-zinc-500 italic ring-1 ring-zinc-800">
                No episodes for Season {selectedSeason} yet. Click &quot;Add Episode&quot; below.
              </p>
            )}
            {seasonEpisodes.map((ep) => (
              <div key={ep.id} className="rounded-lg bg-zinc-900 p-3 ring-1 ring-zinc-800 space-y-2">
                {/* Row 1: episode number + title + duration + remove */}
                <div className="flex items-center gap-2">
                  <span className="shrink-0 min-w-[2rem] text-center text-xs font-bold text-emerald-400 bg-zinc-800 rounded px-1.5 py-1">
                    E{ep.number}
                  </span>
                  <input
                    type="text"
                    value={ep.title}
                    onChange={(e) => updateEpisode(ep.id, 'title', e.target.value)}
                    placeholder={`Episode ${ep.number} title`}
                    className="flex-1 rounded bg-zinc-800 p-2 text-sm outline-none ring-1 ring-zinc-700"
                  />
                  <input
                    type="text"
                    value={ep.duration}
                    onChange={(e) => updateEpisode(ep.id, 'duration', e.target.value)}
                    placeholder="Duration (e.g. 45m)"
                    className="w-28 rounded bg-zinc-800 p-2 text-sm outline-none ring-1 ring-zinc-700"
                  />
                  <button
                    type="button"
                    onClick={() => removeEpisode(ep.id)}
                    title="Remove episode"
                    className="shrink-0 grid place-items-center rounded p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
                {/* Row 2: thumbnail upload */}
                <div className="flex items-center gap-3">
                  <div className="h-14 w-24 shrink-0 overflow-hidden rounded bg-zinc-700 flex items-center justify-center">
                    {thumbnailPreviews[ep.id] || ep.thumbnail ? (
                      <img
                        src={thumbnailPreviews[ep.id] || ep.thumbnail}
                        alt="thumb"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-500">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="mb-1 text-xs text-zinc-500">Thumbnail Image</p>
                    <input
                      type="file"
                      name={`ep_thumb_s${ep.season}_e${ep.number}`}
                      accept="image/*"
                      className="w-full text-xs text-zinc-300 file:mr-2 file:cursor-pointer file:rounded file:border-0 file:bg-zinc-700 file:px-2 file:py-1 file:text-xs file:text-white hover:file:bg-zinc-600"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const blobUrl = URL.createObjectURL(file);
                          blobUrlsRef.current.push(blobUrl);
                          setThumbnailPreviews((prev) => ({ ...prev, [ep.id]: blobUrl }));
                        }
                      }}
                    />
                  </div>
                  {ep.thumbnail && !ep.thumbnail.startsWith('blob:') ? (
                    <input type="hidden" name={`ep_thumb_url_s${ep.season}_e${ep.number}`} value={ep.thumbnail} />
                  ) : null}
                </div>
                {/* Row 3: short description */}
                <textarea
                  value={ep.description}
                  onChange={(e) => updateEpisode(ep.id, 'description', e.target.value)}
                  placeholder="Short description (optional)"
                  rows={2}
                  className="w-full rounded bg-zinc-800 p-2 text-sm outline-none ring-1 ring-zinc-700 resize-none"
                />
                {/* Row 4: embed link */}
                <input
                  type="text"
                  value={ep.embed_link}
                  onChange={(e) => updateEpisode(ep.id, 'embed_link', e.target.value)}
                  placeholder="Embed Code / Embed Link (https://...)"
                  className="w-full rounded bg-zinc-800 p-2 text-sm outline-none ring-1 ring-zinc-700"
                />
              </div>
            ))}
          </div>

          {/* Add Episode Button */}
          <button
            type="button"
            onClick={addEpisode}
            className="flex items-center gap-2 rounded bg-zinc-700 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-600 transition-colors"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Episode (Season {selectedSeason})
          </button>

          {/* Episodes JSON hidden input for form submission */}
          <input type="hidden" name="episodes" value={episodesJson} />
        </div>
      )}
    </div>
  );
}
