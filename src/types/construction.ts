export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
export type ProjectType = 'residential' | 'commercial' | 'industrial' | 'infrastructure';
export type PhaseStatus = 'pending' | 'in_progress' | 'completed' | 'delayed';
export type SiteStatus = 'active' | 'inactive' | 'completed';
export type TeamRole = 'project_manager' | 'site_engineer' | 'supervisor' | 'safety_officer' | 'quality_inspector';

export interface ConstructionProject {
  id: string;
  company_id: string | null;
  project_code: string;
  project_name: string;
  description: string | null;
  client_name: string | null;
  client_contact: string | null;
  project_type: ProjectType | null;
  status: ProjectStatus;
  start_date: string | null;
  target_end_date: string | null;
  actual_end_date: string | null;
  estimated_budget: number | null;
  actual_cost: number | null;
  project_manager_id: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  contract_number: string | null;
  contract_value: number | null;
  completion_percentage: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectSite {
  id: string;
  project_id: string;
  site_code: string;
  site_name: string;
  description: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  site_manager_id: string | null;
  status: SiteStatus;
  area_sqft: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectTeamMember {
  id: string;
  project_id: string;
  user_id: string;
  role: TeamRole;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectPhase {
  id: string;
  project_id: string;
  phase_number: number;
  phase_name: string;
  description: string | null;
  planned_start_date: string | null;
  planned_end_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
  status: PhaseStatus;
  completion_percentage: number | null;
  budget_allocated: number | null;
  actual_cost: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectData {
  project_name: string;
  description?: string;
  client_name?: string;
  client_contact?: string;
  project_type?: ProjectType;
  status?: ProjectStatus;
  start_date?: string;
  target_end_date?: string;
  estimated_budget?: number;
  project_manager_id?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  contract_number?: string;
  contract_value?: number;
  notes?: string;
}

export interface UpdateProjectData extends Partial<CreateProjectData> {
  id: string;
  actual_end_date?: string;
  actual_cost?: number;
  completion_percentage?: number;
}

export const PROJECT_STATUSES: { value: ProjectStatus; label: string; color: string }[] = [
  { value: 'planning', label: 'Planning', color: 'bg-blue-100 text-blue-800' },
  { value: 'active', label: 'Active', color: 'bg-green-100 text-green-800' },
  { value: 'on_hold', label: 'On Hold', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'completed', label: 'Completed', color: 'bg-purple-100 text-purple-800' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-800' },
];

export const PROJECT_TYPES: { value: ProjectType; label: string }[] = [
  { value: 'residential', label: 'Residential' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'infrastructure', label: 'Infrastructure' },
];

export const TEAM_ROLES: { value: TeamRole; label: string }[] = [
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'site_engineer', label: 'Site Engineer' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'safety_officer', label: 'Safety Officer' },
  { value: 'quality_inspector', label: 'Quality Inspector' },
];

export interface FloorDrawing {
  id: string;
  project_id: string;
  company_id: string | null;
  drawing_name: string;
  description: string | null;
  floor_number: number;
  image_url: string;
  wall_height: number;
  scale_factor: number | null;
  total_area_sqm: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateFloorDrawingData {
  project_id: string;
  drawing_name: string;
  description?: string;
  floor_number?: number;
  image_url: string;
  wall_height?: number;
  scale_factor?: number;
  total_area_sqm?: number;
}

export interface FloorDrawingRoom {
  id: string;
  floor_drawing_id: string;
  room_name: string;
  room_type: string | null;
  area_sqm: number | null;
  area_sqft: number | null;
  coordinates: RoomCoordinate[] | null;
  center_x: number | null;
  center_y: number | null;
  width_percent: number | null;
  height_percent: number | null;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoomCoordinate {
  x: number;
  y: number;
}

export interface DetectedRoom {
  room_name: string;
  room_type: string;
  center_x: number;
  center_y: number;
  width_percent: number;
  height_percent: number;
  area_sqm: number | null;
  area_sqft: number | null;
  color: string;
}

// Room Stages Types
export type RoomStageStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

export interface FloorRoomStage {
  id: string;
  room_id: string;
  company_id: string | null;
  stage_order: number;
  stage_name: string;
  description: string | null;
  status: RoomStageStatus;
  completion_percentage: number | null;
  planned_start_date: string | null;
  planned_end_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
  assigned_to: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const DEFAULT_ROOM_STAGES = [
  { stage_name: 'Preparation', description: 'Site preparation and cleanup' },
  { stage_name: 'Structural Work', description: 'Framing, walls, ceiling structure' },
  { stage_name: 'Electrical', description: 'Electrical wiring and outlets' },
  { stage_name: 'Plumbing', description: 'Plumbing rough-in and fixtures' },
  { stage_name: 'HVAC', description: 'Heating, ventilation, and air conditioning' },
  { stage_name: 'Insulation', description: 'Wall and ceiling insulation' },
  { stage_name: 'Drywall', description: 'Drywall installation and finishing' },
  { stage_name: 'Painting', description: 'Priming and painting' },
  { stage_name: 'Flooring', description: 'Floor installation' },
  { stage_name: 'Finishing', description: 'Final touches and fixtures' },
];

export const ROOM_STAGE_STATUSES: { value: RoomStageStatus; label: string; color: string }[] = [
  { value: 'pending', label: 'Pending', color: 'bg-muted text-muted-foreground' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-blue-100 text-blue-800' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-800' },
  { value: 'blocked', label: 'Blocked', color: 'bg-red-100 text-red-800' },
];

// Room Material Types
export type RoomMaterialStatus = 'planned' | 'allocated' | 'partially_used' | 'fully_used';

export interface FloorRoomMaterial {
  id: string;
  room_id: string;
  warehouse_item_id: string;
  company_id: string | null;
  quantity_required: number;
  quantity_allocated: number | null;
  quantity_used: number | null;
  unit_cost: number | null;
  total_cost: number | null;
  status: RoomMaterialStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  warehouse_item?: {
    id: string;
    item_code: string;
    name: string;
    current_stock: number | null;
    unit_cost: number | null;
  };
}

export const ROOM_MATERIAL_STATUSES: { value: RoomMaterialStatus; label: string; color: string }[] = [
  { value: 'planned', label: 'Planned', color: 'bg-blue-100 text-blue-800' },
  { value: 'allocated', label: 'Allocated', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'partially_used', label: 'Partially Used', color: 'bg-orange-100 text-orange-800' },
  { value: 'fully_used', label: 'Fully Used', color: 'bg-green-100 text-green-800' },
];

// =====================================================
// WORK ORDERS
// =====================================================

export type WorkOrderStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type WorkOrderPriority = 'low' | 'medium' | 'high' | 'urgent';
export type WorkOrderType = 'civil' | 'electrical' | 'plumbing' | 'finishing' | 'structural' | 'mechanical' | 'other';

export interface WorkOrder {
  id: string;
  project_id: string;
  company_id: string | null;
  work_order_number: string;
  title: string;
  description: string | null;
  work_type: WorkOrderType | null;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  assigned_to: string | null;
  site_id: string | null;
  planned_start_date: string | null;
  planned_end_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  project?: ConstructionProject;
  site?: ProjectSite;
  assigned_user?: { full_name: string };
}

export interface CreateWorkOrderData {
  project_id: string;
  title: string;
  description?: string;
  work_type?: WorkOrderType;
  priority?: WorkOrderPriority;
  status?: WorkOrderStatus;
  assigned_to?: string;
  site_id?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  estimated_hours?: number;
  estimated_cost?: number;
  notes?: string;
}

export type UpdateWorkOrderData = Partial<CreateWorkOrderData>;

export const WORK_ORDER_STATUSES: { value: WorkOrderStatus; label: string; color: string }[] = [
  { value: 'pending', label: 'Pending', color: 'bg-muted text-muted-foreground' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-blue-100 text-blue-800' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-800' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-800' },
];

export const WORK_ORDER_PRIORITIES: { value: WorkOrderPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'bg-gray-100 text-gray-800' },
  { value: 'medium', label: 'Medium', color: 'bg-blue-100 text-blue-800' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-800' },
];

export const WORK_ORDER_TYPES: { value: WorkOrderType; label: string }[] = [
  { value: 'civil', label: 'Civil' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'finishing', label: 'Finishing' },
  { value: 'structural', label: 'Structural' },
  { value: 'mechanical', label: 'Mechanical' },
  { value: 'other', label: 'Other' },
];

// =====================================================
// DAILY SITE REPORTS
// =====================================================

export type DailyReportStatus = 'draft' | 'submitted' | 'approved';

export interface DailySiteReport {
  id: string;
  project_id: string;
  company_id: string | null;
  report_number: string;
  report_date: string;
  site_id: string | null;
  weather_conditions: string | null;
  temperature_high: number | null;
  temperature_low: number | null;
  labor_count: number | null;
  skilled_labor_count: number | null;
  unskilled_labor_count: number | null;
  subcontractor_count: number | null;
  visitor_count: number | null;
  work_summary: string | null;
  delays_issues: string | null;
  materials_received: string | null;
  equipment_on_site: string | null;
  safety_observations: string | null;
  photos_url: string[] | null;
  submitted_by: string | null;
  approved_by: string | null;
  status: DailyReportStatus;
  created_at: string;
  updated_at: string;
  // Joined fields
  project?: ConstructionProject;
  site?: ProjectSite;
}

export interface CreateDailySiteReportData {
  project_id: string;
  report_date: string;
  site_id?: string;
  weather_conditions?: string;
  temperature_high?: number;
  temperature_low?: number;
  labor_count?: number;
  subcontractor_count?: number;
  visitor_count?: number;
  work_summary?: string;
  delays_issues?: string;
  materials_received?: string;
  equipment_on_site?: string;
  safety_observations?: string;
  photos_url?: string[];
}

export type UpdateDailySiteReportData = Partial<CreateDailySiteReportData>;

export interface SiteReportActivity {
  id: string;
  report_id: string;
  activity_type: string;
  description: string | null;
  location: string | null;
  labor_hours: number | null;
  completion_percentage: number | null;
  notes: string | null;
  created_at: string;
}

export const DAILY_REPORT_STATUSES: { value: DailyReportStatus; label: string; color: string }[] = [
  { value: 'draft', label: 'Draft', color: 'bg-muted text-muted-foreground' },
  { value: 'submitted', label: 'Submitted', color: 'bg-blue-100 text-blue-800' },
  { value: 'approved', label: 'Approved', color: 'bg-green-100 text-green-800' },
];

export const WEATHER_CONDITIONS = [
  'Sunny', 'Partly Cloudy', 'Cloudy', 'Rainy', 'Stormy', 'Windy', 'Hot', 'Cold', 'Humid'
];

// =====================================================
// CONSTRUCTION RESOURCES
// =====================================================

export type ResourceType = 'labor' | 'equipment' | 'material' | 'subcontractor';
export type ResourceStatus = 'planned' | 'active' | 'completed' | 'released';

export interface ConstructionResource {
  id: string;
  project_id: string;
  company_id: string | null;
  resource_type: ResourceType;
  resource_name: string;
  description: string | null;
  unit: string | null;
  quantity_allocated: number | null;
  quantity_used: number | null;
  unit_cost: number | null;
  total_cost: number | null;
  start_date: string | null;
  end_date: string | null;
  status: ResourceStatus;
  assigned_site_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  project?: ConstructionProject;
  site?: ProjectSite;
}

export interface CreateResourceData {
  project_id: string;
  resource_type: ResourceType;
  resource_name: string;
  description?: string;
  unit?: string;
  quantity_allocated?: number;
  unit_cost?: number;
  start_date?: string;
  end_date?: string;
  assigned_site_id?: string;
  notes?: string;
}

export type UpdateResourceData = Partial<CreateResourceData>;

// Aliases for consistency
export type CreateConstructionResourceData = CreateResourceData;
export type UpdateConstructionResourceData = UpdateResourceData;

export const RESOURCE_TYPES: { value: ResourceType; label: string }[] = [
  { value: 'labor', label: 'Labor' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'material', label: 'Material' },
  { value: 'subcontractor', label: 'Subcontractor' },
];

export const RESOURCE_STATUSES: { value: ResourceStatus; label: string; color: string }[] = [
  { value: 'planned', label: 'Planned', color: 'bg-muted text-muted-foreground' },
  { value: 'active', label: 'Active', color: 'bg-green-100 text-green-800' },
  { value: 'completed', label: 'Completed', color: 'bg-blue-100 text-blue-800' },
  { value: 'released', label: 'Released', color: 'bg-purple-100 text-purple-800' },
];

// =====================================================
// QUALITY INSPECTIONS
// =====================================================

export type QualityInspectionType = 'structural' | 'electrical' | 'plumbing' | 'finishing' | 'safety' | 'general';
export type QualityInspectionStatus = 'scheduled' | 'in_progress' | 'completed' | 'failed';
export type InspectionResult = 'pass' | 'fail' | 'conditional_pass';
export type InspectionItemResult = 'pass' | 'fail' | 'na';

export interface QualityInspection {
  id: string;
  project_id: string;
  company_id: string | null;
  inspection_number: string;
  inspection_type: QualityInspectionType;
  title: string;
  description: string | null;
  site_id: string | null;
  work_order_id: string | null;
  inspection_date: string;
  inspector_id: string | null;
  status: QualityInspectionStatus;
  overall_result: InspectionResult | null;
  findings: string | null;
  corrective_actions: string | null;
  follow_up_date: string | null;
  photos_url: string[] | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  project?: ConstructionProject;
  site?: ProjectSite;
  work_order?: WorkOrder;
  inspector?: { full_name: string };
}

export interface QualityInspectionItem {
  id: string;
  inspection_id: string;
  item_order: number | null;
  checklist_item: string;
  requirement: string | null;
  result: InspectionItemResult | null;
  measured_value: string | null;
  expected_value: string | null;
  notes: string | null;
  created_at: string;
}

export interface CreateQualityInspectionData {
  project_id: string;
  inspection_type: QualityInspectionType;
  title: string;
  description?: string;
  site_id?: string;
  work_order_id?: string;
  inspection_date: string;
  inspector_id?: string;
}

export type UpdateQualityInspectionData = Partial<CreateQualityInspectionData>;

export const QUALITY_INSPECTION_TYPES: { value: QualityInspectionType; label: string }[] = [
  { value: 'structural', label: 'Structural' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'finishing', label: 'Finishing' },
  { value: 'safety', label: 'Safety' },
  { value: 'general', label: 'General' },
];

export const QUALITY_INSPECTION_STATUSES: { value: QualityInspectionStatus; label: string; color: string }[] = [
  { value: 'scheduled', label: 'Scheduled', color: 'bg-muted text-muted-foreground' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-blue-100 text-blue-800' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-800' },
  { value: 'failed', label: 'Failed', color: 'bg-red-100 text-red-800' },
];

export const INSPECTION_RESULTS: { value: InspectionResult; label: string; color: string }[] = [
  { value: 'pass', label: 'Pass', color: 'bg-green-100 text-green-800' },
  { value: 'fail', label: 'Fail', color: 'bg-red-100 text-red-800' },
  { value: 'conditional_pass', label: 'Conditional Pass', color: 'bg-yellow-100 text-yellow-800' },
];

// =====================================================
// SAFETY INCIDENTS
// =====================================================

export type IncidentType = 'near_miss' | 'first_aid' | 'medical' | 'lost_time' | 'fatality';
export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IncidentStatus = 'reported' | 'investigating' | 'closed';

export interface SafetyIncident {
  id: string;
  project_id: string;
  company_id: string | null;
  incident_number: string;
  incident_type: IncidentType;
  severity: IncidentSeverity;
  title: string;
  description: string | null;
  site_id: string | null;
  incident_date: string;
  incident_time: string | null;
  location: string | null;
  injured_party: string | null;
  injury_description: string | null;
  immediate_actions: string | null;
  root_cause: string | null;
  corrective_actions: string | null;
  preventive_actions: string | null;
  reported_by: string | null;
  investigated_by: string | null;
  status: IncidentStatus;
  photos_url: string[] | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  project?: ConstructionProject;
  site?: ProjectSite;
  reporter?: { full_name: string };
}

export interface CreateSafetyIncidentData {
  project_id: string;
  incident_type: IncidentType;
  severity?: IncidentSeverity;
  title: string;
  description?: string;
  site_id?: string;
  incident_date: string;
  incident_time?: string;
  location?: string;
  injured_party?: string;
  injury_description?: string;
  immediate_actions?: string;
}

export type UpdateSafetyIncidentData = Partial<CreateSafetyIncidentData>;

export const INCIDENT_TYPES: { value: IncidentType; label: string }[] = [
  { value: 'near_miss', label: 'Near Miss' },
  { value: 'first_aid', label: 'First Aid' },
  { value: 'medical', label: 'Medical Treatment' },
  { value: 'lost_time', label: 'Lost Time Injury' },
  { value: 'fatality', label: 'Fatality' },
];

export const INCIDENT_SEVERITIES: { value: IncidentSeverity; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'bg-gray-100 text-gray-800' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-800' },
];

export const INCIDENT_STATUSES: { value: IncidentStatus; label: string; color: string }[] = [
  { value: 'reported', label: 'Reported', color: 'bg-blue-100 text-blue-800' },
  { value: 'investigating', label: 'Investigating', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'closed', label: 'Closed', color: 'bg-green-100 text-green-800' },
];

// =====================================================
// SAFETY INSPECTIONS
// =====================================================

export type SafetyInspectionType = 'daily' | 'weekly' | 'monthly' | 'special';
export type SafetyInspectionStatus = 'scheduled' | 'completed';

export interface SafetyInspection {
  id: string;
  project_id: string;
  company_id: string | null;
  inspection_number: string;
  inspection_type: SafetyInspectionType;
  site_id: string | null;
  inspection_date: string;
  inspector_id: string | null;
  status: SafetyInspectionStatus;
  overall_score: number | null;
  findings: string | null;
  hazards_identified: string | null;
  corrective_actions: string | null;
  follow_up_required: boolean;
  follow_up_date: string | null;
  photos_url: string[] | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  project?: ConstructionProject;
  site?: ProjectSite;
  inspector?: { full_name: string };
}

export interface CreateSafetyInspectionData {
  project_id: string;
  inspection_type: SafetyInspectionType;
  site_id?: string;
  inspection_date: string;
  inspector_id?: string;
}

export type UpdateSafetyInspectionData = Partial<CreateSafetyInspectionData>;

export const SAFETY_INSPECTION_TYPES: { value: SafetyInspectionType; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'special', label: 'Special' },
];

export const SAFETY_INSPECTION_STATUSES: { value: SafetyInspectionStatus; label: string; color: string }[] = [
  { value: 'scheduled', label: 'Scheduled', color: 'bg-muted text-muted-foreground' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-800' },
];

// =====================================================
// CONSTRUCTION DOCUMENTS
// =====================================================

export type DocumentType = 'drawing' | 'specification' | 'permit' | 'contract' | 'report' | 'photo' | 'other';
export type DocumentStatus = 'draft' | 'pending_approval' | 'approved' | 'superseded';

export interface ConstructionDocument {
  id: string;
  project_id: string;
  company_id: string | null;
  document_number: string;
  document_type: DocumentType;
  title: string;
  description: string | null;
  file_url: string;
  file_name: string | null;
  file_size: number | null;
  file_type: string | null;
  version: string;
  is_latest: boolean;
  revision_notes: string | null;
  tags: string[] | null;
  uploaded_by: string | null;
  approved_by: string | null;
  approval_date: string | null;
  status: DocumentStatus;
  created_at: string;
  updated_at: string;
  // Joined fields
  project?: ConstructionProject;
  uploader?: { full_name: string };
}

export interface CreateDocumentData {
  project_id: string;
  document_type: DocumentType;
  title: string;
  description?: string;
  file_url: string;
  file_name?: string;
  file_size?: number;
  file_type?: string;
  tags?: string[];
}

export type UpdateDocumentData = Partial<CreateDocumentData>;

// Aliases for consistency
export type CreateConstructionDocumentData = CreateDocumentData;
export type UpdateConstructionDocumentData = UpdateDocumentData;

export const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'drawing', label: 'Drawing' },
  { value: 'specification', label: 'Specification' },
  { value: 'permit', label: 'Permit' },
  { value: 'contract', label: 'Contract' },
  { value: 'report', label: 'Report' },
  { value: 'photo', label: 'Photo' },
  { value: 'other', label: 'Other' },
];

export const DOCUMENT_STATUSES: { value: DocumentStatus; label: string; color: string }[] = [
  { value: 'draft', label: 'Draft', color: 'bg-muted text-muted-foreground' },
  { value: 'pending_approval', label: 'Pending Approval', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'approved', label: 'Approved', color: 'bg-green-100 text-green-800' },
  { value: 'superseded', label: 'Superseded', color: 'bg-gray-100 text-gray-800' },
];

// =====================================================
// PROJECT BUDGET
// =====================================================

export type BudgetCategory = 'labor' | 'materials' | 'equipment' | 'subcontractor' | 'overhead' | 'contingency';
export type BudgetTransactionType = 'commitment' | 'actual' | 'adjustment';

export interface ProjectBudgetItem {
  id: string;
  project_id: string;
  company_id: string | null;
  budget_code: string;
  category: BudgetCategory;
  description: string;
  planned_amount: number;
  committed_amount: number;
  actual_amount: number;
  unit: string | null;
  quantity: number | null;
  unit_cost: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Computed
  variance?: number;
  // Joined fields
  project?: ConstructionProject;
}

export interface BudgetTransaction {
  id: string;
  budget_item_id: string;
  transaction_type: BudgetTransactionType;
  amount: number;
  transaction_date: string;
  reference_number: string | null;
  vendor: string | null;
  description: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CreateBudgetItemData {
  project_id: string;
  budget_code: string;
  category: BudgetCategory;
  description: string;
  planned_amount: number;
  unit?: string;
  quantity?: number;
  unit_cost?: number;
  notes?: string;
}

export type UpdateBudgetItemData = Partial<CreateBudgetItemData>;

// Aliases for consistency
export type CreateProjectBudgetItemData = CreateBudgetItemData;
export type UpdateProjectBudgetItemData = UpdateBudgetItemData;

export interface CreateBudgetTransactionData {
  budget_item_id: string;
  transaction_type: BudgetTransactionType;
  amount: number;
  transaction_date: string;
  reference_number?: string;
  vendor?: string;
  description?: string;
}

export const BUDGET_CATEGORIES: { value: BudgetCategory; label: string }[] = [
  { value: 'labor', label: 'Labor' },
  { value: 'materials', label: 'Materials' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'subcontractor', label: 'Subcontractor' },
  { value: 'overhead', label: 'Overhead' },
  { value: 'contingency', label: 'Contingency' },
];

export const BUDGET_TRANSACTION_TYPES: { value: BudgetTransactionType; label: string; color: string }[] = [
  { value: 'commitment', label: 'Commitment', color: 'bg-blue-100 text-blue-800' },
  { value: 'actual', label: 'Actual', color: 'bg-green-100 text-green-800' },
  { value: 'adjustment', label: 'Adjustment', color: 'bg-yellow-100 text-yellow-800' },
];

// =====================================================
// CONSTRUCTION MASTER LISTS
// =====================================================

export interface LabourMaster {
  id: string;
  company_id: string | null;
  employee_id: string | null;
  epf_no: string | null;
  name: string;
  trade: string | null;
  category: string | null;
  labour_company: string | null;
  skill_level: string | null;
  contact_number: string | null;
  email: string | null;
  hourly_rate: number | null;
  daily_rate: number | null;
  status: string;
  notes: string | null;
  project_id: string | null;
  location_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateLabourMasterData {
  name: string;
  epf_no?: string;
  trade?: string;
  category?: string;
  labour_company?: string;
  skill_level?: string;
  contact_number?: string;
  email?: string;
  hourly_rate?: number;
  daily_rate?: number;
  status?: string;
  notes?: string;
  project_id?: string | null;
  location_id?: string | null;
}

export type UpdateLabourMasterData = Partial<CreateLabourMasterData>;

export interface LabourCategory {
  id: string;
  company_id: string | null;
  name: string;
  description: string | null;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LabourCompany {
  id: string;
  company_id: string | null;
  name: string;
  description: string | null;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryMaster {
  id: string;
  company_id: string | null;
  item_code: string | null;
  item_name: string;
  section: string | null;
  category: string | null;
  unit: string | null;
  unit_cost: number | null;
  description: string | null;
  status: string;
  notes: string | null;
  image_url: string | null;
  quantity: number;
  location_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined field for location name
  warehouse_location?: { id: string; name: string };
}

export interface CreateInventoryMasterData {
  item_name: string;
  section: string;
  category: string;
  quantity: number;
  location_id: string;
  unit?: string;
  unit_cost?: number;
  description?: string;
  status?: string;
  notes?: string;
  image_url?: string;
}

export type UpdateInventoryMasterData = Partial<CreateInventoryMasterData>;

export interface SubcontractorMaster {
  id: string;
  company_id: string | null;
  name: string;
  trade: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  license_number: string | null;
  insurance_expiry: string | null;
  status: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSubcontractorMasterData {
  name: string;
  trade?: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  license_number?: string;
  insurance_expiry?: string;
  status?: string;
  notes?: string;
}

export type UpdateSubcontractorMasterData = Partial<CreateSubcontractorMasterData>;

// Labour Attendance Types
export type LabourAttendanceStatus = 'present' | 'absent' | 'half_day' | 'leave';

export interface LabourAttendance {
  id: string;
  site_report_id: string;
  labour_id: string;
  location_id: string | null;
  company_id: string | null;
  attendance_date: string;
  attendance_status: LabourAttendanceStatus;
  in_time: string | null;
  out_time: string | null;
  category: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  labour?: LabourMaster;
}

export interface CreateLabourAttendanceData {
  site_report_id: string;
  labour_id: string;
  location_id?: string | null;
  attendance_date: string;
  attendance_status?: LabourAttendanceStatus;
  in_time?: string | null;
  out_time?: string | null;
  category?: string | null;
  notes?: string | null;
}

export type UpdateLabourAttendanceData = Partial<CreateLabourAttendanceData>;
