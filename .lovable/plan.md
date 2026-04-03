

## Add Company Selector + Auto Follower Count to Social Media Accounts

### Changes

**1. Add Company Selector to the Add/Edit Dialog**

Currently, accounts are silently tied to whichever company is selected in the global header. The dialog will gain a "Company" dropdown at the top, pre-filled with the current company but changeable. This uses the same `companies` list from `useCompany()`.

**2. Auto-capture Follower Count from URL**

When a user pastes a social media page URL into the "Account URL" field, the system will attempt to extract the follower count automatically.

**Approach**: Create a Supabase Edge Function (`fetch-social-stats`) that receives a URL + platform, fetches the public page HTML, and scrapes the follower count from meta tags or structured data (most platforms expose this in `og:` tags or JSON-LD). The dialog will show a small "Fetching followers..." indicator when a valid URL is pasted, and auto-populate the follower count field.

- Facebook: `og:description` or page HTML contains follower/like counts
- Instagram: `og:description` meta tag contains follower count
- LinkedIn: Limited; will attempt meta scraping
- Twitter/X: `og:description` or page content
- YouTube: subscriber count from page metadata
- Fallback: If scraping fails, the field stays manual with a toast notification

**3. UI Updates to the Dialog**

- Add Company selector as the first field (full width, above Platform/Account Type row)
- Add a loading spinner next to the follower count field when auto-fetching
- URL field gets an `onBlur`/debounced handler that triggers the fetch

### Files to Create/Edit

1. **`supabase/functions/fetch-social-stats/index.ts`** — Edge Function that accepts `{ url, platform }`, fetches the page, extracts follower count from meta tags, returns `{ follower_count: number | null }`
2. **`src/pages/social-media/AccountRegistry.tsx`** — Add company selector to dialog, add URL-change handler that calls the edge function, show loading state on follower count field

### Technical Notes

- The edge function uses standard `fetch()` with a browser-like User-Agent to get public page HTML
- Follower count extraction uses regex on `og:description` and common meta patterns — no API keys needed
- If the fetch fails or count can't be parsed, the field remains editable manually (graceful degradation)
- The company selector only shows companies the user has access to (same list as the header selector)

