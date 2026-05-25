## Plan — Pass Lighthouse PWA installability + uptime monitoring (dashboard + external alerts)

---

### Part A — Lighthouse PWA installability

**Root cause:** `public/pwa-192x192.png` and `public/pwa-512x512.png` are actually JPEGs (verified with `file`), both 512×512. Lighthouse/Chrome installability requires a **192×192 PNG** and a **512×512 PNG** whose bytes match the `image/png` MIME declared in the manifest. Everything else is in place (manifest linked, `theme-color`, viewport, HTTPS, `display: standalone`, `start_url`, name/short_name).

**Changes:**

1. **Regenerate proper PNG icons** via `imagegen` (transparent background, brand mark on `#1e40af`):
   - `public/pwa-192x192.png` — true 192×192 PNG
   - `public/pwa-512x512.png` — true 512×512 PNG
   - `public/apple-touch-icon.png` — 180×180 PNG (iOS home-screen)
   - `public/favicon-32x32.png` and `public/favicon-16x16.png`

2. **`index.html`** — add the icons explicitly (Lighthouse warns if `apple-touch-icon` is missing) and a `<meta name="application-name">`:
   ```html
   <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
   <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
   <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
   ```

3. **`public/manifest.webmanifest`** — pin the icon `purpose` cleanly so Lighthouse counts both an `any` and a `maskable` icon ≥ 192 px:
   ```json
   "icons": [
     { "src": "/pwa-192x192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
     { "src": "/pwa-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
     { "src": "/pwa-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
   ]
   ```

4. **No service worker** added — matches project PWA guidance. Lighthouse's *installability* audit passes without a SW; only the legacy "PWA category score" needs one.

**Verification:** after publish, run PageSpeed Insights on `https://stores.lgh.lk` and confirm "Web app manifest and service worker meet the installability requirements" passes (SW line is not required for installability since Lighthouse 12).

---

### Part B — Uptime monitoring: internal dashboard + external alerts

#### B1. Internal dashboard (Supabase pg_cron + edge function)

**New edge function `uptime-probe`** (`verify_jwt = false`, secret-token gated):
- Probes a fixed list of targets every 5 min:
  - `GET https://stores.lgh.lk/` (frontend)
  - `GET https://stores.lgh.lk/manifest.webmanifest` (asset)
  - `OPTIONS` on each critical edge function: `public-bin-qr`, `security-settings-public`, `send-telegram-report`, `peppol-send`
- For each target records: `target`, `url`, `status_code`, `latency_ms`, `ok` (boolean), `checked_at`, `error`.
- Authenticated by `X-Probe-Token` header against `Deno.env.get('UPTIME_PROBE_TOKEN')` so only pg_cron can invoke it.

**Schema (migration):**
- Table `uptime_checks` — `target text`, `url text`, `status_code int`, `latency_ms int`, `ok boolean`, `error text`, `checked_at timestamptz default now()`.
- Index `(target, checked_at desc)`.
- 90-day retention via a daily `delete from uptime_checks where checked_at < now() - interval '90 days'` cron.
- View `uptime_rollup_30d` returning per-target: `checks`, `failures`, `uptime_pct` (= `ok_count / total * 100`), `p50_ms`, `p95_ms`, `last_status`, `last_checked_at`.
- RLS: SELECT on the table + view restricted to **admin / super_admin** via `has_role`. No INSERT/UPDATE/DELETE for clients (edge function uses service role).

**pg_cron** (raw SQL inserted post-migration so the project ref + token stay out of git):
```sql
select cron.schedule(
  'uptime-probe-5min', '*/5 * * * *',
  $$ select net.http_post(
       url := 'https://ajsyvuozkgcnnvvefeed.supabase.co/functions/v1/uptime-probe',
       headers := jsonb_build_object('Content-Type','application/json','X-Probe-Token','<token>')
     ); $$);
select cron.schedule(
  'uptime-prune-daily', '15 3 * * *',
  $$ delete from public.uptime_checks where checked_at < now() - interval '90 days'; $$);
```

**Frontend — new `UptimeMonitor` tab on `/admin/backend`:**
- Per-target cards: 30-day uptime % (color: ≥99 green, 95–99 amber, <95 red), p50/p95 latency, last status, last checked.
- Sparkline (last 24 h, hourly bucket) using existing `Sparkline` component.
- Filter: last 24 h / 7 d / 30 d.
- Auto-refresh every 60 s.
- Manual **"Run probe now"** button (super_admin only) that calls the edge function directly with the probe token.

#### B2. External monitor (UptimeRobot — free, no infra)

- Document in `README.md` → "Uptime monitoring" section: register `https://stores.lgh.lk` and `https://ajsyvuozkgcnnvvefeed.supabase.co/functions/v1/security-settings-public` as HTTP(s) monitors at 5-min interval. Alerts intentionally off per your choice — UptimeRobot's public status page (`stats.uptimerobot.com/...`) is enough.
- Optional: paste the public status-page URL into `security_settings.status_page_url` so the admin dashboard can link to it (1 extra column, super_admin only).

---

### Files touched

| File | Purpose |
|---|---|
| `public/pwa-192x192.png`, `pwa-512x512.png`, `apple-touch-icon.png`, `favicon-*` | True PNG icons |
| `public/manifest.webmanifest` | Clean icon `purpose` declarations |
| `index.html` | Add `apple-touch-icon` + favicon links |
| `supabase/migrations/<ts>_uptime_monitoring.sql` | `uptime_checks` table, RLS, `uptime_rollup_30d` view, `status_page_url` column |
| `supabase/functions/uptime-probe/index.ts` | Probe runner, token-gated |
| `src/components/admin/backend/UptimeMonitorPanel.tsx` | Dashboard tab |
| `src/hooks/useUptimeRollup.ts` | React Query reader |
| `src/pages/admin/BackendDashboard.tsx` | Register new "Uptime" tab |
| `README.md` | UptimeRobot setup steps |

### Secrets needed
- `UPTIME_PROBE_TOKEN` — random string, shared between pg_cron call and the edge function. I'll request this via `secrets` before deploying the function.

### Out of scope
- Service-worker / offline support (would change the PWA score but breaks Lovable preview).
- Outage alerts (Telegram/email) — explicitly declined.
- Real synthetic browser uptime (Playwright probes) — overkill for this app.

Approve and I'll implement.