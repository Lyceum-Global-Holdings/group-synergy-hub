-- Fix existing pending company_supplier allocations to approved
UPDATE company_suppliers 
SET status = 'approved', 
    approved_at = NOW(), 
    approved_by = allocated_by,
    updated_at = NOW()
WHERE status = 'pending';