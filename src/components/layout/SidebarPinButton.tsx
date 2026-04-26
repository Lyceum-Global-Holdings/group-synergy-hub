import { Pin, PinOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTogglePin } from "@/hooks/useSidebarPins";

interface SidebarPinButtonProps {
  isPinned: boolean;
  disabled?: boolean;
  disabledReason?: string;
  companyId: string | undefined;
  moduleKey: string;
  submoduleKey: string;
  submoduleUrl: string;
  submoduleTitle: string;
  /** When true, button is always visible (used in pinned section). */
  alwaysVisible?: boolean;
}

export function SidebarPinButton({
  isPinned,
  disabled,
  disabledReason,
  companyId,
  moduleKey,
  submoduleKey,
  submoduleUrl,
  submoduleTitle,
  alwaysVisible,
}: SidebarPinButtonProps) {
  const toggle = useTogglePin();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || !companyId) return;
    toggle.mutate({
      companyId,
      moduleKey,
      submoduleKey,
      submoduleUrl,
      submoduleTitle,
    });
  };

  const Icon = isPinned ? PinOff : Pin;

  const button = (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || toggle.isPending}
      aria-label={isPinned ? `Unpin ${submoduleTitle}` : `Pin ${submoduleTitle}`}
      className={cn(
        "ml-auto inline-flex h-5 w-5 items-center justify-center rounded-sm transition-opacity",
        "text-sidebar-muted hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/60",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        isPinned || alwaysVisible
          ? "opacity-100"
          : "opacity-0 group-hover/pin-row:opacity-100 focus-visible:opacity-100"
      )}
    >
      <Icon className={cn("h-3 w-3", isPinned && "fill-current")} />
    </button>
  );

  if (disabled && disabledReason) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span>{button}</span>
        </TooltipTrigger>
        <TooltipContent side="right">{disabledReason}</TooltipContent>
      </Tooltip>
    );
  }

  return button;
}
