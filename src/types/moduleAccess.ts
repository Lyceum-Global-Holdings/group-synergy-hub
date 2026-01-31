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
