-- Force PostgREST to reload schema so new columns are recognized
NOTIFY pgrst, 'reload schema';

-- Optional: touch table comment to ensure cache invalidation paths
COMMENT ON TABLE po_approval_tokens IS 'Stores approval tokens for PO email approvals (updated)';