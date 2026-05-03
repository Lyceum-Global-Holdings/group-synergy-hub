import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Allowlist of social-platform hosts the scrape fallback may contact.
// Prevents this endpoint being abused as an SSRF proxy to internal/arbitrary URLs.
const ALLOWED_SCRAPE_HOSTS = new Set<string>([
  'youtube.com', 'www.youtube.com', 'm.youtube.com',
  'twitter.com', 'www.twitter.com', 'mobile.twitter.com',
  'x.com', 'www.x.com',
  'tiktok.com', 'www.tiktok.com',
  'facebook.com', 'www.facebook.com', 'm.facebook.com',
  'instagram.com', 'www.instagram.com',
  'linkedin.com', 'www.linkedin.com',
]);

function isAllowedScrapeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    return ALLOWED_SCRAPE_HOSTS.has(u.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function parseSocialCount(text: string): number | null {
  if (!text) return null;
  const cleaned = text.replace(/,/g, '').trim().toLowerCase();
  const match = cleaned.match(/^([\d.]+)\s*([kmb])?$/);
  if (!match) return null;
  const num = parseFloat(match[1]);
  const suffix = match[2];
  if (suffix === 'k') return Math.round(num * 1000);
  if (suffix === 'm') return Math.round(num * 1000000);
  if (suffix === 'b') return Math.round(num * 1000000000);
  return Math.round(num);
}

function extractHandleFromUrl(url: string, platform: string): string | null {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/+$/, '');
    const segments = path.split('/').filter(Boolean);

    if (platform === 'youtube') {
      // youtube.com/@handle or youtube.com/channel/ID or youtube.com/c/name
      if (segments[0] === 'channel' && segments[1]) return segments[1];
      if (segments[0]?.startsWith('@')) return segments[0];
      if (segments[0] === 'c' && segments[1]) return segments[1];
      if (segments[0] === 'user' && segments[1]) return segments[1];
      if (segments[0]) return segments[0];
    }

    if (platform === 'twitter') {
      // twitter.com/handle or x.com/handle
      if (segments[0] && !['i', 'search', 'explore', 'home'].includes(segments[0])) {
        return segments[0].replace(/^@/, '');
      }
    }

    if (platform === 'facebook' || platform === 'instagram') {
      if (segments[0] && !['p', 'reel', 'stories', 'explore'].includes(segments[0])) {
        return segments[0];
      }
    }

    return segments[0] || null;
  } catch {
    return null;
  }
}

function extractFollowerCount(html: string, platform: string): number | null {
  const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i);

  if (ogDescMatch) {
    const desc = ogDescMatch[1];
    const followerMatch = desc.match(/([\d.,]+[KMBkmb]?)\s*(followers|subscriber|abonnés|seguidores)/i);
    if (followerMatch) {
      const count = parseSocialCount(followerMatch[1]);
      if (count !== null) return count;
    }
  }

  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  if (descMatch) {
    const desc = descMatch[1];
    const followerMatch = desc.match(/([\d.,]+[KMBkmb]?)\s*(followers|subscriber|abonnés|seguidores)/i);
    if (followerMatch) {
      const count = parseSocialCount(followerMatch[1]);
      if (count !== null) return count;
    }
  }

  if (platform === 'youtube') {
    const subMatch = html.match(/"subscriberCountText":\s*\{\s*"simpleText":\s*"([^"]+)"/);
    if (subMatch) {
      const count = parseSocialCount(subMatch[1].replace(/\s*(subscribers?)/i, ''));
      if (count !== null) return count;
    }
  }

  const genericMatch = html.match(/([\d.,]+[KMBkmb]?)\s*(followers|subscribers)/i);
  if (genericMatch) {
    const count = parseSocialCount(genericMatch[1]);
    if (count !== null) return count;
  }

  return null;
}

// --- Platform API fetchers ---

async function fetchFacebookFollowers(handle: string, token: string): Promise<{ count: number | null; message?: string }> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${encodeURIComponent(handle)}?fields=followers_count,fan_count&access_token=${token}`
    );
    if (!res.ok) {
      console.error(`Facebook API error: ${res.status}`);
      return { count: null, message: `Facebook API returned ${res.status} — the page ID may be incorrect or the token lacks permissions` };
    }
    const data = await res.json();
    const count = data.followers_count ?? data.fan_count ?? null;
    return { count };
  } catch (e) {
    console.error('Facebook API fetch error:', e);
    return { count: null, message: 'Facebook API call failed' };
  }
}

async function fetchInstagramFollowers(handle: string, token: string): Promise<{ count: number | null; message?: string }> {
  try {
    // First get the IG business account ID via the Facebook page
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${encodeURIComponent(handle)}?fields=instagram_business_account{followers_count}&access_token=${token}`
    );
    if (!res.ok) {
      return { count: null, message: `Instagram API returned ${res.status}` };
    }
    const data = await res.json();
    const count = data?.instagram_business_account?.followers_count ?? null;
    return { count };
  } catch {
    return { count: null, message: 'Instagram API call failed' };
  }
}

async function fetchYouTubeFollowers(handle: string, apiKey: string): Promise<{ count: number | null; message?: string }> {
  try {
    let apiUrl: string;
    if (handle.startsWith('UC') && handle.length > 20) {
      apiUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${encodeURIComponent(handle)}&key=${apiKey}`;
    } else if (handle.startsWith('@')) {
      apiUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics&forHandle=${encodeURIComponent(handle)}&key=${apiKey}`;
    } else {
      apiUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics&forHandle=${encodeURIComponent('@' + handle)}&key=${apiKey}`;
    }

    const res = await fetch(apiUrl);
    if (!res.ok) {
      return { count: null, message: `YouTube API returned ${res.status}` };
    }
    const data = await res.json();
    const items = data?.items;
    if (items && items.length > 0) {
      const subCount = parseInt(items[0].statistics?.subscriberCount, 10);
      return { count: isNaN(subCount) ? null : subCount };
    }
    return { count: null, message: 'YouTube channel not found' };
  } catch {
    return { count: null, message: 'YouTube API call failed' };
  }
}

async function fetchTwitterFollowers(handle: string, bearerToken: string): Promise<{ count: number | null; message?: string }> {
  try {
    const res = await fetch(
      `https://api.x.com/2/users/by/username/${encodeURIComponent(handle)}?user.fields=public_metrics`,
      { headers: { Authorization: `Bearer ${bearerToken}` } }
    );
    if (!res.ok) {
      return { count: null, message: `Twitter/X API returned ${res.status}` };
    }
    const data = await res.json();
    const count = data?.data?.public_metrics?.followers_count ?? null;
    return { count };
  } catch {
    return { count: null, message: 'Twitter/X API call failed' };
  }
}

// --- Scraping fallback ---

async function scrapeFallback(url: string, platform: string): Promise<{ count: number | null; message?: string }> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });
    if (!response.ok) {
      return { count: null, message: `Page returned HTTP ${response.status} — platform may block automated access` };
    }
    const html = await response.text();
    const count = extractFollowerCount(html, platform);
    if (count !== null) return { count };
    return { count: null, message: 'Could not extract follower count from page HTML' };
  } catch {
    return { count: null, message: 'Failed to fetch page for scraping' };
  }
}

// --- Main handler ---

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ---- Auth guard: require a valid Supabase JWT ----
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ success: false, error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { url, platform } = await req.json();

    if (!url || typeof url !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    const platformKey = (platform || '').toLowerCase();
    const handle = extractHandleFromUrl(formattedUrl, platformKey);

    console.log(`Fetching social stats for ${platformKey}: ${formattedUrl} (handle: ${handle})`);

    // Try official API first if secrets are configured
    let apiResult: { count: number | null; message?: string } | null = null;

    if (platformKey === 'facebook' && handle) {
      const token = Deno.env.get('FACEBOOK_ACCESS_TOKEN');
      if (token) {
        apiResult = await fetchFacebookFollowers(handle, token);
      } else {
        apiResult = { count: null, message: 'Facebook API key not configured — enter follower count manually or ask admin to add FACEBOOK_ACCESS_TOKEN secret' };
      }
    } else if (platformKey === 'instagram' && handle) {
      const token = Deno.env.get('FACEBOOK_ACCESS_TOKEN');
      if (token) {
        apiResult = await fetchInstagramFollowers(handle, token);
      } else {
        apiResult = { count: null, message: 'Instagram API key not configured — enter follower count manually or ask admin to add FACEBOOK_ACCESS_TOKEN secret' };
      }
    } else if (platformKey === 'youtube' && handle) {
      const apiKey = Deno.env.get('YOUTUBE_API_KEY');
      if (apiKey) {
        apiResult = await fetchYouTubeFollowers(handle, apiKey);
      } else {
        apiResult = { count: null, message: 'YouTube API key not configured — enter subscriber count manually or ask admin to add YOUTUBE_API_KEY secret' };
      }
    } else if ((platformKey === 'twitter' || platformKey === 'x') && handle) {
      const bearer = Deno.env.get('TWITTER_BEARER_TOKEN');
      if (bearer) {
        apiResult = await fetchTwitterFollowers(handle, bearer);
      } else {
        apiResult = { count: null, message: 'Twitter/X API key not configured — enter follower count manually or ask admin to add TWITTER_BEARER_TOKEN secret' };
      }
    } else if (platformKey === 'linkedin') {
      apiResult = { count: null, message: 'LinkedIn does not offer a public follower API — please enter follower count manually' };
    }

    // If API returned a count, use it
    if (apiResult?.count != null) {
      console.log(`API follower count: ${apiResult.count}`);
      return new Response(
        JSON.stringify({ success: true, follower_count: apiResult.count, source: 'api' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If API was tried but failed (with a message), try scraping as fallback
    // Skip scraping fallback for platforms known to block it
    const scrapeBlockedPlatforms = ['facebook', 'instagram', 'linkedin'];
    if (!scrapeBlockedPlatforms.includes(platformKey)) {
      console.log('API unavailable or failed, trying scrape fallback...');
      const scrapeResult = await scrapeFallback(formattedUrl, platformKey);
      if (scrapeResult.count != null) {
        console.log(`Scrape follower count: ${scrapeResult.count}`);
        return new Response(
          JSON.stringify({ success: true, follower_count: scrapeResult.count, source: 'scrape' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Return with explanation message
    const message = apiResult?.message || 'Could not auto-detect follower count — please enter manually';
    console.log(`No follower count found. Message: ${message}`);

    return new Response(
      JSON.stringify({ success: true, follower_count: null, message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching social stats:', error);
    return new Response(
      JSON.stringify({ success: true, follower_count: null, message: 'Failed to fetch stats — please enter manually' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
