export type ModuleOperation = 'view' | 'add' | 'edit' | 'delete' | 'download';

export interface RoleModule {
  id: string;
  role_id: string;
  module_key: string;
  submodules: string[];
  operations: ModuleOperation[];
  created_at: string;
  updated_at: string;
}

export interface UserModule {
  id: string;
  user_id: string;
  module_key: string;
  submodules: string[];
  operations: ModuleOperation[];
  access_type: 'grant' | 'deny';
  created_at: string;
  updated_at: string;
}

export interface UserModuleAccess {
  availableModules: string[];
  deniedModules: string[];
  moduleSubModules: Record<string, string[]>;
  moduleOperations: Record<string, ModuleOperation[]>;
}

export interface RoleModuleData {
  modules: Record<string, string[]>; // { "warehouse": ["stock-transfer", "cycle-count"], ... }
  operations?: Record<string, ModuleOperation[]>; // { "warehouse": ["view", "add", "edit"], ... }
}

// ============================================
// SAP INTEGRATION TYPES
// ============================================

export type SAPSyncStatus = 'pending' | 'syncing' | 'synced' | 'error' | 'skipped';

export interface SAPEntityMapping {
  id: string;
  company_id: string;
  entity_type: string;
  local_id: string;
  sap_code: string;
  sap_description?: string;
  mapping_metadata?: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SAPSyncLog {
  id: string;
  company_id: string;
  entity_type: string;
  entity_id: string;
  sync_direction: 'to_sap' | 'from_sap';
  sync_status: SAPSyncStatus;
  sap_document_number?: string;
  error_message?: string;
  request_payload?: Record<string, unknown>;
  response_payload?: Record<string, unknown>;
  synced_by?: string;
  synced_at: string;
  created_at: string;
}

export interface SAPConfiguration {
  id: string;
  company_id: string;
  sap_system_id: string;
  sap_client: string;
  sap_base_url: string;
  is_active: boolean;
  sync_enabled: boolean;
  auto_sync: boolean;
  sync_interval_minutes?: number;
  last_sync_at?: string;
  created_at: string;
  updated_at: string;
}

// SAP Syncable Entity interface - for entities that can sync with SAP
export interface SAPSyncable {
  sap_document_number?: string;
  sap_sync_status?: SAPSyncStatus;
  sap_last_sync_at?: string;
}

// Supplier with SAP fields
export interface SAPSupplier extends SAPSyncable {
  sap_vendor_code?: string;
}

// Customer with SAP fields
export interface SAPCustomer extends SAPSyncable {
  sap_customer_code?: string;
}
