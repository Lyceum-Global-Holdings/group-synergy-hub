

## Fix: Follower Count Auto-Capture Failing

### Root Cause
The edge function `fetch-social-stats` tries to fetch public social media page HTML and scrape follower counts from meta tags. The logs show:
```
Fetching social stats for facebook: https://www.facebook.com/LyceumGlobalHoldings
Failed to fetch URL: 400
```

Facebook (and Instagram, LinkedIn, Twitter/X) actively block server-side scraping — they return 400/403 or require JavaScript rendering. The current regex-based meta-tag scraping approach cannot work for these platforms.

### Solution: Use Official Platform APIs via the Edge Function

Replace the naive HTML scraping with **official API calls** for platforms that support them, and fall back gracefully for others.

**1. Update `supabase/functions/fetch-social-stats/index.ts`**

Add platform-specific API fetching:

- **Facebook/Instagram**: Use the Facebook Graph API (`graph.facebook.com/v19.0/{page_id}?fields=followers_count&access_token=...`). Requires a Facebook App access token stored as an edge function secret (`FACEBOOK_ACCESS_TOKEN`).
- **YouTube**: Use the YouTube Data API v3 (`googleapis.com/youtube/v3/channels?part=statistics&forUsername=...`). Requires `YOUTUBE_API_KEY` secret.
- **Twitter/X**: Use the X API v2 (`api.x.com/2/users/by/username/{handle}?user.fields=public_metrics`). Requires `TWITTER_BEARER_TOKEN` secret.
- **LinkedIn**: No public follower API for pages without OAuth — keep as manual-only with a clear message.
- **Fallback for all platforms**: If the API key is not configured or the call fails, attempt the existing HTML scraping as a last resort, then return `null` with a helpful message.

The function will:
1. Parse the URL to extract the platform handle/page ID
2. Check if the relevant API secret is available
3. If yes → call the official API → return the count
4. If no → attempt HTML scrape (existing logic) → return count or null
5. Return a `message` field explaining why it couldn't fetch (e.g., "Facebook API key not configured — enter count manually")

**2. Add secrets check in the edge function**

The function should gracefully handle missing secrets — if `FACEBOOK_ACCESS_TOKEN` is not set, it skips the API call and returns a message telling the user to configure it or enter the count manually.

**3. Update `AccountRegistry.tsx` toast messages**

Show the specific `message` from the edge function response so the user knows *why* it couldn't auto-detect (e.g., "Facebook blocks automated access — please enter manually" vs. a generic message).

### Files to Edit
1. `supabase/functions/fetch-social-stats/index.ts` — add platform API integrations with secret-based fallback
2. `src/pages/social-media/AccountRegistry.tsx` — display the specific failure message from the response

### Secrets Needed (optional — system works without them)
- `FACEBOOK_ACCESS_TOKEN` — Facebook/Instagram Graph API
- `YOUTUBE_API_KEY` — YouTube Data API v3
- `TWITTER_BEARER_TOKEN` — X/Twitter API v2

Without these secrets, the system gracefully falls back to manual entry with a clear explanation.

