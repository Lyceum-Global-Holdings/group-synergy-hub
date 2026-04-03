

## New Module: Social Media Management

A company-scoped module for managing social media accounts, page access, and NDA compliance — built to international digital governance standards (ISO 27001 information security, GDPR data handling).

### Database Schema (4 new tables)

**1. `social_media_accounts`** — Master registry of all social media pages/accounts
- `id`, `company_id`, `platform` (enum: facebook, instagram, linkedin, twitter, youtube, tiktok, whatsapp, pinterest, snapchat, other), `account_name`, `account_handle`, `account_url`, `account_type` (business, personal, creator), `status` (active, inactive, suspended, archived), `description`, `profile_image_url`, `follower_count`, `added_by`, `created_at`, `updated_at`
- RLS: company-scoped via `can_access_company(company_id)`

**2. `social_media_access`** — Who has access to each account + their role
- `id`, `company_id`, `account_id` (FK → social_media_accounts), `user_id` (FK → profiles), `access_level` (admin, editor, viewer, analyst), `access_granted_by`, `access_granted_at`, `access_revoked_at`, `is_active`, `notes`, `created_at`, `updated_at`
- RLS: company-scoped

**3. `social_media_ndas`** — NDA tracking per user per account
- `id`, `company_id`, `access_id` (FK → social_media_access), `user_id`, `nda_signed` (boolean), `nda_signed_at`, `nda_expiry_date`, `nda_document_url` (link to stored NDA file), `nda_version`, `witnessed_by`, `notes`, `created_at`, `updated_at`
- RLS: company-scoped

**4. `social_media_activity_log`** — Audit trail for all changes
- `id`, `company_id`, `account_id`, `action` (account_added, access_granted, access_revoked, nda_signed, nda_expired, account_deactivated), `performed_by`, `details` (JSONB), `created_at`
- RLS: company-scoped, append-only

### Module Config

Add `social-media` to `moduleConfig.ts` with sub-modules:
- **Account Registry** (`/social-media/accounts`) — Add/edit/view all social media pages per company
- **Access Management** (`/social-media/access`) — Grant/revoke user access, set access levels
- **NDA Compliance** (`/social-media/nda-compliance`) — Track NDA signing status, expiry alerts, upload NDA documents
- **Activity Log** (`/social-media/activity-log`) — Full audit trail of all account and access changes

### Pages & Components

**Account Registry page** (`src/pages/social-media/AccountRegistry.tsx`)
- Table listing all social media accounts for current company
- Platform icon + badge, account handle, status, follower count, number of users with access
- Add/Edit dialog with platform selector, account details, URL validation
- Filter by platform, status
- Bulk actions: activate, deactivate, archive

**Access Management page** (`src/pages/social-media/AccessManagement.tsx`)
- Table showing user ↔ account access mappings
- Columns: User, Account, Platform, Access Level, NDA Status (signed/pending/expired badge), Granted By, Date
- Grant access dialog: select user, select account(s), set access level
- Revoke access with confirmation and audit log entry
- Filter by account, user, access level, NDA status

**NDA Compliance page** (`src/pages/social-media/NDACompliance.tsx`)
- Dashboard view: total accounts, users with access, NDAs signed vs pending vs expired
- Table: User, Account, NDA Status (color-coded badge), Signed Date, Expiry Date, Document link
- Upload NDA document (Supabase Storage)
- Mark as signed with date + witness
- Expiry alerts: highlight NDAs expiring within 30 days in amber, expired in red
- Bulk reminder action

**Activity Log page** (`src/pages/social-media/ActivityLog.tsx`)
- Chronological audit trail with filters by account, user, action type, date range
- Each entry shows: timestamp, user, action, account, details

### Routing

Add 4 new routes under the protected layout in `App.tsx`:
- `/social-media/accounts`
- `/social-media/access`
- `/social-media/nda-compliance`
- `/social-media/activity-log`

### Icon

Uses `Share2` from lucide-react for the sidebar icon (standard social/network icon).

### Security

- All tables use `can_access_company(company_id)` RLS
- DELETE restricted to admin roles via `is_admin(auth.uid())`
- Activity log is append-only (INSERT only, no UPDATE/DELETE)
- NDA document uploads stored in a private Supabase Storage bucket

### Files to Create/Edit

1. **Migration SQL** — Create 4 tables + RLS policies + platform enum
2. `src/constants/moduleConfig.ts` — Add `social-media` module entry
3. `src/pages/social-media/AccountRegistry.tsx` — Account management page
4. `src/pages/social-media/AccessManagement.tsx` — User access page
5. `src/pages/social-media/NDACompliance.tsx` — NDA tracking page
6. `src/pages/social-media/ActivityLog.tsx` — Audit log page
7. `src/App.tsx` — Add 4 routes + lazy imports

