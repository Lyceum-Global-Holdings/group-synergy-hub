export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export type AccountCategory = 
  | 'current_asset' | 'fixed_asset' | 'other_asset'
  | 'current_liability' | 'long_term_liability'
  | 'equity' | 'retained_earnings'
  | 'operating_revenue' | 'other_revenue'
  | 'operating_expense' | 'cogs' | 'other_expense';

export type NormalBalance = 'debit' | 'credit';

export type JournalType = 
  | 'manual' | 'system_generated' | 'opening_balance' 
  | 'closing' | 'adjusting' | 'reversing' | 'recurring';

export type JournalStatus = 'draft' | 'posted' | 'void' | 'reversed';

export type PeriodStatus = 'open' | 'closed' | 'locked';

export interface ChartOfAccount {
  id: string;
  account_code: string;
  account_name: string;
  account_type: AccountType;
  account_category: AccountCategory;
  parent_account_id?: string;
  level: number;
  is_header: boolean;
  is_active: boolean;
  is_control_account: boolean;
  normal_balance: NormalBalance;
  opening_balance: number;
  opening_balance_date?: string;
  current_balance: number;
  currency: string;
  cost_center_id?: string;
  notes?: string;
  company_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface JournalEntry {
  id: string;
  journal_number: string;
  journal_date: string;
  journal_type: JournalType;
  reference_type?: string;
  reference_id?: string;
  reference_number?: string;
  description: string;
  total_debit: number;
  total_credit: number;
  is_balanced: boolean;
  status: JournalStatus;
  period_id?: string;
  fiscal_year?: number;
  period_month?: number;
  posted_by?: string;
  posted_date?: string;
  reversed_by?: string;
  reversed_date?: string;
  reversal_je_id?: string;
  is_recurring: boolean;
  recurrence_pattern?: RecurrencePattern;
  tags?: string[];
  attachments?: Attachment[];
  approval_required: boolean;
  approved_by?: string;
  approved_date?: string;
  company_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  lines?: JournalEntryLine[];
}

export interface JournalEntryLine {
  id?: string;
  journal_entry_id?: string;
  line_number: number;
  account_id: string;
  description?: string;
  debit_amount: number;
  credit_amount: number;
  currency: string;
  exchange_rate: number;
  base_currency_amount?: number;
  cost_center_id?: string;
  department_id?: string;
  project_id?: string;
  supplier_id?: string;
  customer_id?: string;
  item_id?: string;
  tax_code_id?: string;
  tax_amount?: number;
  dimension_1?: string;
  dimension_2?: string;
  dimension_3?: string;
  created_at?: string;
  updated_at?: string;
  // Navigation properties
  account?: ChartOfAccount;
}

export interface AccountingPeriod {
  id: string;
  period_name: string;
  fiscal_year: number;
  period_number: number;
  start_date: string;
  end_date: string;
  status: PeriodStatus;
  closed_by?: string;
  closed_date?: string;
  company_id?: string;
  created_at: string;
  updated_at: string;
}

export interface FiscalYear {
  id: string;
  year_name: string;
  fiscal_year: number;
  start_date: string;
  end_date: string;
  status: PeriodStatus;
  is_current: boolean;
  company_id?: string;
  created_at: string;
  updated_at: string;
}

export interface CostCenter {
  id: string;
  code: string;
  name: string;
  description?: string;
  parent_id?: string;
  is_active: boolean;
  manager_id?: string;
  company_id?: string;
  created_at: string;
  updated_at: string;
}

export interface TaxCode {
  id: string;
  tax_code: string;
  tax_name: string;
  tax_rate: number;
  tax_type: string;
  gl_account_id?: string;
  is_active: boolean;
  company_id?: string;
  created_at: string;
  updated_at: string;
}

export interface TrialBalanceRow {
  account_code: string;
  account_name: string;
  account_type: string;
  debit_balance: number;
  credit_balance: number;
}

export interface RecurrencePattern {
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  day: number;
  end_date?: string;
}

export interface Attachment {
  name: string;
  url: string;
  uploaded_at: string;
}

export interface CreateAccountData {
  account_code: string;
  account_name: string;
  account_type: AccountType;
  account_category: AccountCategory;
  parent_account_id?: string;
  is_header?: boolean;
  normal_balance: NormalBalance;
  opening_balance?: number;
  opening_balance_date?: string;
  currency?: string;
  cost_center_id?: string;
  notes?: string;
  company_id?: string;
}

export interface CreateJournalEntryData {
  journal_date: string;
  journal_type?: JournalType;
  reference_type?: string;
  reference_id?: string;
  reference_number?: string;
  description: string;
  lines: JournalEntryLine[];
  tags?: string[];
  company_id?: string;
}
