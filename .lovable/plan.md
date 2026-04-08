

## Expand Manual to 150+ Pages with CI/CD & Edge Functions

### Current State
- Manual is **72 pages** across 12 chapters
- Chapters 4–11 are thin (abbreviated content, ~2-3 pages each)
- No CI/CD or Edge Function documentation exists

### Expansion Strategy (Target: 160+ pages)

#### A. New Chapter 13 — CI/CD Pipeline & DevOps (~12 pages)
- 13.1 CI/CD Overview (Lovable → Supabase deployment architecture)
- 13.2 Frontend Build Pipeline (Vite build, Docker containerization, the existing Dockerfile)
- 13.3 Backend Deployment (Edge Functions auto-deploy, database migrations)
- 13.4 Environment Management (development, staging, production)
- 13.5 Version Control & Branching Strategy
- 13.6 Automated Testing Strategy
- 13.7 Rollback Procedures
- 13.8 Monitoring & Alerting
- Process flow: Code Commit → Build → Test → Deploy → Monitor

#### B. New Chapter 14 — Edge Functions & Serverless Architecture (~14 pages)
Documents all 10 existing edge functions with purpose, inputs, outputs, and security:
- 14.1 Edge Function Architecture (Deno runtime, Supabase hosting, JWT validation)
- 14.2 `admin-create-user` — Programmatic user provisioning
- 14.3 `admin-reset-password` — Secure password reset
- 14.4 `analyze-floor-plan` — AI-powered floor plan analysis
- 14.5 `fetch-social-stats` — Social media follower tracking with API fallback
- 14.6 `po-email-approval` — Purchase order email approval workflow
- 14.7 `public-supplier-registration` — Public supplier onboarding with Zod validation
- 14.8 `scheduled-telegram-reports` — Automated Telegram report delivery (pg_cron)
- 14.9 `send-approval-notification` — Multi-channel approval notifications (Resend)
- 14.10 `send-telegram-report` / `test-telegram-connection` — Telegram integration
- 14.11 CORS & Security Hardening Standards
- 14.12 Edge Function Monitoring & Logs
- Process flow: Edge Function Request Lifecycle

#### C. Expand Existing Thin Chapters (~60 additional pages total)
Each of chapters 4–11 currently has minimal content. Expand each with:
- **"What You Will See"** subsections describing the actual UI screens
- **"Step-by-Step"** operational procedures (numbered steps)
- **Field reference tables** (field name, type, required, description)
- **Status lifecycle tables** (e.g., PO statuses: Draft → Submitted → Approved → Issued)
- **Callout boxes** for key concepts and warnings
- **"The Bottom Line"** summary boxes
- Additional process flow diagrams where missing

Specific expansions:
- **Ch5 Finance**: Add detailed GL posting rules table, bank reconciliation step-by-step, budget variance analysis
- **Ch6 Production**: Expand BOM structure, add costing methodology, production receipt workflow
- **Ch7 Construction**: Add Gantt-style progress tracking explanation, safety incident reporting, daily report templates
- **Ch8 Sales**: Add CPO fulfillment lifecycle, delivery note fields, dispatch checklist
- **Ch9 Social Media**: Add platform-specific integration details, NDA workflow
- **Ch10 Management**: Add dashboard widget catalog, KPI formula reference table
- **Ch11 Admin**: Add role creation step-by-step, module allocation matrix, location mapping guide

#### D. Expand Appendices (~6 additional pages)
- 12.9 Edge Function Reference Table (all 10 functions with endpoint, auth, purpose)
- 12.10 CI/CD Pipeline Configuration Reference
- 12.11 Docker & Self-Hosting Guide
- 12.12 Environment Variables Reference

### Technical Approach
1. Modify the existing `/tmp/manual_gen.py` script
2. Add `ch13_cicd()` and `ch14_edge_functions()` builder functions
3. Expand each existing thin chapter function with additional content
4. Update TOC to include new chapters
5. Regenerate PDF and QA visually

### Files
- `/tmp/manual_gen.py` — edit (expand)
- `/mnt/documents/GroupSynergyHub_Executive_Manual_v2.pdf` — new versioned output

