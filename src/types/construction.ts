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
