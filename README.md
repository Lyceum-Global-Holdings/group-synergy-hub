# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/97371e45-ba68-475a-8e58-140dc43c3510

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/97371e45-ba68-475a-8e58-140dc43c3510) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/97371e45-ba68-475a-8e58-140dc43c3510) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

## Uptime monitoring

Internal dashboard: **/admin/backend → Uptime tab** (admin / super_admin only).
Shows 30-day uptime %, p50/p95 latency, and 24 h sparkline per probed target.

### Activate the pg_cron schedule (one-time, super_admin only)

Open the Supabase SQL Editor and run, replacing `<UPTIME_PROBE_TOKEN>` with
the value you stored as the project secret of the same name:

```sql
select cron.schedule(
  'uptime-probe-5min', '*/5 * * * *',
  $$ select net.http_post(
       url := 'https://ajsyvuozkgcnnvvefeed.supabase.co/functions/v1/uptime-probe',
       headers := jsonb_build_object(
         'Content-Type','application/json',
         'x-probe-token','<UPTIME_PROBE_TOKEN>'
       )
     ); $$);

select cron.schedule(
  'uptime-prune-daily', '15 3 * * *',
  $$ delete from public.uptime_checks where checked_at < now() - interval '90 days'; $$);
```

First probe results appear within 5 minutes.

### External monitor (recommended)

For independent third-party verification:

1. Create a free account at https://uptimerobot.com/.
2. Add an HTTP(s) monitor for `https://stores.lgh.lk` at 5-minute interval.
3. Add a second HTTP(s) monitor for
   `https://ajsyvuozkgcnnvvefeed.supabase.co/functions/v1/security-settings-public`.
4. Enable the public status page and (optionally) paste its URL into
   `security_settings.status_page_url`.

No outage alerts are sent — the admin dashboard is the source of truth.
