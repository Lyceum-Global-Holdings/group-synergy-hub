-- Create public policy for warehouse assets to allow QR code functionality
CREATE POLICY "Public can view basic asset information for QR codes" 
ON public.warehouse_assets 
FOR SELECT 
TO anon, authenticated
USING (true);