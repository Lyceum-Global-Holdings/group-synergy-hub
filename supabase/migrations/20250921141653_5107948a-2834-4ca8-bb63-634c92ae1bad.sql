-- Update all currency defaults to LKR across all tables
UPDATE suppliers SET currency = 'LKR' WHERE currency = 'USD' OR currency IS NULL;
UPDATE purchase_orders SET currency = 'LKR' WHERE currency = 'USD' OR currency IS NULL;

-- Update any future defaults by changing table defaults
ALTER TABLE suppliers ALTER COLUMN currency SET DEFAULT 'LKR';
ALTER TABLE purchase_orders ALTER COLUMN currency SET DEFAULT 'LKR';