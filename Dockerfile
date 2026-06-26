# ── Stage 1: build the Vite SPA ───────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

# Install deps (peer-dep conflicts require legacy resolution — matches CI).
COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

# Supabase config is inlined into the bundle at build time. The publishable
# (anon) key is public by design, so baking it into the image is safe.
# Defaults keep CI's "docker build" smoke test working without secrets.
ARG VITE_SUPABASE_URL=https://placeholder.supabase.co
ARG VITE_SUPABASE_PUBLISHABLE_KEY=placeholder-key
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    NODE_OPTIONS=--max-old-space-size=4096

RUN npm run build

# ── Stage 2: serve the static build with nginx ────────────────────────────────
FROM nginx:1.27-alpine AS serve
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://localhost/ >/dev/null 2>&1 || exit 1
CMD ["nginx", "-g", "daemon off;"]
