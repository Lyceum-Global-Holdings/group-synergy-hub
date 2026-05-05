## A3 Marketing Brochure — Lyceum Global Holdings ERP

Generate a professional, print-ready **A3 bi-fold brochure** (2 pages, front + back, landscape) summarizing the platform's modules, integrations, capabilities, and scalability story. Delivered as PDF to `/mnt/documents/`.

### Format Decision

**Standard chosen:** A3 landscape, 2 pages (front cover + inside spread style on a single A3, plus back). This matches industry-standard corporate ERP brochures (SAP, Oracle, Odoo) and prints/folds cleanly to A4 when halved.

- Page size: A3 landscape (420 × 297 mm)
- Pages: 2 (front = hero + modules; back = integrations + scalability + engineering + contact strip)
- Bleed-safe margins, brand palette `#1F4E78` / `#2E75B6` / neutral grays
- Typography: clean sans-serif (Helvetica/Inter family via reportlab)

### Content Layout

**Page 1 — Hero & Modules**
- Brand band: "Lyceum Global Holdings — Group Synergy Hub"
- Tagline: "One Platform. Every Function. Built to Scale."
- Hero stats strip: 11 Modules · 70+ Sub-modules · Multi-tenant · Realtime
- 3-column grid of all 11 modules (Warehouse, Procurement, Sourcing, Finance, Construction, Production, TUH/Customer, Management, Admin, Social Media, Auth) with sub-module bullet lists
- Subtle iconography per module (vector glyphs drawn in reportlab)

**Page 2 — Integrations, Scalability, Engineering**

*Integrations panel* (icon grid):
Telegram Bot · Resend Email · MFA/TOTP · Supabase (Postgres, RLS, Auth, Storage, Edge, Realtime) · Lovable AI Gateway · 3D Floor-plan Analyzer · QR Code (PDF/PNG bulk) · PDF/Excel/CSV exports · SAP-compatible mappings

*Scalability panel* (NEW — key addition):
- Multi-tenant company isolation with company-scoped RLS
- Horizontal scaling via Supabase managed Postgres + edge functions
- Performance: composite `(company_id, created_at DESC)` indexes, keyset pagination, SECURITY INVOKER list RPCs
- Virtualized tables for ≥200 rows, React Query tiered caching (30s SWR)
- Realtime sync bus with debounced scoped invalidation
- Bulk import bypassing 1,000-row API limits
- Scheduled jobs via pg_cron + pg_net
- Edge functions auto-scale; stateless React frontend on global CDN
- Designed to handle multi-company, multi-location, multi-warehouse growth

*Platform Capabilities*: RBAC, approval workflows, FIFO batch tracking, three-way match, audit logs, error management

*Engineering & Quality*: React 18 / Vite / TS strict · Vitest unit testing · Web Vitals budget · Perf telemetry · Security scanner · Hardened edge functions

*Footer strip*: Confidential — Internal Use · Generated [date] · Lyceum ERP

### Technical Approach

- Python `reportlab` Platypus + Canvas overlay for brand bands and icon glyphs
- Two-page A3 landscape `BaseDocTemplate` with custom frames (3-col grid page 1; 2-col asymmetric page 2)
- Color palette and typography centralized as constants
- QA: `pdftoppm -r 150` → inspect both pages for overflow/clipping/overlap, iterate until clean
- Output: `/mnt/documents/LGH_Brochure_A3.pdf`
- Deliver via `<lov-artifact>` tag

No open questions — proceeding with A3 landscape 2-page bi-fold standard on approval.
