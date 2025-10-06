-- Add missing fields to material_issue_notes table
ALTER TABLE material_issue_notes
ADD COLUMN IF NOT EXISTS requested_by text,
ADD COLUMN IF NOT EXISTS contact_number text,
ADD COLUMN IF NOT EXISTS epf_number text,
ADD COLUMN IF NOT EXISTS items_required_date date,
ADD COLUMN IF NOT EXISTS job_number text,
ADD COLUMN IF NOT EXISTS pr_number text,
ADD COLUMN IF NOT EXISTS po_number text,
ADD COLUMN IF NOT EXISTS dispatch_note text,
ADD COLUMN IF NOT EXISTS received_by uuid,
ADD COLUMN IF NOT EXISTS received_by_name text,
ADD COLUMN IF NOT EXISTS received_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS issued_by uuid,
ADD COLUMN IF NOT EXISTS issued_by_name text,
ADD COLUMN IF NOT EXISTS order_completed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS hod_approved_by uuid,
ADD COLUMN IF NOT EXISTS hod_approval_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS management_approved_by uuid,
ADD COLUMN IF NOT EXISTS management_approval_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS mr_received_by uuid,
ADD COLUMN IF NOT EXISTS mr_received_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS form_reference text;

-- Add missing fields to material_issue_items table
ALTER TABLE material_issue_items
ADD COLUMN IF NOT EXISTS line_number integer,
ADD COLUMN IF NOT EXISTS item_code text,
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS purpose text,
ADD COLUMN IF NOT EXISTS unit_of_measure text DEFAULT 'pcs',
ADD COLUMN IF NOT EXISTS quantity_required numeric,
ADD COLUMN IF NOT EXISTS quantity_received numeric,
ADD COLUMN IF NOT EXISTS recipient_signature text;