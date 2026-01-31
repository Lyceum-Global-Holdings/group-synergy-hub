import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, Plus, Pencil, Trash2, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ModuleOperation } from '@/types/moduleAccess';
import { OPERATIONS, OPERATION_LABELS } from '@/constants/rbacConfig';

const OPERATION_ICONS: Record<ModuleOperation, React.ComponentType<{ className?: string }>> = {
  view: Eye,
  add: Plus,
  edit: Pencil,
  delete: Trash2,
  download: Download,
};

interface OperationCheckboxesProps {
  selectedOperations: ModuleOperation[];
  onOperationsChange: (operations: ModuleOperation[]) => void;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
}

export const OperationCheckboxes: React.FC<OperationCheckboxesProps> = ({
  selectedOperations,
  onOperationsChange,
  disabled = false,
  compact = false,
  className,
}) => {
  const handleOperationToggle = (operation: ModuleOperation, checked: boolean) => {
    if (checked) {
      // When adding an operation, ensure 'view' is always included
      const newOps = [...selectedOperations, operation];
      if (!newOps.includes('view')) {
        newOps.push('view');
      }
      onOperationsChange([...new Set(newOps)]);
    } else {
      // Don't allow removing 'view' if other operations are selected
      if (operation === 'view' && selectedOperations.length > 1) {
        return;
      }
      onOperationsChange(selectedOperations.filter(op => op !== operation));
    }
  };

  return (
    <div className={cn(
      "flex flex-wrap gap-2",
      compact ? "gap-1" : "gap-2",
      className
    )}>
      {OPERATIONS.map((operation) => {
        const Icon = OPERATION_ICONS[operation];
        const isChecked = selectedOperations.includes(operation);
        const isViewLocked = operation === 'view' && selectedOperations.length > 1;

        return (
          <label
            key={operation}
            className={cn(
              "flex items-center gap-1 cursor-pointer select-none",
              compact ? "text-xs" : "text-sm",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <Checkbox
              checked={isChecked}
              onCheckedChange={(checked) => handleOperationToggle(operation, !!checked)}
              disabled={disabled || isViewLocked}
              className={cn(compact ? "h-3 w-3" : "h-4 w-4")}
            />
            <Icon className={cn(
              "text-muted-foreground",
              compact ? "h-3 w-3" : "h-3.5 w-3.5",
              isChecked && "text-primary"
            )} />
            {!compact && (
              <span className="text-muted-foreground">{OPERATION_LABELS[operation]}</span>
            )}
          </label>
        );
      })}
    </div>
  );
};

// Simplified inline version for tables/lists
interface OperationBadgesProps {
  operations: ModuleOperation[];
  className?: string;
}

export const OperationBadges: React.FC<OperationBadgesProps> = ({
  operations,
  className,
}) => {
  return (
    <div className={cn("flex gap-1", className)}>
      {operations.map((operation) => {
        const Icon = OPERATION_ICONS[operation];
        return (
          <div
            key={operation}
            className="flex items-center justify-center w-5 h-5 rounded bg-muted"
            title={OPERATION_LABELS[operation]}
          >
            <Icon className="h-3 w-3 text-muted-foreground" />
          </div>
        );
      })}
    </div>
  );
};
