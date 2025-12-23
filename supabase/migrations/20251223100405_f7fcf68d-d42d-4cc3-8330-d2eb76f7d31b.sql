-- Drop the restrictive update policy on warehouse_bin_allocations
DROP POLICY IF EXISTS "Users can update their bin allocations or admins can update" ON public.warehouse_bin_allocations;

-- Create a new policy that allows any authenticated user to update bin allocations
-- This is needed for stock transfers where the allocation was created by someone else
CREATE POLICY "Authenticated users can update bin allocations"
ON public.warehouse_bin_allocations
FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- Also update warehouse_bins policy to allow any authenticated user to update
-- (needed when updating bin quantities during transfers)
DROP POLICY IF EXISTS "Users can update bins they created or admins can update any" ON public.warehouse_bins;

CREATE POLICY "Authenticated users can update warehouse bins"
ON public.warehouse_bins
FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- Update stock_transactions policy to allow any authenticated user to update
-- (for retry scenarios where transaction might need updating)
DROP POLICY IF EXISTS "Users can update transactions they created or admins can update" ON public.stock_transactions;

CREATE POLICY "Authenticated users can update stock transactions"
ON public.stock_transactions
FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- Update stock_transfer_requests policy to allow any authenticated user to update status
-- (needed when completing transfers created by other users)
DROP POLICY IF EXISTS "Users can update their own requests or admins can update any" ON public.stock_transfer_requests;

CREATE POLICY "Authenticated users can update transfer requests"
ON public.stock_transfer_requests
FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- Update stock_transfer_items policy to be more permissive for completing transfers
DROP POLICY IF EXISTS "Users can manage transfer items for their own requests" ON public.stock_transfer_items;

CREATE POLICY "Authenticated users can manage transfer items"
ON public.stock_transfer_items
FOR ALL
USING (auth.uid() IS NOT NULL);
