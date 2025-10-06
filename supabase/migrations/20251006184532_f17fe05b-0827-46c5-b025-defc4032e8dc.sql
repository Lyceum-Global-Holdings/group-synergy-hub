-- Add timestamp tracking columns to material_issue_items
ALTER TABLE material_issue_items
ADD COLUMN issued_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN received_at TIMESTAMP WITH TIME ZONE;

-- Add index for better query performance
CREATE INDEX idx_material_issue_items_issued_at ON material_issue_items(issued_at);
CREATE INDEX idx_material_issue_items_received_at ON material_issue_items(received_at);

COMMENT ON COLUMN material_issue_items.issued_at IS 'Timestamp when the item was actually issued from warehouse';
COMMENT ON COLUMN material_issue_items.received_at IS 'Timestamp when the item was received by the requester';