-- Allow public read access to asset_master for public request form
DROP POLICY IF EXISTS "Public can view asset master for requests" ON asset_master;
CREATE POLICY "Public can view asset master for requests" 
ON asset_master 
FOR SELECT 
USING (true);

-- Allow public read access to asset_categories for public request form
DROP POLICY IF EXISTS "Public can view asset categories for requests" ON asset_categories;
CREATE POLICY "Public can view asset categories for requests" 
ON asset_categories 
FOR SELECT 
USING (true);