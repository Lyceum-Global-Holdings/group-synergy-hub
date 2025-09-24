-- Add finished_good_id column to pr_items table to support selection from finished goods
ALTER TABLE pr_items 
ADD COLUMN finished_good_id UUID REFERENCES finished_goods(id);