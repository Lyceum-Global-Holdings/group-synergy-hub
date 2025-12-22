-- Add new transaction types for project-related stock movements
ALTER TYPE stock_transaction_type ADD VALUE IF NOT EXISTS 'project_issue';
ALTER TYPE stock_transaction_type ADD VALUE IF NOT EXISTS 'project_return';

-- Add new reference type for project transactions
ALTER TYPE stock_reference_type ADD VALUE IF NOT EXISTS 'project';