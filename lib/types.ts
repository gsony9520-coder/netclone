export type Section =
  | 'hero'
  | 'top10'
  | 'trending'
  | 'bollywood'
  | 'hollywood'
  | 'korean'
  | 'anime'
  | 'animated'
  | string;

export interface Movie {
  id: string;
  title: string;
  poster_url: string;
  poster_url_external?: string | null;
  mobile_poster_url?: string | null;
  mobile_poster_url_external?: string | null;
  backdrop_url: string | null;
  backdrop_url_external?: string | null;
  mobile_backdrop_url?: string | null;
  mobile_backdrop_url_external?: string | null;
  logo_url?: string | null;
  logo_url_external?: string | null;
  embed_code: string | null;
  section: Section;
  rank: number | null;
  created_at?: string;
  year?: number | null;
  cast?: string | null;
  maturity?: string | null;
  maturity_detail?: string | null;
  genres?: string | null;
  tags?: string[] | null;
  languages?: string | string[] | null;
  is_series?: boolean | null;
  episodes?: Array<{
    number: number;
    title: string;
    embed_code?: string | null;
    embed_link?: string | null;
    duration?: string | null;
  }> | null;
  description?: string | null;
}
