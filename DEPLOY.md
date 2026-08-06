# Self-hosting `group-synergy-hub`

This app is a static Vite/React SPA that talks directly to Supabase. Deploying it
means serving the built files (the included Docker image uses nginx) — there is no
backend server of your own to run. Supabase (DB + auth + RPCs) is already hosted.

The pipeline:

```
push to main → CI (lint/typecheck/test/build) ✓
            → Publish & Deploy workflow:
                 1. builds the production image
                 2. pushes it to GHCR (ghcr.io/lyceum-global-holdings/group-synergy-hub-635158f0)
                 3. (optional) SSHes to your server and rolls it out
```

---

## 1. One-time GitHub setup

The image build needs the Supabase config (these are **public** anon values, safe to
store). In the repo: **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://ajsyvuozkgcnnvvefeed.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | your Supabase **anon/publishable** key |

> These likely already exist (CI uses them). If not, add them or the published image
> will point at a placeholder Supabase project.

---

## 2. One-time server setup

On your server (any Linux box with Docker):

```bash
# Install Docker + compose plugin (skip if already installed)
curl -fsSL https://get.docker.com | sh

# Authenticate to GHCR so the server can pull the image.
# Create a GitHub PAT (classic) with the read:packages scope, then:
echo "<YOUR_GITHUB_PAT>" | docker login ghcr.io -u <your-github-username> --password-stdin
#   ── OR make the package public (GitHub → repo → Packages → package → Settings →
#      Change visibility → Public) and skip the login entirely.

# Grab the compose file and start it.
mkdir -p /opt/synergy-hub && cd /opt/synergy-hub
curl -fsSLO https://raw.githubusercontent.com/Lyceum-Global-Holdings/group-synergy-hub-635158f0/main/docker-compose.yml
docker compose up -d
```

The app is now served on **`http://<server>:8080`**.

### TLS / custom domain

Put a reverse proxy in front for HTTPS. Easiest is **Caddy** (auto-TLS):

```caddyfile
# /etc/caddy/Caddyfile
app.yourdomain.com {
    reverse_proxy localhost:8080
}
```

```bash
sudo apt install -y caddy && sudo systemctl reload caddy
```

(Or use nginx + certbot, or a Cloudflare Tunnel pointed at `localhost:8080`.)

---

## 3. Enable push-to-deploy (optional but recommended)

Add these repo secrets so the **Publish & Deploy** workflow rolls out automatically
after each push to `main`:

| Secret | Example | Notes |
|---|---|---|
| `DEPLOY_SSH_HOST` | `203.0.113.10` | server IP/hostname |
| `DEPLOY_SSH_USER` | `deploy` | SSH user |
| `DEPLOY_SSH_KEY` | *(private key)* | contents of an SSH private key whose public key is in the server's `~/.ssh/authorized_keys` |
| `DEPLOY_PATH` | `/opt/synergy-hub` | dir containing `docker-compose.yml` |
| `DEPLOY_SSH_PORT` | `22` | optional, defaults to 22 |

Until `DEPLOY_SSH_HOST` is set, the deploy job **skips gracefully** — the image is
still published to GHCR, you just pull it manually (step 4).

---

## 4. Manual deploy / update

On the server, whenever you want the latest build:

```bash
cd /opt/synergy-hub
docker compose pull
docker compose up -d
docker image prune -f
```

---

## Notes

- **Database migrations** are applied to Supabase directly (not part of this image).
  A frontend deploy and a DB migration are independent steps.
- Changing the Supabase keys requires a **rebuild** (they're inlined at build time) —
  push to `main` (or re-run the workflow) after updating the secrets.
- This replaces the old Lovable "Share → Publish" flow. You can keep editing in
  Lovable (it still syncs to GitHub); the live site now updates from GHCR instead.
