const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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

function extractFollowerCount(html: string, platform: string): number | null {
  // Try og:description first — most platforms include follower counts here
  const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i);

  if (ogDescMatch) {
    const desc = ogDescMatch[1];
    // Patterns like "1.2M Followers", "12,345 followers", "1.5K Subscribers"
    const followerMatch = desc.match(/([\d.,]+[KMBkmb]?)\s*(followers|subscriber|abonnés|seguidores)/i);
    if (followerMatch) {
      const count = parseSocialCount(followerMatch[1]);
      if (count !== null) return count;
    }
  }

  // Try description meta tag
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  if (descMatch) {
    const desc = descMatch[1];
    const followerMatch = desc.match(/([\d.,]+[KMBkmb]?)\s*(followers|subscriber|abonnés|seguidores)/i);
    if (followerMatch) {
      const count = parseSocialCount(followerMatch[1]);
      if (count !== null) return count;
    }
  }

  // YouTube specific: subscriberCount in JSON-LD or ytInitialData
  if (platform === 'youtube') {
    const subMatch = html.match(/"subscriberCountText":\s*\{\s*"simpleText":\s*"([^"]+)"/);
    if (subMatch) {
      const count = parseSocialCount(subMatch[1].replace(/\s*(subscribers?)/i, ''));
      if (count !== null) return count;
    }
  }

  // Generic: look for follower/subscriber counts in visible text patterns
  const genericMatch = html.match(/([\d.,]+[KMBkmb]?)\s*(followers|subscribers)/i);
  if (genericMatch) {
    const count = parseSocialCount(genericMatch[1]);
    if (count !== null) return count;
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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

    console.log(`Fetching social stats for ${platform}: ${formattedUrl}`);

    const response = await fetch(formattedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      console.error(`Failed to fetch URL: ${response.status}`);
      return new Response(
        JSON.stringify({ success: true, follower_count: null, message: 'Could not access page' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const html = await response.text();
    const followerCount = extractFollowerCount(html, platform || '');

    console.log(`Extracted follower count: ${followerCount}`);

    return new Response(
      JSON.stringify({ success: true, follower_count: followerCount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching social stats:', error);
    return new Response(
      JSON.stringify({ success: true, follower_count: null, message: 'Failed to fetch stats' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
