import React from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Lock, Plus, Ban } from "lucide-react";
import { moduleConfig } from "@/constants/moduleConfig";
import { cn } from "@/lib/utils";

export interface ModuleAccessState {
  // From role - read only
  inheritedModules: Record<string, string[]>;
  // User-specific grants
  grantedSubmodules: Record<string, string[]>;
  // User-specific denials
  deniedSubmodules: Record<string, string[]>;
}

interface ModuleAccessEditorProps {
  state: ModuleAccessState;
  onGrantChange: (moduleKey: string, submoduleKey: string, granted: boolean) => void;
  onDenyChange: (moduleKey: string, submoduleKey: string, denied: boolean) => void;
  disabled?: boolean;
}

export const ModuleAccessEditor: React.FC<ModuleAccessEditorProps> = ({
  state,
  onGrantChange,
  onDenyChange,
  disabled = false,
}) => {
  const [openModules, setOpenModules] = React.useState<Record<string, boolean>>({});

  const toggleModule = (moduleKey: string) => {
    setOpenModules(prev => ({ ...prev, [moduleKey]: !prev[moduleKey] }));
  };

  const getSubmoduleStatus = (moduleKey: string, submoduleKey: string): 'inherited' | 'granted' | 'denied' | 'none' => {
    if (state.deniedSubmodules[moduleKey]?.includes(submoduleKey)) return 'denied';
    if (state.grantedSubmodules[moduleKey]?.includes(submoduleKey)) return 'granted';
    if (state.inheritedModules[moduleKey]?.includes(submoduleKey)) return 'inherited';
    return 'none';
  };

  const getModuleSummary = (moduleKey: string) => {
    const config = moduleConfig[moduleKey];
    if (!config) return { inherited: 0, granted: 0, denied: 0, total: 0 };
    
    const inherited = state.inheritedModules[moduleKey]?.length || 0;
    const granted = state.grantedSubmodules[moduleKey]?.length || 0;
    const denied = state.deniedSubmodules[moduleKey]?.length || 0;
    
    return { inherited, granted, denied, total: config.subModules.length };
  };

  return (
    <div className="space-y-2 border rounded-lg p-3 bg-muted/20">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
        <div className="flex items-center gap-1">
          <Lock className="h-3 w-3" />
          <span>Inherited</span>
        </div>
        <div className="flex items-center gap-1">
          <Plus className="h-3 w-3 text-green-600" />
          <span>Granted</span>
        </div>
        <div className="flex items-center gap-1">
          <Ban className="h-3 w-3 text-destructive" />
          <span>Denied</span>
        </div>
      </div>

      {Object.entries(moduleConfig).map(([moduleKey, config]) => {
        const summary = getModuleSummary(moduleKey);
        const isOpen = openModules[moduleKey] ?? false;
        const hasAccess = summary.inherited > 0 || summary.granted > 0;
        const hasDenied = summary.denied > 0;

        return (
          <Collapsible key={moduleKey} open={isOpen} onOpenChange={() => toggleModule(moduleKey)}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-md hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
                <config.icon className="h-4 w-4" />
                <span className="text-sm font-medium">{config.name}</span>
              </div>
              <div className="flex items-center gap-1">
                {summary.inherited > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {summary.inherited} inherited
                  </Badge>
                )}
                {summary.granted > 0 && (
                  <Badge variant="default" className="text-xs bg-green-600">
                    +{summary.granted}
                  </Badge>
                )}
                {summary.denied > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    -{summary.denied}
                  </Badge>
                )}
                {!hasAccess && !hasDenied && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    No access
                  </Badge>
                )}
              </div>
            </CollapsibleTrigger>
            
            <CollapsibleContent className="pl-8 pr-2 pb-2">
              <div className="space-y-1 mt-2">
                {config.subModules.map(subModule => {
                  const status = getSubmoduleStatus(moduleKey, subModule.key);
                  const isInherited = status === 'inherited';
                  const isGranted = status === 'granted';
                  const isDenied = status === 'denied';

                  return (
                    <div
                      key={subModule.key}
                      className={cn(
                        "flex items-center justify-between py-1.5 px-2 rounded-md text-sm",
                        isInherited && "bg-muted/40",
                        isGranted && "bg-green-500/10",
                        isDenied && "bg-destructive/10 line-through text-muted-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2 flex-1">
                        {isInherited && <Lock className="h-3 w-3 text-muted-foreground" />}
                        {isGranted && <Plus className="h-3 w-3 text-green-600" />}
                        {isDenied && <Ban className="h-3 w-3 text-destructive" />}
                        <span className="text-xs">{subModule.name}</span>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        {/* Grant checkbox - only show if not inherited */}
                        {!isInherited && (
                          <label className="flex items-center gap-1 cursor-pointer">
                            <Checkbox
                              checked={isGranted}
                              onCheckedChange={(checked) => onGrantChange(moduleKey, subModule.key, !!checked)}
                              disabled={disabled}
                              className="h-3.5 w-3.5"
                            />
                            <span className="text-xs text-muted-foreground">Grant</span>
                          </label>
                        )}
                        
                        {/* Deny checkbox - can deny even inherited */}
                        <label className="flex items-center gap-1 cursor-pointer">
                          <Checkbox
                            checked={isDenied}
                            onCheckedChange={(checked) => onDenyChange(moduleKey, subModule.key, !!checked)}
                            disabled={disabled}
                            className="h-3.5 w-3.5"
                          />
                          <span className="text-xs text-muted-foreground">Deny</span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
};
