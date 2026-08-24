import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import ImageFileInput from './ImageFileInput';
import ConfirmButton from './ConfirmButton';
import FormStatusOverlay from './FormStatusOverlay';
import SectionRenameList from './SectionRenameList';
import LinkPlayerSetting from './LinkPlayerSetting';
import InlineActionSelect from './InlineActionSelect';
import Link from 'next/link';
import { Buffer } from 'buffer';

export const runtime = 'nodejs';

const SITE_HEADER_KEY = 'site_header_settings';
const SITE_FOOTER_KEY = 'site_footer_settings';
const SITE_DEVTOOL_KEY = 'site_devtool_settings';
const MOVIE_SECTION_LINKS_KEY = 'movie_section_links';
const MOVIE_SECTION_LINKS_ORDER_KEY = 'movie_section_links_order';

const TAG_OPTIONS = [
  'Action',
  'Adventure',
  'Award-Winning',
  'Animation',
  'Blockbuster',
  'Comedy',
  'Crime',
  'Documentary',
  'Drama',
  'Emotional',
  'Family',
  'Fantasy',
  'Feel-Good',
  'Historical',
  'Horror',
  'International',
  'Kids',
  'Mystery',
  'Reality',
  'Romance',
  'Sports',
  'Sci-Fi',
  'Suspenseful',
  'Teen',
  'Thriller',
  'War',
];

function parseSettingsJson(raw: string | null | undefined) {
  const txt = String(raw || '').trim();
  if (!txt) return null;
  try {
    const parsed = JSON.parse(txt);
    if (parsed && typeof parsed === 'object') return parsed as any;
    return null;
  } catch {
    return null;
  }
}

function parseLinksJson(raw: string | null | undefined) {
  const txt = String(raw || '').trim();
  if (!txt) return {} as Record<string, string[]>;
  try {
    const parsed = JSON.parse(txt);
    if (!parsed || typeof parsed !== 'object') return {} as Record<string, string[]>;
    return parsed as Record<string, string[]>;
  } catch {
    return {} as Record<string, string[]>;
  }
}

async function isAuthed() {
  const c = (await cookies()).get('admin_auth')?.value;
  return c === '1';
}

async function getAdminPassword() {
  const { data, error } = await supabaseAdmin
    .from('admin_settings')
    .select('value')
    .eq('key', 'admin_password')
    .maybeSingle();
  if (error) return '';
  return data?.value ? String(data.value) : '';
}

export default async function AdminPage({ searchParams }: { searchParams?: Promise<{ sec?: string; mode?: string; id?: string; q?: string; trash?: string; panel?: string; csec?: string; msg?: string; err?: string; atab?: string; arange?: string; afrom?: string; ato?: string }> }) {
  const ok = await isAuthed();
  if (!ok) {
    return <LoginForm />;
  }
  const sp = (searchParams ? await searchParams : ({} as any));
  const sec = (sp?.sec || 'top10') as string;
  const mode = (sp?.mode || 'list') as string;
  const id = (sp?.id || '') as string;
  const q = (sp?.q || '') as string;
  const trash = (sp?.trash || '') as string;
  const panel = (sp?.panel || 'content') as string;
  const csec = (sp?.csec || 'sections') as string;
  const msg = (sp?.msg || '') as string;
  const err = (sp?.err || '') as string;
  const atab = (sp?.atab || '') as string;
  const arange = (sp?.arange || '') as string;
  const afrom = (sp?.afrom || '') as string;
  const ato = (sp?.ato || '') as string;
  return <Dashboard initialSection={sec} initialMode={mode} initialId={id} initialQuery={q} initialTrash={trash} initialPanel={panel} initialCustomSection={csec} initialMessage={msg} initialError={err} initialAnalysisTab={atab} initialAnalysisRange={arange} initialAnalysisFrom={afrom} initialAnalysisTo={ato} />;
}

function LoginForm() {
  async function login(formData: FormData) {
    'use server';
    const pass = formData.get('password');
    const stored = await getAdminPassword();
    const expected = stored || process.env.ADMIN_PASSWORD;
    if (pass && expected && String(pass) === expected) {
      (await cookies()).set('admin_auth', '1', { httpOnly: true, sameSite: 'lax', path: '/' });
      redirect('/admin');
    }
  }
  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-2xl font-bold">Admin Login</h1>
      <form action={login} className="space-y-4">
        <input name="password" type="password" placeholder="Password" className="w-full rounded bg-zinc-900 p-3 outline-none ring-1 ring-zinc-800" />
        <button className="rounded bg-emerald-600 px-4 py-2 font-semibold hover:bg-emerald-500">Login</button>
      </form>
    </div>
  );
}

async function Dashboard({ initialSection, initialMode, initialId, initialQuery, initialTrash, initialPanel, initialCustomSection, initialMessage, initialError, initialAnalysisTab, initialAnalysisRange, initialAnalysisFrom, initialAnalysisTo }: { initialSection: string; initialMode: string; initialId?: string; initialQuery?: string; initialTrash?: string; initialPanel?: string; initialCustomSection?: string; initialMessage?: string; initialError?: string; initialAnalysisTab?: string; initialAnalysisRange?: string; initialAnalysisFrom?: string; initialAnalysisTo?: string }) {
  const defaultSections: Array<{ key: string; label: string }> = [
    { key: 'hero', label: 'Hero Section' },
    { key: 'top10', label: 'Top 10 Global' },
    { key: 'trending', label: 'Trending TV Shows' },
    { key: 'bollywood', label: 'Bollywood Movies' },
    { key: 'hollywood', label: 'Hollywood Movies' },
    { key: 'korean', label: 'Korean TV Shows' },
    { key: 'anime', label: 'Anime' },
    { key: 'animated', label: 'Animated Movies' },
  ];
  const defaultOrderMap = new Map(defaultSections.map((s, index) => [s.key, index + 1]));
  let labelRows: any[] = [];
  let labelError: any = null;
  let supportsSortOrder = false;
  const labelWithOrder = await supabaseAdmin
    .from('section_labels')
    .select('key,label,sort_order');
  if (!labelWithOrder.error) {
    labelRows = (labelWithOrder.data as any[]) || [];
    supportsSortOrder = true;
  } else {
    const fallback = await supabaseAdmin
      .from('section_labels')
      .select('key,label');
    labelRows = (fallback.data as any[]) || [];
    labelError = fallback.error;
  }
  const labelMap = new Map<string, string>();
  if (!labelError && labelRows) {
    labelRows.forEach((row: any) => {
      if (row?.key && row?.label) {
        labelMap.set(String(row.key), String(row.label));
      }
    });
  }
  const orderMap = new Map<string, number>();
  let maxOrder = defaultSections.length;
  if (supportsSortOrder) {
    labelRows.forEach((row: any) => {
      const key = String(row?.key || '').trim();
      const orderValue = Number(row?.sort_order);
      if (key && Number.isFinite(orderValue)) {
        orderMap.set(key, orderValue);
        if (orderValue > maxOrder) maxOrder = orderValue;
      }
    });
  }
  const defaultSectionKeys = new Set(defaultSections.map((s) => s.key));
  const extraSections = (labelRows as any[] | null | undefined)
    ?.map((row) => ({
      key: String(row?.key || '').trim(),
      label: String(row?.label || '').trim(),
    }))
    .filter((row) => row.key && !defaultSectionKeys.has(row.key))
    .map((row, index) => ({
      key: row.key,
      label: row.label || row.key,
      isCustom: true,
      order: orderMap.get(row.key) ?? (maxOrder + index + 1),
    })) || [];
  const sections = [
    ...defaultSections.map((s, index) => ({
      ...s,
      label: labelMap.get(s.key) || s.label,
      isCustom: false,
      order: orderMap.get(s.key) ?? defaultOrderMap.get(s.key) ?? (index + 1),
    })),
    ...extraSections,
  ].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const customSections = sections
    .filter((s) => s.key !== 'hero')
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const heroSection = sections.find((section) => section.key === 'hero');
  const renameSections = heroSection ? [heroSection, ...customSections] : customSections;
  const maxSectionOrder = Math.max(0, ...sections.map((section) => section.order || 0));

  const { data: siteSettingRows } = await supabaseAdmin
    .from('admin_settings')
    .select('key,value')
    .in('key', [SITE_HEADER_KEY, SITE_FOOTER_KEY, SITE_DEVTOOL_KEY, MOVIE_SECTION_LINKS_KEY]);
  const siteSettingsMap = new Map<string, string>();
  (siteSettingRows as any[] | null | undefined)?.forEach((row: any) => {
    const k = String(row?.key || '').trim();
    if (!k) return;
    siteSettingsMap.set(k, row?.value ? String(row.value) : '');
  });
  const headerSettings = parseSettingsJson(siteSettingsMap.get(SITE_HEADER_KEY)) || {};
  const footerSettings = parseSettingsJson(siteSettingsMap.get(SITE_FOOTER_KEY)) || {};
  const devtoolSettings = parseSettingsJson(siteSettingsMap.get(SITE_DEVTOOL_KEY)) || {};
  const movieSectionLinks = parseLinksJson(siteSettingsMap.get(MOVIE_SECTION_LINKS_KEY));

  const buildReturnTo = (opts: { sec: string; q?: string; trashMode?: boolean }) => {
    return `/admin?panel=content&sec=${encodeURIComponent(opts.sec)}&mode=list${opts.trashMode ? '&trash=1' : ''}${opts.q ? `&q=${encodeURIComponent(opts.q)}` : ''}`;
  };

  async function setMovieTag(formData: FormData) {
    'use server';
    const ok = await isAuthed();
    if (!ok) redirect('/admin');
    const id = String(formData.get('id') || '').trim();
    const tag = String(formData.get('tag') || '').trim();
    const returnTo = String(formData.get('return_to') || '').trim() || '/admin?panel=content';
    if (!id) redirect(returnTo);
    if (!tag) redirect(returnTo);

    if (tag === '__remove__') {
      const attempt1 = await supabaseAdmin
        .from('movies')
        .update({ tags: [] } as any)
        .eq('id', id);
      if (attempt1.error) {
        const attempt2 = await supabaseAdmin
          .from('movies')
          .update({ tags: '' } as any)
          .eq('id', id);
        if (attempt2.error) {
          redirect(`${returnTo}&err=${encodeURIComponent(attempt2.error.message || 'tag_update_failed')}`);
        }
      }
      revalidatePath('/admin');
      revalidatePath('/');
      redirect(returnTo);
    }

    const attempt1 = await supabaseAdmin
      .from('movies')
      .update({ tags: [tag] } as any)
      .eq('id', id);

    if (attempt1.error) {
      const attempt2 = await supabaseAdmin
        .from('movies')
        .update({ tags: tag } as any)
        .eq('id', id);
      if (attempt2.error) {
        redirect(`${returnTo}&err=${encodeURIComponent(attempt2.error.message || 'tag_update_failed')}`);
      }
    }

    revalidatePath('/admin');
    revalidatePath('/');
    redirect(returnTo);
  }

  async function linkMovieToSection(formData: FormData) {
    'use server';
    const ok = await isAuthed();
    if (!ok) redirect('/admin');
    const id = String(formData.get('id') || '').trim();
    const rawTargetSection = String(formData.get('link_section') || '').trim();
    let targetSection = rawTargetSection;
    let top10Rank: number | null = null;
    const top10Match = rawTargetSection.match(/^top10__(\d+)$/);
    if (top10Match?.[1]) {
      const n = Number(top10Match[1]);
      if (Number.isFinite(n) && n >= 1 && n <= 10) {
        targetSection = 'top10';
        top10Rank = n;
      }
    }
    const returnTo = String(formData.get('return_to') || '').trim() || '/admin?panel=content';
    if (!id || !targetSection) redirect(returnTo);

    const { data } = await supabaseAdmin
      .from('admin_settings')
      .select('key,value')
      .in('key', [MOVIE_SECTION_LINKS_KEY, MOVIE_SECTION_LINKS_ORDER_KEY]);

    const settingsMap = new Map<string, string>();
    (data as any[] | null | undefined)?.forEach((row: any) => {
      const k = String(row?.key || '').trim();
      if (!k) return;
      settingsMap.set(k, row?.value ? String(row.value) : '');
    });

    const existingLinks = parseLinksJson(settingsMap.get(MOVIE_SECTION_LINKS_KEY));
    const existingOrder = parseLinksJson(settingsMap.get(MOVIE_SECTION_LINKS_ORDER_KEY));

    const nextLinks: Record<string, string[]> = { ...existingLinks };
    const nextOrder: Record<string, string[]> = { ...existingOrder };

    if (targetSection === '__remove__') {
      const linkedSecs = Array.isArray(nextLinks[id]) ? nextLinks[id] : [];
      const hadTop10 = linkedSecs.map((s) => String(s || '').trim()).includes('top10');
      delete nextLinks[id];
      linkedSecs.forEach((secKey) => {
        const k = String(secKey || '').trim();
        if (!k) return;
        const arr = Array.isArray(nextOrder[k]) ? nextOrder[k] : [];
        const cleaned = arr.map((x) => String(x).trim()).filter(Boolean).filter((mid) => mid !== id);
        if (cleaned.length) nextOrder[k] = cleaned;
        else delete nextOrder[k];
      });

      if (hadTop10) {
        try {
          const movieRow = await supabaseAdmin
            .from('movies')
            .select('section')
            .eq('id', id)
            .maybeSingle();
          const movieSection = String((movieRow.data as any)?.section || '').trim();
          if (movieSection !== 'top10') {
            await supabaseAdmin
              .from('movies')
              .update({ rank: null } as any)
              .eq('id', id);
          }
        } catch (e) {
          console.error('failed to clear top10 rank on unlink', e);
        }
      }
    } else {
      const prev = Array.isArray(nextLinks[id]) ? nextLinks[id] : [];
      const normalized = prev.map((s) => String(s).trim()).filter(Boolean);
      if (!normalized.includes(targetSection)) {
        normalized.push(targetSection);
      }
      nextLinks[id] = normalized;

      const prevOrder = Array.isArray(nextOrder[targetSection]) ? nextOrder[targetSection] : [];
      const cleaned = prevOrder.map((x) => String(x).trim()).filter(Boolean).filter((mid) => mid !== id);
      cleaned.unshift(id);
      nextOrder[targetSection] = cleaned;

      if (targetSection === 'top10' && top10Rank != null) {
        try {
          await supabaseAdmin
            .from('movies')
            .update({ rank: null } as any)
            .eq('rank', top10Rank)
            .neq('id', id);
          await supabaseAdmin
            .from('movies')
            .update({ rank: top10Rank } as any)
            .eq('id', id);
        } catch (e) {
          console.error('failed to set top10 rank', e);
        }
      }
    }

    await supabaseAdmin
      .from('admin_settings')
      .upsert(
        [
          { key: MOVIE_SECTION_LINKS_KEY, value: JSON.stringify(nextLinks) },
          { key: MOVIE_SECTION_LINKS_ORDER_KEY, value: JSON.stringify(nextOrder) },
        ],
        { onConflict: 'key' }
      );

    revalidatePath('/admin');
    revalidatePath('/');
    redirect(returnTo);
  }

  async function addMovie(formData: FormData) {
    'use server';
    try {
      const ok = await isAuthed();
      if (!ok) {
        redirect('/admin');
      }
      const title = String(formData.get('title') || '');
      const posterUrlInput = String(formData.get('poster_url') || '').trim();
      const posterUrlUploadExisting = String(formData.get('poster_url_existing') || '').trim();
      const posterUrlExternalExisting = String(formData.get('poster_url_external_existing') || '').trim();
      const backdropUrlInput = String(formData.get('backdrop_url') || '').trim();
      const backdropUrlUploadExisting = String(formData.get('backdrop_url_existing') || '').trim();
      const backdropUrlExternalExisting = String(formData.get('backdrop_url_external_existing') || '').trim();
      const mobilePosterUrlInput = String(formData.get('mobile_poster_url') || '').trim();
      const mobilePosterUrlUploadExisting = String(formData.get('mobile_poster_url_existing') || '').trim();
      const mobilePosterUrlExternalExisting = String(formData.get('mobile_poster_url_external_existing') || '').trim();
      const mobileBackdropUrlInput = String(formData.get('mobile_backdrop_url') || '').trim();
      const mobileBackdropUrlUploadExisting = String(formData.get('mobile_backdrop_url_existing') || '').trim();
      const mobileBackdropUrlExternalExisting = String(formData.get('mobile_backdrop_url_external_existing') || '').trim();
      const logoUrlInput = String(formData.get('logo_url') || '').trim();
      const logoUrlUploadExisting = String(formData.get('logo_url_existing') || '').trim();
      const logoUrlExternalExisting = String(formData.get('logo_url_external_existing') || '').trim();
      const embed_code_input = String(formData.get('embed_code') || '');
      const embed_link_input = String(formData.get('embed_link') || '');
      const section = String(formData.get('section') || '').trim();
      const rankStr = String(formData.get('rank') || '');
      const rank = rankStr ? Number(rankStr) : null;
      const yearStr = String(formData.get('year') || '').trim();
      const yearNum = yearStr ? Number(yearStr) : null;
      const year = Number.isFinite(yearNum as any) ? (yearNum as number) : null;
      const cast = String(formData.get('cast') || '').trim();
      const maturity = String(formData.get('maturity') || '').trim();
      const maturity_detail = String(formData.get('maturity_detail') || '').trim();
      const genres = String(formData.get('genres') || '').trim();
      const description = String(formData.get('description') || '').trim();
      const tagsRaw = String(formData.get('tags') || '').trim();
      const tags = tagsRaw
        ? tagsRaw
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
        : null;
      const tagsText = tagsRaw || null;
      const languagesRaw = String(formData.get('languages') || '').trim();
      const languages = languagesRaw
        ? languagesRaw
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
        : null;
      const languagesText = languagesRaw || null;
      const contentType = String(formData.get('content_type') || '').trim();
      const playerType = String(formData.get('player_type') || '').trim();
      const is_series = (contentType === 'series' || playerType === 'series') ? true : false;
      const episodesRaw = String(formData.get('episodes') || '').trim();
      let episodes: any = null;
      if (episodesRaw) {
        try {
          const parsed = JSON.parse(episodesRaw);
          episodes = Array.isArray(parsed) ? parsed : null;
        } catch {
          episodes = null;
        }
      }
      const idToEdit = String(formData.get('id') || '');
      const postersBucket = process.env.SUPABASE_POSTERS_BUCKET || 'posters';
      const backdropsBucket = process.env.SUPABASE_BACKDROPS_BUCKET || 'backdrops';

    if (episodes && Array.isArray(episodes)) {
      episodes = await Promise.all(
        episodes.map(async (ep: any) => {
          const fileKey = `ep_thumb_s${ep.season}_e${ep.number}`;
          const urlKey = `ep_thumb_url_s${ep.season}_e${ep.number}`;
          const thumbFile = formData.get(fileKey) as unknown as File | null;
          const existingUrl = String(formData.get(urlKey) || '').trim();
          if (thumbFile && (thumbFile as any).size > 0) {
            const thumbPath = `episodes/${Date.now()}-${Math.random().toString(36).slice(2)}-${(thumbFile as any).name || 'thumb'}`;
            const thumbBuffer = Buffer.from(await thumbFile.arrayBuffer());
            const { error } = await supabaseAdmin.storage.from(postersBucket).upload(thumbPath, thumbBuffer, {
              contentType: (thumbFile as any).type || 'image/jpeg',
              upsert: true,
            });
            if (!error) {
              const { data } = supabaseAdmin.storage.from(postersBucket).getPublicUrl(thumbPath);
              return { ...ep, thumbnail: data.publicUrl };
            }
          } else if (existingUrl) {
            return { ...ep, thumbnail: existingUrl };
          }
          return ep;
        })
      );
    }

    let poster_url: any = posterUrlUploadExisting || null;
    let poster_url_external: any = posterUrlInput || posterUrlExternalExisting || null;
    const posterFile = formData.get('poster_file') as unknown as File | null;
    const removePoster = String(formData.get('poster_file_remove') || '') === '1';
    if (!removePoster && posterFile && (posterFile as any).size > 0) {
      const posterPath = `movies/${Date.now()}-${Math.random().toString(36).slice(2)}-${(posterFile as any).name || 'poster'}`;
      const posterBuffer = Buffer.from(await posterFile.arrayBuffer());
      const { error } = await supabaseAdmin.storage.from(postersBucket).upload(posterPath, posterBuffer, {
        contentType: (posterFile as any).type || 'image/jpeg',
        upsert: true,
      });
      if (!error) {
        const { data } = supabaseAdmin.storage.from(postersBucket).getPublicUrl(posterPath);
        poster_url = data.publicUrl;
      }
    }
    if (removePoster) {
      poster_url = null as any;
    }

    let backdrop_url: any = backdropUrlUploadExisting || null;
    let backdrop_url_external: any = backdropUrlInput || backdropUrlExternalExisting || null;
    const backdropFile = formData.get('backdrop_file') as unknown as File | null;
    const removeBackdrop = String(formData.get('backdrop_file_remove') || '') === '1';
    if (!removeBackdrop && backdropFile && (backdropFile as any).size > 0) {
      const backdropPath = `backdrops/${Date.now()}-${Math.random().toString(36).slice(2)}-${(backdropFile as any).name || 'backdrop'}`;
      const backdropBuffer = Buffer.from(await backdropFile.arrayBuffer());
      const { error } = await supabaseAdmin.storage.from(backdropsBucket).upload(backdropPath, backdropBuffer, {
        contentType: (backdropFile as any).type || 'image/jpeg',
        upsert: true,
      });
      if (!error) {
        const { data } = supabaseAdmin.storage.from(backdropsBucket).getPublicUrl(backdropPath);
        backdrop_url = data.publicUrl;
      }
    }
    if (removeBackdrop) {
      backdrop_url = null as any;
    }

    let mobile_poster_url: any = mobilePosterUrlUploadExisting || null;
    let mobile_poster_url_external: any = mobilePosterUrlInput || mobilePosterUrlExternalExisting || null;
    const mobilePosterFile = formData.get('mobile_poster_file') as unknown as File | null;
    const removeMobilePoster = String(formData.get('mobile_poster_file_remove') || '') === '1';
    if (!removeMobilePoster && mobilePosterFile && (mobilePosterFile as any).size > 0) {
      const mobilePosterPath = `mobile/movies/${Date.now()}-${Math.random().toString(36).slice(2)}-${(mobilePosterFile as any).name || 'poster'}`;
      const mobilePosterBuffer = Buffer.from(await mobilePosterFile.arrayBuffer());
      const { error } = await supabaseAdmin.storage.from(postersBucket).upload(mobilePosterPath, mobilePosterBuffer, {
        contentType: (mobilePosterFile as any).type || 'image/jpeg',
        upsert: true,
      });
      if (!error) {
        const { data } = supabaseAdmin.storage.from(postersBucket).getPublicUrl(mobilePosterPath);
        mobile_poster_url = data.publicUrl;
      }
    }
    if (removeMobilePoster) {
      mobile_poster_url = null as any;
    }

    let mobile_backdrop_url: any = mobileBackdropUrlUploadExisting || null;
    let mobile_backdrop_url_external: any = mobileBackdropUrlInput || mobileBackdropUrlExternalExisting || null;
    const mobileBackdropFile = formData.get('mobile_backdrop_file') as unknown as File | null;
    const removeMobileBackdrop = String(formData.get('mobile_backdrop_file_remove') || '') === '1';
    if (!removeMobileBackdrop && mobileBackdropFile && (mobileBackdropFile as any).size > 0) {
      const mobileBackdropPath = `mobile/backdrops/${Date.now()}-${Math.random().toString(36).slice(2)}-${(mobileBackdropFile as any).name || 'backdrop'}`;
      const mobileBackdropBuffer = Buffer.from(await mobileBackdropFile.arrayBuffer());
      const { error } = await supabaseAdmin.storage.from(backdropsBucket).upload(mobileBackdropPath, mobileBackdropBuffer, {
        contentType: (mobileBackdropFile as any).type || 'image/jpeg',
        upsert: true,
      });
      if (!error) {
        const { data } = supabaseAdmin.storage.from(backdropsBucket).getPublicUrl(mobileBackdropPath);
        mobile_backdrop_url = data.publicUrl;
      }
    }
    if (removeMobileBackdrop) {
      mobile_backdrop_url = null as any;
    }

    const logoFile = formData.get('logo_file') as unknown as File | null;
    const removeLogo = String(formData.get('logo_file_remove') || '') === '1';
    let logo_url: string | null = logoUrlUploadExisting || null;
    let logo_url_external: string | null = (logoUrlInput || logoUrlExternalExisting) || null;
    if (section === 'hero') {
      if (!removeLogo && logoFile && (logoFile as any).size > 0) {
        const logoPath = `logos/${Date.now()}-${Math.random().toString(36).slice(2)}-${(logoFile as any).name || 'logo'}`;
        const logoBuffer = Buffer.from(await logoFile.arrayBuffer());
        const { error } = await supabaseAdmin.storage.from(postersBucket).upload(logoPath, logoBuffer, {
          contentType: (logoFile as any).type || 'image/png',
          upsert: true,
        });
        if (!error) {
          const { data } = supabaseAdmin.storage.from(postersBucket).getPublicUrl(logoPath);
          logo_url = data.publicUrl;
        }
      }
      if (removeLogo) {
        logo_url = null;
      }
    }

    const embed_code = embed_code_input || embed_link_input || '';

    const basePayload = {
      title,
      poster_url,
      poster_url_external,
      backdrop_url,
      backdrop_url_external,
      embed_code,
      section,
      rank,
      ...(section === 'hero' ? { logo_url, logo_url_external } : {}),
    };
    const episodesValue = episodes !== null ? episodes : null;
    const episodesText = episodesValue !== null ? JSON.stringify(episodesValue) : null;
    const detailsPayload = {
      year,
      cast: cast || null,
      maturity: maturity || null,
      maturity_detail: maturity_detail || null,
      genres: genres || null,
      description: description || null,
      tags,
      languages,
      is_series,
      episodes: episodesValue,
    };
    const detailsPayloadTextTags = {
      ...detailsPayload,
      tags: tagsText,
      languages: languagesText,
    };
    const withDetailsPayload = { ...basePayload, ...detailsPayload };
    const withDetailsPayloadTextTags = { ...basePayload, ...detailsPayloadTextTags };
    const withMobilePayload = { ...basePayload, mobile_poster_url, mobile_poster_url_external, mobile_backdrop_url, mobile_backdrop_url_external };
    const fullWithMobilePayload = { ...withDetailsPayload, mobile_poster_url, mobile_poster_url_external, mobile_backdrop_url, mobile_backdrop_url_external };
    const fullWithMobilePayloadTextTags = { ...withDetailsPayloadTextTags, mobile_poster_url, mobile_poster_url_external, mobile_backdrop_url, mobile_backdrop_url_external };
    const fullWithMobilePayloadEpisodesText = episodesText !== null
      ? { ...fullWithMobilePayload, episodes: episodesText }
      : fullWithMobilePayload;
    const fullWithMobilePayloadTextTagsEpisodesText = episodesText !== null
      ? { ...fullWithMobilePayloadTextTags, episodes: episodesText }
      : fullWithMobilePayloadTextTags;

    const parseMissingColumn = (message: string) => {
      const m1 = message.match(/Could not find the '([^']+)' column/i);
      if (m1?.[1]) return m1[1];
      const m2 = message.match(/column "([^"]+)" of relation/i);
      if (m2?.[1]) return m2[1];
      const m3 = message.match(/column ([a-zA-Z0-9_\.]+) does not exist/i);
      if (m3?.[1]) return m3[1].split('.').pop() || null;
      return null;
    };

    const updateWithSchemaFallback = async (payload: Record<string, any>) => {
      const working: Record<string, any> = { ...payload };
      for (let i = 0; i < 24; i += 1) {
        const res = await supabaseAdmin
          .from('movies')
          .update(working as any)
          .eq('id', idToEdit);
        if (!res.error) return { ok: true as const };
        const missing = parseMissingColumn(res.error.message || '');
        if (missing === 'episodes' && episodesValue !== null) {
          return { ok: false as const, error: { message: 'episodes_column_missing' } as any };
        }
        if (missing === 'maturity' && maturity) {
          return { ok: false as const, error: { message: 'maturity_column_missing' } as any };
        }
        if (missing === 'maturity_detail' && maturity_detail) {
          return { ok: false as const, error: { message: 'maturity_detail_column_missing' } as any };
        }
        if (missing === 'tags' && tagsRaw) {
          return { ok: false as const, error: { message: 'tags_column_missing' } as any };
        }
        if (missing === 'languages' && languagesRaw) {
          return { ok: false as const, error: { message: 'languages_column_missing' } as any };
        }
        if (missing === 'poster_url_external' && posterUrlInput) {
          return { ok: false as const, error: { message: 'poster_url_external_column_missing' } as any };
        }
        if (missing === 'backdrop_url_external' && backdropUrlInput) {
          return { ok: false as const, error: { message: 'backdrop_url_external_column_missing' } as any };
        }
        if (missing === 'mobile_poster_url_external' && mobilePosterUrlInput) {
          return { ok: false as const, error: { message: 'mobile_poster_url_external_column_missing' } as any };
        }
        if (missing === 'mobile_backdrop_url_external' && mobileBackdropUrlInput) {
          return { ok: false as const, error: { message: 'mobile_backdrop_url_external_column_missing' } as any };
        }
        if (missing === 'logo_url' && section === 'hero' && (logoUrlInput || (logoFile && (logoFile as any).size > 0) || removeLogo)) {
          return { ok: false as const, error: { message: 'logo_url_column_missing' } as any };
        }
        if (missing === 'logo_url_external' && section === 'hero' && logoUrlInput) {
          return { ok: false as const, error: { message: 'logo_url_external_column_missing' } as any };
        }
        if (missing === 'is_series' && (contentType || playerType)) {
          return { ok: false as const, error: { message: 'is_series_column_missing' } as any };
        }
        if (missing && Object.prototype.hasOwnProperty.call(working, missing)) {
          delete working[missing];
          continue;
        }
        return { ok: false as const, error: res.error };
      }
      return { ok: false as const, error: { message: 'update_failed' } as any };
    };

    const insertWithSchemaFallback = async (payload: Record<string, any>) => {
      const working: Record<string, any> = { ...payload };
      for (let i = 0; i < 24; i += 1) {
        const res = await supabaseAdmin
          .from('movies')
          .insert([working as any])
          .select('id');
        if (!res.error) {
          const insertedId = String((res.data as any)?.[0]?.id || '').trim();
          return { ok: true as const, id: insertedId };
        }
        const missing = parseMissingColumn(res.error.message || '');
        if (missing === 'episodes' && episodesValue !== null) {
          return { ok: false as const, error: { message: 'episodes_column_missing' } as any };
        }
        if (missing === 'maturity' && maturity) {
          return { ok: false as const, error: { message: 'maturity_column_missing' } as any };
        }
        if (missing === 'maturity_detail' && maturity_detail) {
          return { ok: false as const, error: { message: 'maturity_detail_column_missing' } as any };
        }
        if (missing === 'tags' && tagsRaw) {
          return { ok: false as const, error: { message: 'tags_column_missing' } as any };
        }
        if (missing === 'languages' && languagesRaw) {
          return { ok: false as const, error: { message: 'languages_column_missing' } as any };
        }
        if (missing === 'poster_url_external' && posterUrlInput) {
          return { ok: false as const, error: { message: 'poster_url_external_column_missing' } as any };
        }
        if (missing === 'backdrop_url_external' && backdropUrlInput) {
          return { ok: false as const, error: { message: 'backdrop_url_external_column_missing' } as any };
        }
        if (missing === 'mobile_poster_url_external' && mobilePosterUrlInput) {
          return { ok: false as const, error: { message: 'mobile_poster_url_external_column_missing' } as any };
        }
        if (missing === 'mobile_backdrop_url_external' && mobileBackdropUrlInput) {
          return { ok: false as const, error: { message: 'mobile_backdrop_url_external_column_missing' } as any };
        }
        if (missing === 'logo_url' && section === 'hero' && (logoUrlInput || (logoFile && (logoFile as any).size > 0) || removeLogo)) {
          return { ok: false as const, error: { message: 'logo_url_column_missing' } as any };
        }
        if (missing === 'logo_url_external' && section === 'hero' && logoUrlInput) {
          return { ok: false as const, error: { message: 'logo_url_external_column_missing' } as any };
        }
        if (missing === 'is_series' && (contentType || playerType)) {
          return { ok: false as const, error: { message: 'is_series_column_missing' } as any };
        }
        if (missing && Object.prototype.hasOwnProperty.call(working, missing)) {
          delete working[missing];
          continue;
        }
        return { ok: false as const, error: res.error };
      }
      return { ok: false as const, error: { message: 'insert_failed' } as any };
    };

    const nowIso = new Date().toISOString();
    const stampPayload = (payload: Record<string, any>) => {
      return idToEdit
        ? { ...payload, updated_at: nowIso }
        : { ...payload, created_at: nowIso, updated_at: nowIso };
    };

    const candidates = [
      stampPayload(fullWithMobilePayload as any),
      stampPayload(fullWithMobilePayloadTextTags as any),
      stampPayload(fullWithMobilePayloadEpisodesText as any),
      stampPayload(fullWithMobilePayloadTextTagsEpisodesText as any),
    ];
    let saveError: any = null;
    let insertedId: string | null = null;
    if (idToEdit) {
      for (const candidate of candidates) {
        const res = await updateWithSchemaFallback(candidate as any);
        if (res.ok) {
          saveError = null;
          break;
        }
        saveError = res.error;
      }
    } else {
      for (const candidate of candidates) {
        const res = await insertWithSchemaFallback(candidate as any);
        if (res.ok) {
          saveError = null;
          insertedId = String((res as any)?.id || '').trim() || null;
          break;
        }
        saveError = res.error;
      }
    }

      if (saveError) {
        redirect(`/admin?panel=content&sec=${encodeURIComponent(section)}&mode=list&err=${encodeURIComponent(saveError.message || 'save_failed')}`);
      }

      if (insertedId && section && section !== 'hero' && section !== 'top10' && section !== 'trash') {
        try {
          const currentRow = await supabaseAdmin
            .from('admin_settings')
            .select('value')
            .eq('key', MOVIE_SECTION_LINKS_ORDER_KEY)
            .maybeSingle();
          const existingOrder = parseLinksJson(currentRow.data?.value ? String(currentRow.data.value) : '');
          const nextOrder: Record<string, string[]> = { ...existingOrder };
          const prevOrder = Array.isArray(nextOrder[section]) ? nextOrder[section] : [];
          const cleaned = prevOrder
            .map((x) => String(x).trim())
            .filter(Boolean)
            .filter((mid) => mid !== insertedId);
          cleaned.unshift(insertedId);
          nextOrder[section] = cleaned;
          await supabaseAdmin
            .from('admin_settings')
            .upsert([{ key: MOVIE_SECTION_LINKS_ORDER_KEY, value: JSON.stringify(nextOrder) }], { onConflict: 'key' });
        } catch (e) {
          console.error('failed to update movie_section_links_order after insert', e);
        }
      }

      revalidatePath('/admin');
      revalidatePath('/');
      const nextMessage = idToEdit ? 'update_success' : 'upload_success';
      redirect(`/admin?panel=content&sec=${encodeURIComponent(section)}&mode=list&msg=${nextMessage}`);
    } catch (e: any) {
      if (typeof e?.digest === 'string' && e.digest.startsWith('NEXT_')) {
        throw e;
      }
      console.error('addMovie server action failed', e);
      redirect('/admin?err=server_action_failed');
    }
  }

  async function saveSectionLabels(formData: FormData) {
    'use server';
    const ok = await isAuthed();
    if (!ok) redirect('/admin');
    const rawKeys = String(formData.get('keys') || '').trim();
    const keys = rawKeys.split(',').map((k) => k.trim()).filter(Boolean);
    if (!keys.length) {
      redirect('/admin?panel=customization&csec=sections&err=label_invalid');
    }
    const updates = keys
      .map((key) => {
        const label = String(formData.get(`label_${key}`) || '').trim();
        if (!label) return null;
        const payload: { key: string; label: string; sort_order?: number } = { key, label };
        if (supportsSortOrder) {
          const orderValue = Number(formData.get(`order_${key}`));
          if (Number.isFinite(orderValue)) {
            payload.sort_order = orderValue;
          }
        }
        return payload;
      })
      .filter(Boolean) as Array<{ key: string; label: string; sort_order?: number }>;
    if (!updates.length) {
      redirect('/admin?panel=customization&csec=sections&err=label_invalid');
    }
    const { error } = await supabaseAdmin
      .from('section_labels')
      .upsert(updates, { onConflict: 'key' });
    if (error) {
      redirect(`/admin?panel=customization&csec=sections&err=${encodeURIComponent(error.message || 'label_update_failed')}`);
    }
    revalidatePath('/admin');
    revalidatePath('/');
    redirect('/admin?panel=customization&csec=sections&msg=sections_saved');
  }

  async function createSection(formData: FormData) {
    'use server';
    const ok = await isAuthed();
    if (!ok) redirect('/admin');
    const rawKey = String(formData.get('key') || '').trim().toLowerCase();
    const label = String(formData.get('label') || '').trim();
    const key = rawKey.replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
    if (!key || !label || key === 'hero' || key === 'top10') {
      redirect('/admin?panel=customization&csec=sections&err=section_invalid');
    }
    if (defaultSectionKeys.has(key)) {
      redirect('/admin?panel=customization&csec=sections&err=section_exists');
    }
    const { data: existing } = await supabaseAdmin
      .from('section_labels')
      .select('key')
      .eq('key', key)
      .maybeSingle();
    if (existing) {
      redirect('/admin?panel=customization&csec=sections&err=section_exists');
    }
    const insertData: { key: string; label: string; sort_order?: number } = { key, label };
    if (supportsSortOrder) {
      insertData.sort_order = maxSectionOrder + 1;
    }
    const { error } = await supabaseAdmin
      .from('section_labels')
      .insert(insertData);
    if (error) {
      redirect(`/admin?panel=customization&csec=sections&err=${encodeURIComponent(error.message || 'section_create_failed')}`);
    }
    revalidatePath('/admin');
    revalidatePath('/');
    redirect('/admin?panel=customization&csec=sections&msg=section_added');
  }

  async function deleteSection(sectionKey: string) {
    'use server';
    const ok = await isAuthed();
    if (!ok) redirect('/admin');
    const key = String(sectionKey || '').trim();
    if (!key || defaultSectionKeys.has(key) || key === 'hero' || key === 'top10') {
      redirect('/admin?panel=customization&csec=sections&err=section_delete_default');
    }
    const { error: deleteError } = await supabaseAdmin
      .from('section_labels')
      .delete()
      .eq('key', key);
    if (deleteError) {
      redirect(`/admin?panel=customization&csec=sections&err=${encodeURIComponent(deleteError.message || 'section_delete_failed')}`);
    }
    await supabaseAdmin
      .from('movies')
      .update({ section: 'trash' })
      .eq('section', key);
    revalidatePath('/admin');
    revalidatePath('/');
    redirect('/admin?panel=customization&csec=sections&msg=section_deleted');
  }

  async function saveHeaderSettings(formData: FormData) {
    'use server';
    const ok = await isAuthed();
    if (!ok) redirect('/admin');

    const currentRow = await supabaseAdmin
      .from('admin_settings')
      .select('value')
      .eq('key', SITE_HEADER_KEY)
      .maybeSingle();
    const existing = parseSettingsJson(currentRow.data?.value ? String(currentRow.data.value) : '') || {};

    const titleText = String(formData.get('header_title') || '').trim() || 'NETFLIX';
    const titleColor = String(formData.get('header_title_color') || '').trim();
    const titleSizeNum = Number(formData.get('header_title_size') || 0);
    const titleSizePx = Number.isFinite(titleSizeNum) && titleSizeNum > 0 ? titleSizeNum : null;

    const navHome = String(formData.get('nav_home') || '').trim();
    const navTv = String(formData.get('nav_tv') || '').trim();
    const navMovies = String(formData.get('nav_movies') || '').trim();
    const navNew = String(formData.get('nav_new') || '').trim();

    const telegramLabel = String(formData.get('telegram_label') || '').trim();
    const telegramUrl = String(formData.get('telegram_url') || '').trim();

    const searchIconColor = String(formData.get('search_icon_color') || '').trim();
    const searchIconSizeNum = Number(formData.get('search_icon_size') || 0);
    const searchIconSizePx = Number.isFinite(searchIconSizeNum) && searchIconSizeNum > 0 ? searchIconSizeNum : null;
    const searchIconUrlInput = String(formData.get('search_icon_url') || '').trim();
    const postersBucket = process.env.SUPABASE_POSTERS_BUCKET || 'posters';

    const removeIcon = String(formData.get('search_icon_file_remove') || '') === '1';
    const iconFile = formData.get('search_icon_file') as unknown as File | null;
    let searchIconUrl = String(existing?.searchIconUrl || existing?.search_icon_url || '').trim();
    if (searchIconUrlInput) {
      searchIconUrl = searchIconUrlInput;
    } else if (!removeIcon && iconFile && (iconFile as any).size > 0) {
      const iconPath = `site/search-icon/${Date.now()}-${Math.random().toString(36).slice(2)}-${(iconFile as any).name || 'icon'}`;
      const iconBuffer = Buffer.from(await iconFile.arrayBuffer());
      const { error } = await supabaseAdmin.storage.from(postersBucket).upload(iconPath, iconBuffer, {
        contentType: (iconFile as any).type || 'image/png',
        upsert: true,
      });
      if (!error) {
        const { data } = supabaseAdmin.storage.from(postersBucket).getPublicUrl(iconPath);
        searchIconUrl = data.publicUrl;
      }
    } else if (removeIcon) {
      searchIconUrl = '';
    }

    const payload = {
      titleText,
      titleColor,
      titleSizePx,
      telegramLabel,
      telegramUrl,
      nav: {
        home: navHome,
        tv: navTv,
        movies: navMovies,
        new: navNew,
      },
      searchIconColor,
      searchIconSizePx,
      searchIconUrl,
    };

    const { error } = await supabaseAdmin
      .from('admin_settings')
      .upsert({ key: SITE_HEADER_KEY, value: JSON.stringify(payload) }, { onConflict: 'key' });
    if (error) {
      redirect(`/admin?panel=customization&csec=header&err=${encodeURIComponent(error.message || 'header_save_failed')}`);
    }
    revalidatePath('/admin');
    revalidatePath('/');
    redirect('/admin?panel=customization&csec=header&msg=header_saved');
  }

  async function saveFooterSettings(formData: FormData) {
    'use server';
    const ok = await isAuthed();
    if (!ok) redirect('/admin');

    const questionsText = String(formData.get('footer_questions') || '').trim();
    const createdText = String(formData.get('footer_created') || '').trim();
    const brandText = String(formData.get('footer_brand') || '').trim();

    const payload = {
      questionsText,
      createdText,
      brandText,
    };

    const { error } = await supabaseAdmin
      .from('admin_settings')
      .upsert({ key: SITE_FOOTER_KEY, value: JSON.stringify(payload) }, { onConflict: 'key' });
    if (error) {
      redirect(`/admin?panel=customization&csec=footer&err=${encodeURIComponent(error.message || 'footer_save_failed')}`);
    }
    revalidatePath('/admin');
    revalidatePath('/');
    redirect('/admin?panel=customization&csec=footer&msg=footer_saved');
  }

  async function saveDevToolSettings(formData: FormData) {
    'use server';
    const ok = await isAuthed();
    if (!ok) redirect('/admin');

    const enabledRaw = formData.get('devtool_enabled');
    const enabled = enabledRaw === 'on' || enabledRaw === '1' || enabledRaw === 'true';

    const payload = {
      enabled: !!enabled,
    };

    const { error } = await supabaseAdmin
      .from('admin_settings')
      .upsert({ key: SITE_DEVTOOL_KEY, value: JSON.stringify(payload) }, { onConflict: 'key' });
    if (error) {
      redirect(`/admin?panel=devtool&err=${encodeURIComponent(error.message || 'devtool_save_failed')}`);
    }
    revalidatePath('/admin');
    revalidatePath('/');
    redirect('/admin?panel=devtool&msg=devtool_saved');
  }

  async function deleteSelectedSections(formData: FormData) {
    'use server';
    const ok = await isAuthed();
    if (!ok) redirect('/admin');
    const rawKeys = formData.getAll('delete_keys').map((value) => String(value).trim()).filter(Boolean);
    const keys = rawKeys.filter((key) => !defaultSectionKeys.has(key) && key !== 'hero' && key !== 'top10');
    if (!keys.length) {
      redirect('/admin?panel=customization&csec=sections&err=section_delete_default');
    }
    const { error: deleteError } = await supabaseAdmin
      .from('section_labels')
      .delete()
      .in('key', keys);
    if (deleteError) {
      redirect(`/admin?panel=customization&csec=sections&err=${encodeURIComponent(deleteError.message || 'section_delete_failed')}`);
    }
    await supabaseAdmin
      .from('movies')
      .update({ section: 'trash' })
      .in('section', keys);
    revalidatePath('/admin');
    revalidatePath('/');
    redirect('/admin?panel=customization&csec=sections&msg=section_deleted');
  }

  async function updatePassword(formData: FormData) {
    'use server';
    const ok = await isAuthed();
    if (!ok) redirect('/admin');
    const current = String(formData.get('current_password') || '');
    const next = String(formData.get('new_password') || '');
    const confirm = String(formData.get('confirm_password') || '');
    if (!current || !next || !confirm) {
      redirect('/admin?panel=security&err=password_missing');
    }
    if (next !== confirm) {
      redirect('/admin?panel=security&err=password_mismatch');
    }
    const expected = (await getAdminPassword()) || process.env.ADMIN_PASSWORD || '';
    if (!expected || current !== expected) {
      redirect('/admin?panel=security&err=password_incorrect');
    }
    const { error } = await supabaseAdmin
      .from('admin_settings')
      .upsert({ key: 'admin_password', value: next }, { onConflict: 'key' });
    if (error) {
      redirect('/admin?panel=security&err=password_update_failed');
    }
    revalidatePath('/admin');
    redirect('/admin?panel=security&msg=password_changed');
  }

  async function trashMovie(formData: FormData) {
    'use server';
    const ok = await isAuthed();
    if (!ok) {
      redirect('/admin');
    }
    const id = String(formData.get('id') || '');
    const orig = String(formData.get('orig_section') || '');
    let errorMessage = '';
    if (id && orig) {
      const { error, data } = await supabaseAdmin
        .from('movies')
        .update({ section: `trash_${orig}` })
        .eq('id', id)
        .select('id');
      if (error || !data || data.length === 0) {
        // Try generic 'trash' bucket if enum blocks dynamic value. If that also fails,
        // do NOT hard delete; keep the item and simply show list again.
        const { error: fallbackError, data: fallbackData } = await supabaseAdmin
          .from('movies')
          .update({ section: 'trash' })
          .eq('id', id)
          .select('id');
        if (fallbackError || !fallbackData || fallbackData.length === 0) {
          errorMessage = fallbackError?.message || error?.message || 'Unable to move item to Trash.';
        }
      }
    }
    revalidatePath('/admin');
    revalidatePath('/');
    const nextUrl = `/admin?panel=content&sec=${initialSection}&mode=list${(initialQuery || '').trim() ? `&q=${encodeURIComponent((initialQuery || '').trim())}` : ''}${errorMessage ? `&err=${encodeURIComponent(errorMessage)}` : ''}`;
    redirect(nextUrl);
  }

  async function restoreMovie(formData: FormData) {
    'use server';
    const ok = await isAuthed();
    if (!ok) redirect('/admin');
    const id = String(formData.get('id') || '');
    const target = String(formData.get('orig_section') || '');
    let errorMessage = '';
    if (id && target) {
      const { error } = await supabaseAdmin.from('movies').update({ section: target }).eq('id', id);
      if (error) {
        errorMessage = error.message || 'Unable to restore item.';
      }
    }
    revalidatePath('/admin');
    revalidatePath('/');
    const nextUrl = `/admin?panel=content&sec=${initialSection}&mode=list&trash=1${(initialQuery || '').trim() ? `&q=${encodeURIComponent((initialQuery || '').trim())}` : ''}${errorMessage ? `&err=${encodeURIComponent(errorMessage)}` : ''}`;
    redirect(nextUrl);
  }

  async function purgeMovie(formData: FormData) {
    'use server';
    const ok = await isAuthed();
    if (!ok) redirect('/admin');
    const id = String(formData.get('id') || '');
    let errorMessage = '';
    if (id) {
      const { error } = await supabaseAdmin.from('movies').delete().eq('id', id);
      if (error) {
        errorMessage = error.message || 'Unable to delete item.';
      }
    }
    revalidatePath('/admin');
    revalidatePath('/');
    const nextUrl = `/admin?panel=content&sec=${initialSection}&mode=list&trash=1${(initialQuery || '').trim() ? `&q=${encodeURIComponent((initialQuery || '').trim())}` : ''}${errorMessage ? `&err=${encodeURIComponent(errorMessage)}` : ''}`;
    redirect(nextUrl);
  }

  const panel = initialPanel === 'customization'
    ? 'customization'
    : initialPanel === 'devtool'
      ? 'devtool'
      : initialPanel === 'security'
        ? 'security'
        : initialPanel === 'stats'
          ? 'stats'
          : initialPanel === 'analysis'
            ? 'analysis'
          : 'content';
  const contentActive = sections.find((s) => s.key === initialSection) || sections[0];
  const customTab = (initialCustomSection || 'sections').trim();
  const mode = panel === 'content' && initialMode === 'upload' ? 'upload' : 'list';
  const q = (initialQuery || '').trim();
  const trashMode = panel === 'content' && initialTrash === '1';
  const messageKey = (initialMessage || '').trim();
  const errorKey = (initialError || '').trim();
  const messages: Record<string, string> = {
    label_saved: 'Section name updated successfully.',
    password_changed: 'Admin password updated successfully.',
    upload_success: 'Upload successful.',
    update_success: 'Update successful.',
    sections_saved: 'Section names updated successfully.',
    section_added: 'Section added successfully.',
    section_deleted: 'Section deleted successfully.',
    header_saved: 'Header updated successfully.',
    footer_saved: 'Footer updated successfully.',
    devtool_saved: 'Dev Tool updated successfully.',
  };
  const errors: Record<string, string> = {
    label_invalid: 'Please enter a valid section name.',
    label_update_failed: 'Section name update failed.',
    password_missing: 'Please fill all password fields.',
    password_mismatch: 'New password and confirm password do not match.',
    password_incorrect: 'Current password is incorrect.',
    password_update_failed: 'Failed to update password. Try again.',
    section_invalid: 'Please enter a valid section key and label.',
    section_exists: 'This section key already exists.',
    section_create_failed: 'Failed to create section. Try again.',
    section_delete_default: 'Default sections cannot be deleted.',
    section_delete_failed: 'Failed to delete section. Try again.',
    maturity_column_missing: 'Database column missing: movies.maturity. Add it in Supabase (type: text).',
    maturity_detail_column_missing: 'Database column missing: movies.maturity_detail. Add it in Supabase (type: text).',
    tags_column_missing: 'Database column missing: movies.tags. Add it in Supabase (type: jsonb or text).',
    languages_column_missing: 'Database column missing: movies.languages. Add it in Supabase (type: jsonb or text).',
    logo_url_column_missing: 'Database column missing: movies.logo_url. Add it in Supabase (type: text).',
    logo_url_external_column_missing: 'Database column missing: movies.logo_url_external. Add it in Supabase (type: text).',
    poster_url_external_column_missing: 'Database column missing: movies.poster_url_external. Add it in Supabase (type: text).',
    backdrop_url_external_column_missing: 'Database column missing: movies.backdrop_url_external. Add it in Supabase (type: text).',
    mobile_poster_url_external_column_missing: 'Database column missing: movies.mobile_poster_url_external. Add it in Supabase (type: text).',
    mobile_backdrop_url_external_column_missing: 'Database column missing: movies.mobile_backdrop_url_external. Add it in Supabase (type: text).',
    is_series_column_missing: 'Database column missing: movies.is_series. Add it in Supabase (type: boolean).',
    server_action_failed: 'Server error while saving. Please check your terminal/console logs for details.',
  };
  const messageText = messageKey ? (messages[messageKey] || messageKey) : '';
  const errorText = errorKey ? (errors[errorKey] || errorKey) : '';
  const serviceRoleMissing = !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL;
  let trashCount = 0;
  if (panel === 'content') {
    const { count } = await supabaseAdmin
      .from('movies')
      .select('id', { count: 'exact', head: true })
      .in('section', [`trash_${contentActive.key}`, 'trash']);
    trashCount = count || 0;
  }
  let stats: { total: number; counts: Record<string, number> } | null = null;
  if (panel === 'stats') {
    const { data: statRows } = await supabaseAdmin
      .from('movies')
      .select('section');
    const counts: Record<string, number> = {};
    sections.forEach((s) => {
      counts[s.key] = 0;
    });
    (statRows as any[] | null | undefined)?.forEach((row) => {
      const key = String(row?.section || '');
      if (counts[key] !== undefined) {
        counts[key] += 1;
      }
    });
    stats = { total: statRows?.length || 0, counts };
  }

  let analytics: {
    rangeKey: string;
    rangeLabel: string;
    uniqueVisitors: number;
    pageViews: number;
    searches: number;
    contentViews: number;
    topQueries: Array<{ query: string; count: number }>;
    topContent: Array<{ title: string; count: number }>;
    topPages: Array<{ path: string; count: number }>;
    topCountries: Array<{ country: string; count: number }>;
    topDevices: Array<{ device: string; count: number }>;
    byDay: Array<{ day: string; count: number }>;
    totalEventsLoaded: number;
    supportsGeoDevice: boolean;
  } | null = null;
  let analyticsError: string | null = null;
  if (panel === 'analysis') {
    const analysisTab = String(initialAnalysisTab || '').trim() || 'queries';
    const analysisFromRaw = String(initialAnalysisFrom || '').trim();
    const analysisToRaw = String(initialAnalysisTo || '').trim();
    const analysisRange = analysisFromRaw ? 'custom' : (String(initialAnalysisRange || '').trim() || '7d');
    const now = Date.now();
    const rangeMs = analysisRange === '24h'
      ? 24 * 60 * 60 * 1000
      : analysisRange === '28d'
        ? 28 * 24 * 60 * 60 * 1000
        : analysisRange === '3m'
          ? 90 * 24 * 60 * 60 * 1000
          : analysisRange === '6m'
            ? 180 * 24 * 60 * 60 * 1000
          : 7 * 24 * 60 * 60 * 1000;
    let since = new Date(now - rangeMs).toISOString();
    let until = new Date(now).toISOString();
    const fromDate = analysisFromRaw ? new Date(`${analysisFromRaw}T00:00:00.000Z`) : null;
    const toDate = analysisToRaw ? new Date(`${analysisToRaw}T23:59:59.999Z`) : null;
    if (analysisRange === 'custom' && fromDate && Number.isFinite(fromDate.getTime())) {
      since = fromDate.toISOString();
      if (toDate && Number.isFinite(toDate.getTime())) {
        until = toDate.toISOString();
      }
    }
    const rangeLabel = analysisRange === 'custom'
      ? `Custom (${analysisFromRaw || ''}${analysisToRaw ? ` to ${analysisToRaw}` : ''})`
      : analysisRange === '24h'
        ? 'Last 24 hours'
        : analysisRange === '28d'
          ? 'Last 28 days'
          : analysisRange === '3m'
            ? 'Last 3 months'
            : analysisRange === '6m'
              ? 'Last 6 months'
              : 'Last 7 days';

    let rows: any[] = [];
    let supportsGeoDevice = true;
    let res = supabaseAdmin
      .from('analytics_events')
      .select('created_at,event_type,visitor_id,query,content_title,path,country,device_type')
      .gte('created_at', since);
    if (analysisRange === 'custom') {
      res = res.lte('created_at', until);
    }
    const resFinal = await res.order('created_at', { ascending: false }).limit(20000);
    if (!resFinal.error) {
      rows = (resFinal.data as any[]) || [];
    } else {
      let fallback = supabaseAdmin
        .from('analytics_events')
        .select('created_at,event_type,visitor_id,query,content_title,path')
        .gte('created_at', since);
      if (analysisRange === 'custom') {
        fallback = fallback.lte('created_at', until);
      }
      const fallbackFinal = await fallback.order('created_at', { ascending: false }).limit(20000);
      if (fallbackFinal.error) {
        analyticsError = fallbackFinal.error.message || resFinal.error.message || 'analytics_load_failed';
      } else {
        supportsGeoDevice = false;
        rows = (fallbackFinal.data as any[]) || [];
      }
    }

    if (!analyticsError) {
      const events = rows;
      const visitors = new Set<string>();
      let pageViews = 0;
      let searches = 0;
      let contentViews = 0;

      const queryCounts = new Map<string, number>();
      const contentCounts = new Map<string, number>();
      const pageCounts = new Map<string, number>();
      const countryCounts = new Map<string, number>();
      const deviceCounts = new Map<string, number>();
      const dayCounts = new Map<string, number>();

      events.forEach((ev) => {
        const visitorId = String(ev?.visitor_id || '').trim();
        if (visitorId) visitors.add(visitorId);

        const createdAt = String(ev?.created_at || '');
        const ts = Date.parse(createdAt);
        const day = Number.isFinite(ts) ? new Date(ts).toISOString().slice(0, 10) : '';

        const type = String(ev?.event_type || '').trim();
        if (type === 'page_view') {
          pageViews += 1;
          const pv = String(ev?.path || '').trim();
          if (pv) pageCounts.set(pv, (pageCounts.get(pv) || 0) + 1);
          const cv = String((ev as any)?.country || '').trim().toUpperCase() || 'UNKNOWN';
          countryCounts.set(cv, (countryCounts.get(cv) || 0) + 1);
          const dv = String((ev as any)?.device_type || '').trim().toLowerCase() || 'unknown';
          deviceCounts.set(dv, (deviceCounts.get(dv) || 0) + 1);
          if (day) dayCounts.set(day, (dayCounts.get(day) || 0) + 1);
        }
        if (type === 'search') {
          searches += 1;
          const qv = String(ev?.query || '').trim();
          if (qv) queryCounts.set(qv, (queryCounts.get(qv) || 0) + 1);
        }
        if (type === 'content_view') {
          contentViews += 1;
          const title = String(ev?.content_title || '').trim();
          if (title) contentCounts.set(title, (contentCounts.get(title) || 0) + 1);
        }
      });

      const topQueries = Array.from(queryCounts.entries())
        .map(([query, count]) => ({ query, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 50);
      const topContent = Array.from(contentCounts.entries())
        .map(([title, count]) => ({ title, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 50);
      const topPages = Array.from(pageCounts.entries())
        .map(([path, count]) => ({ path, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 50);
      const topCountries = Array.from(countryCounts.entries())
        .map(([country, count]) => ({ country, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 50);
      const topDevices = Array.from(deviceCounts.entries())
        .map(([device, count]) => ({ device, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 50);
      const byDay = Array.from(dayCounts.entries())
        .map(([day, count]) => ({ day, count }))
        .sort((a, b) => (a.day > b.day ? 1 : -1))
        .slice(-60);

      analytics = {
        rangeKey: analysisRange,
        rangeLabel,
        uniqueVisitors: visitors.size,
        pageViews,
        searches,
        contentViews,
        topQueries,
        topContent,
        topPages,
        topCountries,
        topDevices,
        byDay,
        totalEventsLoaded: events.length,
        supportsGeoDevice,
      };

      void analysisTab;
    }
  }
  let items: Array<{ id: string; title: string; poster_url: string | null; poster_url_external?: string | null; rank: number | null; created_at?: string; tags?: any }> = [];
  if (panel === 'content' && mode === 'list') {
    let qBuilder = supabaseAdmin
      .from('movies')
      .select('id,title,poster_url,poster_url_external,rank,created_at,tags');
    if (trashMode) {
      qBuilder = qBuilder.in('section', [`trash_${contentActive.key}`, 'trash']);
    } else {
      qBuilder = qBuilder.eq('section', contentActive.key);
    }
    if (q) {
      qBuilder = qBuilder.ilike('title', `%${q}%`);
    }
    if (!trashMode && contentActive.key === 'top10') {
      qBuilder = qBuilder
        .order('rank', { ascending: true })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });
    } else {
      qBuilder = qBuilder
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });
    }
    const { data } = await qBuilder;
    items = (data as any) || [];
  }
  const editId = initialId || '';
  let editing: { id: string; title: string; poster_url: string | null; poster_url_external?: string | null; backdrop_url: string | null; backdrop_url_external?: string | null; mobile_poster_url?: string | null; mobile_poster_url_external?: string | null; mobile_backdrop_url?: string | null; mobile_backdrop_url_external?: string | null; logo_url?: string | null; logo_url_external?: string | null; embed_code: string | null; rank: number | null; year?: number | null; cast?: string | null; maturity?: string | null; maturity_detail?: string | null; genres?: string | null; description?: string | null; tags?: string[] | null; languages?: string[] | string | null; is_series?: boolean | null; episodes?: any } | null = null;
  if (panel === 'content' && mode === 'upload' && editId) {
    const tryAll = await supabaseAdmin
      .from('movies')
      .select('*')
      .eq('id', editId)
      .maybeSingle();
    if (!tryAll.error) {
      editing = (tryAll.data as any) || null;
    } else {
      const fallback = await supabaseAdmin
        .from('movies')
        .select('id,title,poster_url,backdrop_url,embed_code,rank')
        .eq('id', editId)
        .maybeSingle();
      editing = (fallback.data as any) || null;
    }
  }

  let editingEpisodesParsed: any[] = [];
  if (editing) {
    const raw = (editing as any).episodes as any;
    if (Array.isArray(raw)) {
      editingEpisodesParsed = raw;
    } else if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          editingEpisodesParsed = parsed;
        } else if (typeof parsed === 'string') {
          const parsed2 = JSON.parse(parsed);
          if (Array.isArray(parsed2)) {
            editingEpisodesParsed = parsed2;
          }
        }
      } catch {
        editingEpisodesParsed = [];
      }
    }
  }

return (
  <div className="min-h-screen lg:flex">
    <input id="admin-nav" type="checkbox" className="peer sr-only" />
    <div className="flex items-center justify-between gap-3 border-b border-zinc-800 bg-[#0b0b0b] px-4 py-3 lg:hidden">
      <span className="text-base font-extrabold tracking-wide text-emerald-500">ADMIN DASHBOARD</span>
      <label
        htmlFor="admin-nav"
        className="cursor-pointer rounded bg-zinc-800 px-3 py-1.5 text-sm font-semibold hover:bg-zinc-700"
      >
        Menu
      </label>
    </div>
    <aside className="hidden w-full shrink-0 border-b border-zinc-800 bg-[#0b0b0b] peer-checked:block lg:block lg:w-72 lg:border-b-0 lg:border-r 2xl:w-80">
      <div className="hidden px-5 py-4 text-lg font-extrabold tracking-wide text-emerald-500 lg:block">ADMIN DASHBOARD</div>
      <nav className="px-2 pb-4 text-sm 2xl:text-base">
        <details open={panel === 'content'} className="rounded-md border-t border-emerald-600/60 pt-3">
          <summary className="cursor-pointer select-none rounded px-3 py-2 text-xs uppercase tracking-wider text-zinc-400 hover:bg-zinc-800/70">
            Upload
          </summary>
          <div className="mt-3 space-y-3">
            <details open={panel === 'content'} className="rounded-md">
              <summary className="cursor-pointer select-none rounded px-3 py-2 text-xs uppercase tracking-wider text-zinc-400 hover:bg-zinc-800/70">
                Content Management
              </summary>
              <div className="mt-2 flex flex-col gap-1 pl-2">
                {sections.map((it) => (
                  <Link
                    key={it.key}
                    href={`/admin?panel=content&sec=${it.key}`}
                    className={`rounded px-3 py-2 text-sm ${
                      panel === 'content' && contentActive.key === it.key ? 'text-sky-400 font-semibold' : 'text-zinc-300 hover:bg-zinc-800'
                    }`}
                  >
                    {it.label}
                  </Link>
                ))}
              </div>
            </details>
          </div>
        </details>

        <details open={panel === 'customization'} className="mt-4 rounded-md border-t border-emerald-600/60 pt-3">
          <summary className="cursor-pointer select-none rounded px-3 py-2 text-xs uppercase tracking-wider text-zinc-400 hover:bg-zinc-800/70">
            Customization
          </summary>
          <div className="mt-2 flex flex-col gap-1">
            <Link
              href="/admin?panel=customization&csec=header"
              className={`rounded px-3 py-2 ${panel === 'customization' && customTab === 'header' ? 'text-sky-400 font-semibold' : 'text-zinc-300 hover:bg-zinc-800'}`}
            >
              Header
            </Link>
            <Link
              href="/admin?panel=customization&csec=footer"
              className={`rounded px-3 py-2 ${panel === 'customization' && customTab === 'footer' ? 'text-sky-400 font-semibold' : 'text-zinc-300 hover:bg-zinc-800'}`}
            >
              Footer
            </Link>
            <Link
              href="/admin?panel=customization&csec=sections"
              className={`rounded px-3 py-2 ${panel === 'customization' && customTab === 'sections' ? 'text-sky-400 font-semibold' : 'text-zinc-300 hover:bg-zinc-800'}`}
            >
              Section Name
            </Link>
          </div>
        </details>

        <details open={panel === 'security'} className="mt-4 rounded-md border-t border-emerald-600/60 pt-3">
          <summary className="cursor-pointer select-none rounded px-3 py-2 text-xs uppercase tracking-wider text-zinc-400 hover:bg-zinc-800/70">
            Settings
          </summary>
          <div className="mt-2 flex flex-col gap-1">
            <Link
              href="/admin?panel=security"
              className={`rounded px-3 py-2 ${panel === 'security' ? 'text-sky-400 font-semibold' : 'text-zinc-300 hover:bg-zinc-800'}`}
            >
              Security
            </Link>
          </div>
        </details>

        <div className="mt-4 border-t border-emerald-600/60 pt-3">
          <Link
            href="/admin?panel=analysis&arange=7d&atab=queries"
            className={`mb-2 block rounded px-3 py-2 ${panel === 'analysis' ? 'text-sky-400 font-semibold' : 'text-zinc-300 hover:bg-zinc-800'}`}
          >
            Analysis
          </Link>
          <Link
            href="/admin?panel=stats"
            className={`block rounded px-3 py-2 ${panel === 'stats' ? 'text-sky-400 font-semibold' : 'text-zinc-300 hover:bg-zinc-800'}`}
          >
            Database Statistics
          </Link>
          <Link
            href="/admin?panel=devtool"
            className={`mt-2 block rounded px-3 py-2 ${panel === 'devtool' ? 'text-sky-400 font-semibold' : 'text-zinc-300 hover:bg-zinc-800'}`}
          >
            Dev Tool
          </Link>
        </div>
      </nav>
    </aside>
    <main className="min-w-0 flex-1 overflow-y-auto p-4 pt-6 lg:p-6 lg:pt-20">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl 2xl:text-3xl">
            {panel === 'content'
              ? contentActive.label
              : panel === 'analysis'
                ? 'Analysis'
              : panel === 'devtool'
                ? 'Dev Tool'
                : panel === 'customization'
                  ? (customTab === 'header' ? 'Header' : customTab === 'footer' ? 'Footer' : 'Section Name')
                  : panel === 'security'
                    ? 'Security'
                    : 'Database Statistics'}
          </h1>
        </div>
        {panel === 'content' ? (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <form method="GET" action="/admin" className="relative w-full sm:w-auto">
              <input type="hidden" name="panel" value="content" />
              <input type="hidden" name="sec" value={contentActive.key} />
              <input type="hidden" name="mode" value="list" />
              {trashMode ? <input type="hidden" name="trash" value="1" /> : null}
              <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400">
                <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                name="q"
                defaultValue={q}
                placeholder={`Search in ${contentActive.label}`}
                className="w-full rounded bg-zinc-900 pl-8 pr-3 py-1.5 text-sm outline-none ring-1 ring-zinc-800 focus:ring-zinc-700 sm:w-56"
              />
            </form>
            <a
              href={`/admin?panel=content&sec=${contentActive.key}&mode=list${q ? `&q=${encodeURIComponent(q)}` : ''}&trash=${trashMode ? '0' : '1'}`}
              className="rounded bg-zinc-800 px-3 py-1.5 text-sm hover:bg-zinc-700"
            >
              {trashMode
                ? `Back from Trash${trashCount ? ` (${trashCount})` : ''}`
                : `Trash${trashCount ? ` (${trashCount})` : ''}`}
            </a>
            <a
              href={`/admin?panel=content&sec=${contentActive.key}&mode=${mode === 'list' ? 'upload' : 'list'}${trashMode ? '&trash=1' : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-semibold hover:bg-emerald-500"
            >
              {mode === 'list' ? 'Upload New' : 'Back to List'}
            </a>
          </div>
        ) : null}
      </div>

      {serviceRoleMissing ? (
        <div className="mb-4 rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Supabase service role key missing. Admin actions (delete, restore, rename, password change) may fail.
        </div>
      ) : null}
      {messageText ? (
        <div className="mb-4 inline-flex w-fit items-center gap-2 rounded border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          <span>{messageText}</span>
        </div>
      ) : null}
      {errorText ? (
        <div className="mb-4 rounded border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {errorText}
        </div>
      ) : null}

      {panel === 'content' ? (
        mode === 'list' ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {items.map((it) => {
              const rawTags = (it as any)?.tags;
              let primaryTag = '';
              if (Array.isArray(rawTags) && rawTags.length) {
                primaryTag = String(rawTags[0] || '').trim();
              } else if (typeof rawTags === 'string') {
                const txt = rawTags.trim();
                if (txt.startsWith('[')) {
                  try {
                    const parsed = JSON.parse(txt);
                    if (Array.isArray(parsed) && parsed.length) primaryTag = String(parsed[0] || '').trim();
                  } catch {
                    primaryTag = '';
                  }
                } else {
                  primaryTag = txt;
                }
              }
              const linked = Array.isArray((movieSectionLinks as any)?.[it.id]) ? ((movieSectionLinks as any)[it.id] as string[]) : [];
              const linkedNormalized = linked.map((s) => String(s).trim()).filter(Boolean);
              const linkedLabels = linkedNormalized
                .map((key) => sections.find((s) => s.key === key)?.label || key)
                .filter(Boolean);
              const isMarked = Boolean(primaryTag) || linkedLabels.length > 0;

              const tagOptions = [
                { value: '__remove__', label: 'Remove' },
                ...(primaryTag && !TAG_OPTIONS.includes(primaryTag) ? [{ value: primaryTag, label: primaryTag }] : []),
                ...TAG_OPTIONS.map((t) => ({ value: t, label: t })),
              ];

              let linkInitialValue = linkedNormalized.length === 1 ? linkedNormalized[0] : linkedNormalized.length > 1 ? '__multi__' : '';
              if (linkInitialValue === 'top10') {
                const r = Number((it as any)?.rank);
                if (Number.isFinite(r) && r >= 1 && r <= 10) {
                  linkInitialValue = `top10__${r}`;
                }
              }
              const linkOptions = [
                { value: '__remove__', label: 'Remove' },
                ...(linkedNormalized.length > 1 ? [{ value: '__multi__', label: `Linked (${linkedNormalized.length})`, disabled: true }] : []),
                ...sections
                  .filter((s) => s.key !== 'hero')
                  .flatMap((s) => {
                    if (s.key !== 'top10') return [{ value: s.key, label: s.label }];
                    const topLabel = s.label || 'Top 10';
                    const header = { value: 'top10', label: `${topLabel} (Pick 1-10)`, disabled: true };
                    const ranks = Array.from({ length: 10 }).map((_, i) => ({
                      value: `top10__${i + 1}`,
                      label: `${topLabel} #${i + 1}`,
                    }));
                    return [header, ...ranks];
                  }),
              ];
              return (
              <div
                key={it.id}
                className={`rounded-lg border p-3 flex h-full flex-col ${isMarked ? 'border-emerald-700 bg-zinc-900' : 'border-zinc-800 bg-zinc-900'}`}
              >
                <div className="relative mb-2 aspect-video w-full overflow-hidden rounded">
                  {(it.poster_url || it.poster_url_external) ? (
                    <img src={it.poster_url || (it.poster_url_external as string)} alt={it.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-zinc-800" />
                  )}
                </div>
                <div className="truncate text-sm font-medium">{it.title}</div>
                {contentActive.key === 'top10' && it.rank ? (
                  <div className="mt-1 text-xs text-zinc-400">Rank #{it.rank}</div>
                ) : null}
                <div className="mt-auto pt-2 flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2">
                    {trashMode ? (
                      <>
                        <form action={restoreMovie}>
                          <input type="hidden" name="id" value={it.id} />
                          <input type="hidden" name="orig_section" value={contentActive.key} />
                          <button className="rounded bg-emerald-600 px-2 py-1 text-xs hover:bg-emerald-500">Restore</button>
                        </form>
                        <form action={purgeMovie}>
                          <FormStatusOverlay pendingText="Deleting..." />
                          <input type="hidden" name="id" value={it.id} />
                          <ConfirmButton className="rounded bg-red-700 px-2 py-1 text-xs hover:bg-red-600" message="This will permanently delete the item. Continue?">Delete Permanently</ConfirmButton>
                        </form>
                      </>
                    ) : (
                      <>
                        <a href={`/admin?panel=content&sec=${contentActive.key}&mode=upload&id=${it.id}`} className="rounded bg-zinc-800 px-2 py-1 text-xs hover:bg-zinc-700">Edit</a>
                        <form action={trashMovie}>
                          <FormStatusOverlay pendingText="Deleting..." />
                          <input type="hidden" name="id" value={it.id} />
                          <input type="hidden" name="orig_section" value={contentActive.key} />
                          <ConfirmButton className="rounded bg-red-700 px-2 py-1 text-xs hover:bg-red-600" message="Are you sure you want to delete this item? It will move to Trash.">Delete</ConfirmButton>
                        </form>
                      </>
                    )}
                  </div>
                  {!trashMode ? (
                    <div className="ml-auto flex flex-wrap items-center gap-2">
                      <InlineActionSelect
                        action={setMovieTag}
                        name="tag"
                        placeholder="Tag"
                        initialValue={primaryTag}
                        hidden={{
                          id: String(it.id),
                          return_to: buildReturnTo({ sec: contentActive.key, q, trashMode }),
                        }}
                        className="w-[92px] shrink-0"
                        options={tagOptions}
                      />
                      <InlineActionSelect
                        action={linkMovieToSection}
                        name="link_section"
                        placeholder="Link To"
                        initialValue={linkInitialValue}
                        hidden={{
                          id: String(it.id),
                          return_to: buildReturnTo({ sec: contentActive.key, q, trashMode }),
                        }}
                        className="w-[92px] shrink-0"
                        options={linkOptions}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
              );
            })}
          </div>
        ) : (
          <form action={addMovie} className="relative grid gap-3 md:grid-cols-2">
            <FormStatusOverlay pendingText={editing ? 'Updating...' : 'Uploading...'} />
            {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
            <input
              name="title"
              defaultValue={editing?.title || ''}
              placeholder="Title"
              className="rounded bg-zinc-900 p-3 outline-none ring-1 ring-zinc-800 md:col-span-2"
            />
            {contentActive.key === 'hero' ? (
              <>
                <ImageFileInput name="logo_file" label="Logo Upload" initialUrl={editing?.logo_url || null} className="md:col-span-1" />
                <input type="hidden" name="logo_url_existing" value={editing?.logo_url || ''} />
                <input type="hidden" name="logo_url_external_existing" value={editing?.logo_url_external || ''} />
                <input
                  name="logo_url"
                  defaultValue={editing?.logo_url_external || ''}
                  placeholder="Logo URL"
                  className="rounded bg-zinc-900 p-3 outline-none ring-1 ring-zinc-800 md:col-span-1"
                />
                <textarea
                  name="description"
                  defaultValue={editing?.description || ''}
                  placeholder="Hero Description"
                  className="min-h-28 rounded bg-zinc-900 p-3 outline-none ring-1 ring-zinc-800 md:col-span-2"
                />
              </>
            ) : null}
            <div className="md:col-span-2 text-center text-sm font-semibold text-emerald-400">PC Setting</div>
            <ImageFileInput name="poster_file" label="Poster Upload" initialUrl={editing?.poster_url || null} className="md:col-span-1" />
            <input type="hidden" name="poster_url_existing" value={editing?.poster_url || ''} />
            <input type="hidden" name="poster_url_external_existing" value={editing?.poster_url_external || ''} />
            <input
              name="poster_url"
              defaultValue={editing?.poster_url_external || ''}
              placeholder="Poster URL"
              className="rounded bg-zinc-900 p-3 outline-none ring-1 ring-zinc-800 md:col-span-1"
            />
            <ImageFileInput name="backdrop_file" label="Backdrop Upload" initialUrl={editing?.backdrop_url || null} className="md:col-span-1" />
            <input type="hidden" name="backdrop_url_existing" value={editing?.backdrop_url || ''} />
            <input type="hidden" name="backdrop_url_external_existing" value={editing?.backdrop_url_external || ''} />
            <input
              name="backdrop_url"
              defaultValue={editing?.backdrop_url_external || ''}
              placeholder="Backdrop URL"
              className="rounded bg-zinc-900 p-3 outline-none ring-1 ring-zinc-800 md:col-span-1"
            />
            <div className="md:col-span-2 h-[2px] bg-emerald-600/60" />
            <div className="md:col-span-2 text-center text-sm font-semibold text-emerald-400">Mobile/App Settings</div>
            <ImageFileInput name="mobile_poster_file" label="Poster Upload" initialUrl={editing?.mobile_poster_url || null} className="md:col-span-1" />
            <input type="hidden" name="mobile_poster_url_existing" value={editing?.mobile_poster_url || ''} />
            <input type="hidden" name="mobile_poster_url_external_existing" value={editing?.mobile_poster_url_external || ''} />
            <input
              name="mobile_poster_url"
              defaultValue={editing?.mobile_poster_url_external || ''}
              placeholder="Poster URL"
              className="rounded bg-zinc-900 p-3 outline-none ring-1 ring-zinc-800 md:col-span-1"
            />
            <ImageFileInput name="mobile_backdrop_file" label="Backdrop Upload" initialUrl={editing?.mobile_backdrop_url || null} className="md:col-span-1" />
            <input type="hidden" name="mobile_backdrop_url_existing" value={editing?.mobile_backdrop_url || ''} />
            <input type="hidden" name="mobile_backdrop_url_external_existing" value={editing?.mobile_backdrop_url_external || ''} />
            <input
              name="mobile_backdrop_url"
              defaultValue={editing?.mobile_backdrop_url_external || ''}
              placeholder="Backdrop URL"
              className="rounded bg-zinc-900 p-3 outline-none ring-1 ring-zinc-800 md:col-span-1"
            />
            <div className="md:col-span-2 h-[2px] bg-emerald-600/60" />
            {contentActive.key === 'top10' ? (
              <input
                name="rank"
                defaultValue={editing?.rank ?? ''}
                placeholder="Rank (1-10)"
                className="rounded bg-zinc-900 p-3 outline-none ring-1 ring-zinc-800"
              />
            ) : null}
            <div className="md:col-span-2 text-center text-sm font-semibold text-emerald-400">Modal Details</div>
            <input
              name="year"
              type="number"
              defaultValue={editing?.year ?? ''}
              placeholder="Year"
              className="rounded bg-zinc-900 p-3 outline-none ring-1 ring-zinc-800"
            />
            <input
              name="cast"
              defaultValue={editing?.cast || ''}
              placeholder="Cast"
              className="rounded bg-zinc-900 p-3 outline-none ring-1 ring-zinc-800"
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative w-full shrink-0 sm:w-44">
                <select
                  name="maturity"
                  defaultValue={editing?.maturity || ''}
                  className="w-full appearance-none rounded bg-zinc-900 p-3 pr-10 outline-none ring-1 ring-zinc-800"
                >
                  <option value="">U/A Rating</option>
                  <option value="U">U</option>
                  <option value="U/A 7+">U/A 7+</option>
                  <option value="U/A 13+">U/A 13+</option>
                  <option value="U/A 16+">U/A 16+</option>
                  <option value="U/A 18+">U/A 18+</option>
                  <option value="U/A 18+[A]">U/A 18+[A]</option>
                  <option value="A">A</option>
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
                  <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </div>
              <textarea
                name="maturity_detail"
                defaultValue={editing?.maturity_detail || ''}
                placeholder="mature themes"
                className="flex-1 min-h-[48px] rounded bg-zinc-900 p-3 outline-none ring-1 ring-zinc-800"
              />
            </div>
            <input
              name="genres"
              defaultValue={editing?.genres || ''}
              placeholder="Genres (comma separated)"
              className="rounded bg-zinc-900 p-3 outline-none ring-1 ring-zinc-800"
            />
            {contentActive.key !== 'hero' ? (
              <textarea
                name="description"
                defaultValue={editing?.description || ''}
                placeholder="Short detail"
                className="min-h-28 rounded bg-zinc-900 p-3 outline-none ring-1 ring-zinc-800"
              />
            ) : null}
            <div className="flex flex-col gap-3">
              <div className="relative">
                <select
                  name="content_type"
                  defaultValue={editing?.is_series === true ? 'series' : editing?.is_series === false ? 'movie' : ''}
                  className="w-full appearance-none rounded bg-zinc-900 p-3 pr-10 outline-none ring-1 ring-zinc-800"
                >
                  <option value="">This movie / This series</option>
                  <option value="movie">This movie</option>
                  <option value="series">This series</option>
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
                  <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </span>
              </div>
              <input
                name="tags"
                defaultValue={Array.isArray((editing as any)?.tags) ? ((editing as any).tags as string[]).join(', ') : String((editing as any)?.tags || '')}
                placeholder="This movie/show is: (comma separated tags)"
                className="rounded bg-zinc-900 p-3 outline-none ring-1 ring-zinc-800"
              />
              <input
                name="languages"
                defaultValue={Array.isArray((editing as any)?.languages) ? ((editing as any).languages as string[]).join(', ') : String((editing as any)?.languages || '')}
                placeholder="Languages (comma separated)"
                className="rounded bg-zinc-900 p-3 outline-none ring-1 ring-zinc-800"
              />
            </div>
            <LinkPlayerSetting
              initialPlayerType={(editing?.is_series === true || editingEpisodesParsed.length > 0) ? 'series' : 'movie'}
              initialEmbedCode={editing?.embed_code || ''}
              initialEpisodes={editingEpisodesParsed}
            />
            <input type="hidden" name="section" value={contentActive.key} />
            <div className="md:col-span-2">
              <button className="rounded bg-emerald-600 px-4 py-2 font-semibold hover:bg-emerald-500">{editing ? 'Update' : 'Upload'}</button>
            </div>
          </form>
        )
      ) : panel === 'analysis' ? (
        <div className="space-y-6">
          {analyticsError ? (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-200">
              <div className="font-semibold">Analytics not configured</div>
              <div className="mt-2 text-zinc-200/90">Create the Supabase table <span className="font-mono">analytics_events</span> to enable this panel.</div>
              <div className="mt-2 text-xs text-zinc-400">{analyticsError}</div>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-zinc-800 bg-[#0b0b0b]">
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div>
                    <div className="text-sm font-semibold text-zinc-200">Performance</div>
                    <div className="mt-1 text-xs text-zinc-500">{analytics?.rangeLabel || ''}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {(
                      [
                        { key: '24h', label: '24 hours' },
                        { key: '7d', label: '7 days' },
                        { key: '28d', label: '28 days' },
                        { key: '3m', label: '3 months' },
                        { key: '6m', label: '6 months' },
                      ] as const
                    ).map((r) => (
                      <Link
                        key={r.key}
                        href={`/admin?panel=analysis&arange=${r.key}&atab=${encodeURIComponent(String(initialAnalysisTab || 'queries') || 'queries')}`}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${analytics?.rangeKey === r.key ? 'bg-emerald-600 text-white ring-emerald-500/40' : 'bg-zinc-950 text-zinc-300 ring-zinc-800 hover:bg-zinc-900'}`}
                      >
                        {r.label}
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="border-t border-zinc-800 px-5 py-3">
                  <form method="GET" action="/admin" className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="panel" value="analysis" />
                    <input type="hidden" name="arange" value="custom" />
                    <input type="hidden" name="atab" value={String(initialAnalysisTab || '').trim() || 'queries'} />
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded bg-zinc-950 ring-1 ring-zinc-800 text-zinc-300" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    </span>
                    <input
                      name="afrom"
                      type="date"
                      defaultValue={String(initialAnalysisFrom || '').trim()}
                      className="h-8 rounded bg-zinc-950 px-3 text-xs text-zinc-200 outline-none ring-1 ring-zinc-800 focus:ring-zinc-700"
                    />
                    <span className="text-xs text-zinc-500">to</span>
                    <input
                      name="ato"
                      type="date"
                      defaultValue={String(initialAnalysisTo || '').trim()}
                      className="h-8 rounded bg-zinc-950 px-3 text-xs text-zinc-200 outline-none ring-1 ring-zinc-800 focus:ring-zinc-700"
                    />
                    <button className="h-8 rounded bg-zinc-800 px-3 text-xs font-semibold text-white hover:bg-zinc-700">Apply</button>
                  </form>
                </div>

                <div className="grid gap-3 px-5 pb-5 md:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                    <div className="text-xs text-zinc-400">Visitors</div>
                    <div className="mt-2 text-3xl font-bold">{analytics?.uniqueVisitors ?? 0}</div>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                    <div className="text-xs text-zinc-400">Page Views</div>
                    <div className="mt-2 text-3xl font-bold">{analytics?.pageViews ?? 0}</div>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                    <div className="text-xs text-zinc-400">Searches</div>
                    <div className="mt-2 text-3xl font-bold">{analytics?.searches ?? 0}</div>
                  </div>
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                    <div className="text-xs text-zinc-400">Content Views</div>
                    <div className="mt-2 text-3xl font-bold">{analytics?.contentViews ?? 0}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-zinc-800 bg-[#0b0b0b]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {(
                      [
                        { key: 'queries', label: 'Queries' },
                        { key: 'content', label: 'Content' },
                        { key: 'pages', label: 'Pages' },
                        { key: 'countries', label: 'Countries' },
                        { key: 'devices', label: 'Devices' },
                        { key: 'days', label: 'Days' },
                      ] as const
                    ).map((t) => {
                      const active = String(initialAnalysisTab || '').trim() ? String(initialAnalysisTab || '').trim() === t.key : t.key === 'queries';
                      const rangeKey = String(analytics?.rangeKey || '7d');
                      const fromQ = String(initialAnalysisFrom || '').trim();
                      const toQ = String(initialAnalysisTo || '').trim();
                      const extra = rangeKey === 'custom' && fromQ ? `&afrom=${encodeURIComponent(fromQ)}${toQ ? `&ato=${encodeURIComponent(toQ)}` : ''}` : '';
                      return (
                        <Link
                          key={t.key}
                          href={`/admin?panel=analysis&arange=${encodeURIComponent(rangeKey)}&atab=${t.key}${extra}`}
                          className={`rounded px-3 py-1.5 text-xs font-semibold ${active ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'}`}
                        >
                          {t.label}
                        </Link>
                      );
                    })}
                  </div>
                  <div className="text-xs text-zinc-500">Loaded {analytics?.totalEventsLoaded ?? 0} events</div>
                </div>

                {analytics?.supportsGeoDevice === false ? (
                  <div className="border-b border-zinc-800 px-5 py-3 text-xs text-zinc-500">
                    Add columns <span className="font-mono">country</span> and <span className="font-mono">device_type</span> for full Countries/Devices data.
                  </div>
                ) : null}

                <div className="p-5">
                  {(() => {
                    const tab = String(initialAnalysisTab || '').trim() || 'queries';
                    const table = tab === 'content'
                      ? { title: 'Top Content', left: 'Title', rows: (analytics?.topContent || []).map((r) => ({ key: r.title, left: r.title, right: r.count })) }
                      : tab === 'pages'
                        ? { title: 'Top Pages', left: 'Page', rows: (analytics?.topPages || []).map((r) => ({ key: r.path, left: r.path, right: r.count })) }
                        : tab === 'countries'
                          ? { title: 'Top Countries', left: 'Country', rows: (analytics?.topCountries || []).map((r) => ({ key: r.country, left: r.country, right: r.count })) }
                          : tab === 'devices'
                            ? { title: 'Top Devices', left: 'Device', rows: (analytics?.topDevices || []).map((r) => ({ key: r.device, left: r.device, right: r.count })) }
                            : tab === 'days'
                              ? { title: 'By Day', left: 'Day', rows: (analytics?.byDay || []).map((r) => ({ key: r.day, left: r.day, right: r.count })) }
                              : { title: 'Top Queries', left: 'Query', rows: (analytics?.topQueries || []).map((r) => ({ key: r.query, left: r.query, right: r.count })) };

                    return (
                      <>
                        <div className="text-sm font-semibold text-zinc-200">{table.title}</div>
                        <div className="mt-3 overflow-hidden rounded border border-zinc-800">
                          <table className="w-full text-sm">
                            <thead className="bg-zinc-950 text-zinc-300">
                              <tr>
                                <th className="px-3 py-2 text-left font-semibold">{table.left}</th>
                                <th className="px-3 py-2 text-right font-semibold">Count</th>
                              </tr>
                            </thead>
                            <tbody>
                              {table.rows.map((row) => (
                                <tr key={row.key} className="border-t border-zinc-800">
                                  <td className="px-3 py-2 text-zinc-200">{row.left}</td>
                                  <td className="px-3 py-2 text-right text-zinc-200">{row.right}</td>
                                </tr>
                              ))}
                              {table.rows.length === 0 ? (
                                <tr className="border-t border-zinc-800">
                                  <td className="px-3 py-4 text-zinc-500" colSpan={2}>No data yet.</td>
                                </tr>
                              ) : null}
                            </tbody>
                          </table>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </>
          )}
        </div>
      ) : panel === 'devtool' ? (
        <div className="space-y-6">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
            <div>
              <h2 className="text-lg font-semibold">Dev Tool</h2>
              <p className="mt-1 text-sm text-zinc-400">When enabled: disable right-click + copy, and blank the site if DevTools are opened.</p>
            </div>
            <form action={saveDevToolSettings} className="mt-5 space-y-4">
              <FormStatusOverlay pendingText="Saving..." />
              <label className="flex items-center gap-3 rounded bg-zinc-950/40 p-4 ring-1 ring-zinc-800">
                <input
                  name="devtool_enabled"
                  type="checkbox"
                  defaultChecked={!!(devtoolSettings as any)?.enabled}
                  className="h-4 w-4 accent-emerald-500"
                />
                <span className="text-sm text-zinc-200">Enable Dev Tool Protection</span>
              </label>
              <div className="flex justify-end">
                <button className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500">Save</button>
              </div>
            </form>
          </div>
        </div>
      ) : panel === 'customization' ? (
        <div className="space-y-6">
          {customTab === 'header' ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
              <div>
                <h2 className="text-lg font-semibold">Header</h2>
                <p className="mt-1 text-sm text-zinc-400">Rename title, update colors, and adjust navigation + search icon.</p>
              </div>
              <form action={saveHeaderSettings} className="mt-5 space-y-6">
                <FormStatusOverlay pendingText="Saving..." />

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <label className="block text-sm text-zinc-300">Header Title</label>
                    <input
                      name="header_title"
                      defaultValue={String((headerSettings as any)?.titleText || 'NETFLIX')}
                      className="w-full rounded bg-zinc-950 p-3 text-sm outline-none ring-1 ring-zinc-800"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm text-zinc-300">Title Color</label>
                    <input
                      name="header_title_color"
                      defaultValue={String((headerSettings as any)?.titleColor || '')}
                      placeholder="#e50914"
                      className="w-full rounded bg-zinc-950 p-3 text-sm outline-none ring-1 ring-zinc-800"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm text-zinc-300">Title Size (px)</label>
                    <input
                      name="header_title_size"
                      type="number"
                      defaultValue={String((headerSettings as any)?.titleSizePx || '')}
                      placeholder="24"
                      className="w-full rounded bg-zinc-950 p-3 text-sm outline-none ring-1 ring-zinc-800"
                    />
                  </div>
                </div>

                <div className="rounded bg-zinc-950/40 p-4 ring-1 ring-zinc-800">
                  <div className="text-sm font-semibold text-zinc-200">Navigation Labels</div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <input name="nav_home" defaultValue={String((headerSettings as any)?.nav?.home ?? 'Home')} placeholder="Home" className="w-full rounded bg-zinc-950 p-3 text-sm outline-none ring-1 ring-zinc-800" />
                    <input name="nav_tv" defaultValue={String((headerSettings as any)?.nav?.tv ?? 'TV Shows')} placeholder="TV Shows" className="w-full rounded bg-zinc-950 p-3 text-sm outline-none ring-1 ring-zinc-800" />
                    <input name="nav_movies" defaultValue={String((headerSettings as any)?.nav?.movies ?? 'Movies')} placeholder="Movies" className="w-full rounded bg-zinc-950 p-3 text-sm outline-none ring-1 ring-zinc-800" />
                    <input name="nav_new" defaultValue={String((headerSettings as any)?.nav?.new ?? 'New & Popular')} placeholder="New & Popular" className="w-full rounded bg-zinc-950 p-3 text-sm outline-none ring-1 ring-zinc-800" />
                  </div>
                  <div className="mt-3">
                    <label className="block text-sm text-zinc-300 mb-2">Telegram</label>
                    <input
                      name="telegram_label"
                      defaultValue={String((headerSettings as any)?.telegramLabel ?? 'Telegram')}
                      placeholder="Telegram"
                      className="w-full rounded bg-zinc-950 p-3 text-sm outline-none ring-1 ring-zinc-800"
                    />
                    <input
                      name="telegram_url"
                      defaultValue={String((headerSettings as any)?.telegramUrl || '')}
                      placeholder="https://t.me/your_channel"
                      className="mt-3 w-full rounded bg-zinc-950 p-3 text-sm outline-none ring-1 ring-zinc-800"
                    />
                  </div>
                </div>

                <div className="rounded bg-zinc-950/40 p-4 ring-1 ring-zinc-800">
                  <div className="text-sm font-semibold text-zinc-200">Search Icon</div>
                  <div className="mt-3 grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <label className="block text-sm text-zinc-300">Icon Color</label>
                      <input
                        name="search_icon_color"
                        defaultValue={String((headerSettings as any)?.searchIconColor || '')}
                        placeholder="#ffffff"
                        className="w-full rounded bg-zinc-950 p-3 text-sm outline-none ring-1 ring-zinc-800"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm text-zinc-300">Icon Size (px)</label>
                      <input
                        name="search_icon_size"
                        type="number"
                        defaultValue={String((headerSettings as any)?.searchIconSizePx || '')}
                        placeholder="24"
                        className="w-full rounded bg-zinc-950 p-3 text-sm outline-none ring-1 ring-zinc-800"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm text-zinc-300">Icon URL (optional)</label>
                      <input
                        name="search_icon_url"
                        defaultValue={String((headerSettings as any)?.searchIconUrl || '')}
                        placeholder="https://..."
                        className="w-full rounded bg-zinc-950 p-3 text-sm outline-none ring-1 ring-zinc-800"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <ImageFileInput
                      name="search_icon_file"
                      label="Upload Search Icon"
                      accept="image/*"
                      previewHeight={72}
                      initialUrl={(headerSettings as any)?.searchIconUrl ? String((headerSettings as any)?.searchIconUrl) : null}
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500">Save Header</button>
                </div>
              </form>
            </div>
          ) : customTab === 'footer' ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
              <div>
                <h2 className="text-lg font-semibold">Footer</h2>
                <p className="mt-1 text-sm text-zinc-400">Update footer text and show a Netflix-style footer layout.</p>
              </div>
              <form action={saveFooterSettings} className="mt-5 space-y-4">
                <FormStatusOverlay pendingText="Saving..." />
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2 md:col-span-2">
                    <label className="block text-sm text-zinc-300">Questions Line</label>
                    <input
                      name="footer_questions"
                      defaultValue={String((footerSettings as any)?.questionsText || '')}
                      placeholder="Questions? Call 000-800-919-1694"
                      className="w-full rounded bg-zinc-950 p-3 text-sm outline-none ring-1 ring-zinc-800"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm text-zinc-300">Footer Brand</label>
                    <input
                      name="footer_brand"
                      defaultValue={String((footerSettings as any)?.brandText || '')}
                      placeholder="Netflix"
                      className="w-full rounded bg-zinc-950 p-3 text-sm outline-none ring-1 ring-zinc-800"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm text-zinc-300">Created Text</label>
                  <input
                    name="footer_created"
                    defaultValue={String((footerSettings as any)?.createdText || '')}
                    placeholder="Created by ..."
                    className="w-full rounded bg-zinc-950 p-3 text-sm outline-none ring-1 ring-zinc-800"
                  />
                </div>
                <div className="flex justify-end">
                  <button className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500">Save Footer</button>
                </div>
              </form>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">Section Name</h2>
                    <p className="mt-1 text-sm text-zinc-400">Update labels, reorder, or delete custom sections.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button form="section-rename-form" className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500">Save All</button>
                    <button
                      form="section-rename-form"
                      formAction={deleteSelectedSections}
                      className="rounded bg-red-700 px-4 py-2 text-sm font-semibold hover:bg-red-600"
                    >
                      Delete Selected
                    </button>
                  </div>
                </div>
                <form id="section-rename-form" action={saveSectionLabels} className="mt-4 space-y-3">
                  <FormStatusOverlay pendingText="Processing..." />
                  <input type="hidden" name="keys" value={renameSections.map((s) => s.key).join(',')} />
                  <SectionRenameList
                    sections={renameSections}
                    supportsSortOrder={supportsSortOrder}
                    deleteAction={deleteSection}
                  />
                </form>
                {!supportsSortOrder ? (
                  <p className="mt-3 text-xs text-zinc-500">
                    Reorder disabled. Add a <span className="text-zinc-200">sort_order</span> column to section_labels to enable arrow sorting.
                  </p>
                ) : null}
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
                <h2 className="text-lg font-semibold">Add New Section</h2>
                <p className="mt-1 text-sm text-zinc-400">Create a new Upload with a unique key.</p>
                <form action={createSection} className="mt-4 grid gap-3 md:grid-cols-[1fr,1fr,auto]">
                  <input
                    name="key"
                    placeholder="section-key (e.g. action)"
                    className="rounded bg-zinc-950 p-3 text-sm outline-none ring-1 ring-zinc-800"
                  />
                  <input
                    name="label"
                    placeholder="Section label"
                    className="rounded bg-zinc-950 p-3 text-sm outline-none ring-1 ring-zinc-800"
                  />
                  <button className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500">Add Section</button>
                </form>
                <p className="mt-2 text-xs text-zinc-500">Keys should be lowercase, no spaces. Example: action_movies.</p>
              </div>
            </>
          )}
        </div>
      ) : panel === 'security' ? (
        <div className="max-w-xl rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-lg font-semibold">Admin Password Change</h2>
          <p className="mt-1 text-sm text-zinc-400">Change your dashboard login password.</p>
          <form action={updatePassword} className="mt-4 space-y-3">
            <input
              name="current_password"
              type="password"
              placeholder="Current password"
              className="w-full rounded bg-zinc-950 p-3 text-sm outline-none ring-1 ring-zinc-800"
            />
            <input
              name="new_password"
              type="password"
              placeholder="New password"
              className="w-full rounded bg-zinc-950 p-3 text-sm outline-none ring-1 ring-zinc-800"
            />
            <input
              name="confirm_password"
              type="password"
              placeholder="Confirm new password"
              className="w-full rounded bg-zinc-950 p-3 text-sm outline-none ring-1 ring-zinc-800"
            />
            <button className="rounded bg-emerald-600 px-4 py-2 font-semibold hover:bg-emerald-500">Update Password</button>
          </form>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <div className="text-sm text-zinc-400">Total Titles</div>
            <div className="mt-2 text-3xl font-bold">{stats?.total ?? 0}</div>
          </div>
          {sections.map((section) => (
            <div key={section.key} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
              <div className="text-sm text-zinc-400">{section.label}</div>
              <div className="mt-2 text-3xl font-bold">{stats?.counts?.[section.key] ?? 0}</div>
            </div>
          ))}
        </div>
      )}
    </main>
  </div>
  );
}
