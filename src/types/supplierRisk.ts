// Enums
export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';
export type RiskCategory = 'quality' | 'delivery' | 'financial' | 'compliance' | 'ethical' | 'legal' | 'operational' | 'other';
export type RiskFlagStatus = 'active' | 'resolved' | 'under_review' | 'escalated';
export type BlacklistStatus = 'blacklisted' | 'watchlist' | 'cleared';
export type ActionType = 'flagged' | 'blacklisted' | 'cleared' | 'escalated' | 'resolved' | 'updated' | 'reviewed';
export type ReviewDecision = 'maintain' | 'clear' | 'escalate';

// Supplier Risk Flag
export interface SupplierRiskFlag {
  id: string;
  supplier_id: string;
  risk_category: RiskCategory;
  risk_severity: RiskSeverity;
  status: RiskFlagStatus;
  title: string;
  description?: string;
  evidence_urls: string[];
  financial_impact?: number;
  flagged_date: string;
  flagged_by?: string;
  resolved_date?: string;
  resolved_by?: string;
  resolution_notes?: string;
  review_date?: string;
  next_review_date?: string;
  auto_alert_enabled: boolean;
  company_id?: string;
  created_at: string;
  updated_at: string;
}

// Supplier Blacklist
export interface SupplierBlacklist {
  id: string;
  supplier_id: string;
  status: BlacklistStatus;
  blacklist_reason: string;
  blacklisted_date: string;
  blacklisted_by?: string;
  cleared_date?: string;
  cleared_by?: string;
  clearing_reason?: string;
  permanent: boolean;
  review_required: boolean;
  review_frequency_days: number;
  next_review_date?: string;
  related_risk_flags: string[];
  restrictions: Record<string, any>;
  company_id?: string;
  created_at: string;
  updated_at: string;
}

// Risk Flag History
export interface RiskFlagHistory {
  id: string;
  risk_flag_id: string;
  action_type: ActionType;
  action_date: string;
  performed_by?: string;
  previous_status?: RiskFlagStatus;
  new_status?: RiskFlagStatus;
  notes?: string;
  metadata: Record<string, any>;
  created_at: string;
}

// Blacklist Review
export interface BlacklistReview {
  id: string;
  blacklist_id: string;
  review_date: string;
  reviewed_by?: string;
  decision: ReviewDecision;
  recommendation?: string;
  next_review_date?: string;
  supporting_evidence: Record<string, any>;
  created_at: string;
}

// Risk Alert Rule
export interface RiskAlertRule {
  id: string;
  rule_name: string;
  risk_category?: RiskCategory;
  min_severity: RiskSeverity;
  alert_recipients: string[];
  alert_on_creation: boolean;
  alert_on_escalation: boolean;
  alert_frequency_days?: number;
  is_active: boolean;
  company_id?: string;
  created_at: string;
  updated_at: string;
}

// Create/Update DTOs
export interface CreateRiskFlagData {
  supplier_id: string;
  risk_category: RiskCategory;
  risk_severity: RiskSeverity;
  title: string;
  description?: string;
  evidence_urls?: string[];
  financial_impact?: number;
  flagged_date?: string;
  review_date?: string;
  next_review_date?: string;
  auto_alert_enabled?: boolean;
  company_id?: string;
}

export interface UpdateRiskFlagData extends Partial<CreateRiskFlagData> {
  status?: RiskFlagStatus;
  resolved_date?: string;
  resolved_by?: string;
  resolution_notes?: string;
}

export interface CreateBlacklistData {
  supplier_id: string;
  status?: BlacklistStatus;
  blacklist_reason: string;
  blacklisted_date?: string;
  permanent?: boolean;
  review_required?: boolean;
  review_frequency_days?: number;
  related_risk_flags?: string[];
  restrictions?: Record<string, any>;
  company_id?: string;
}

export interface UpdateBlacklistData extends Partial<CreateBlacklistData> {
  cleared_date?: string;
  cleared_by?: string;
  clearing_reason?: string;
}

export interface CreateBlacklistReviewData {
  blacklist_id: string;
  review_date?: string;
  decision: ReviewDecision;
  recommendation?: string;
  next_review_date?: string;
  supporting_evidence?: Record<string, any>;
}

export interface CreateAlertRuleData {
  rule_name: string;
  risk_category?: RiskCategory;
  min_severity: RiskSeverity;
  alert_recipients: string[];
  alert_on_creation?: boolean;
  alert_on_escalation?: boolean;
  alert_frequency_days?: number;
  is_active?: boolean;
  company_id?: string;
}

// Constants
export const RISK_SEVERITIES = [
  { value: 'low', label: 'Low', color: 'text-green-600' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-600' },
  { value: 'high', label: 'High', color: 'text-orange-600' },
  { value: 'critical', label: 'Critical', color: 'text-red-600' }
] as const;

export const RISK_CATEGORIES = [
  { value: 'quality', label: 'Quality' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'financial', label: 'Financial' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'ethical', label: 'Ethical' },
  { value: 'legal', label: 'Legal' },
  { value: 'operational', label: 'Operational' },
  { value: 'other', label: 'Other' }
] as const;

export const RISK_FLAG_STATUSES = [
  { value: 'active', label: 'Active', color: 'text-red-600' },
  { value: 'under_review', label: 'Under Review', color: 'text-yellow-600' },
  { value: 'escalated', label: 'Escalated', color: 'text-orange-600' },
  { value: 'resolved', label: 'Resolved', color: 'text-green-600' }
] as const;

export const BLACKLIST_STATUSES = [
  { value: 'blacklisted', label: 'Blacklisted', color: 'text-red-600' },
  { value: 'watchlist', label: 'Watchlist', color: 'text-yellow-600' },
  { value: 'cleared', label: 'Cleared', color: 'text-green-600' }
] as const;

export const REVIEW_DECISIONS = [
  { value: 'maintain', label: 'Maintain Blacklist' },
  { value: 'clear', label: 'Clear Supplier' },
  { value: 'escalate', label: 'Escalate' }
] as const;
