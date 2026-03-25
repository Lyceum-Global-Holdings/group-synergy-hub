import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";

interface QuickAction {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  variant?: "default" | "outline" | "secondary";
}

interface QuickActionsProps {
  title?: string;
  actions: QuickAction[];
}

export function QuickActions({ title = "Quick Actions", actions }: QuickActionsProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {title}
      </h3>
      <div className="flex flex-wrap gap-2">
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <Button
              key={index}
              variant={action.variant || "outline"}
              size="sm"
              onClick={action.onClick}
              className="gap-2"
            >
              <Icon className="h-4 w-4" />
              {action.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}