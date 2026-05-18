import { NavLink, useLocation } from "react-router-dom";
import { GripVertical, Pin } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useReorderPins, type PinnedSubmodule } from "@/hooks/useSidebarPins";
import { moduleConfig } from "@/constants/moduleConfig";
import { useCompany } from "@/contexts/CompanyContext";
import { navPreloadProps } from "@/lib/navPreload";

interface PinnedGroupProps {
  /** Pins for the active scope (specific company or union for "all"). */
  pins: PinnedSubmodule[];
  /** When true, reordering is disabled (e.g. "All Companies" mode). */
  reorderDisabled?: boolean;
  /** When true, show a small company-code badge next to each pin. */
  showCompanyBadge?: boolean;
}

export function PinnedSubmodulesGroup({
  pins,
  reorderDisabled = false,
  showCompanyBadge = false,
}: PinnedGroupProps) {
  const location = useLocation();
  const reorder = useReorderPins();
  const { companies } = useCompany();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  if (pins.length === 0) return null;

  const handleDragEnd = (e: DragEndEvent) => {
    if (reorderDisabled) return;
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = pins.findIndex((p) => p.id === active.id);
    const newIndex = pins.findIndex((p) => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(pins, oldIndex, newIndex);
    // All pins in this group share the same company_id when reorder is enabled
    reorder.mutate({
      companyId: pins[0].company_id,
      orderedIds: next.map((p) => p.id),
    });
  };

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.1em] font-semibold text-sidebar-muted px-4 flex items-center gap-1.5">
        <Pin className="h-3 w-3" />
        Pinned
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={pins.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              {pins.map((pin) => (
                <SortablePinRow
                  key={pin.id}
                  pin={pin}
                  active={location.pathname === pin.submodule_url}
                  reorderDisabled={reorderDisabled}
                  companyCode={
                    showCompanyBadge
                      ? companies.find((c) => c.id === pin.company_id)?.code
                      : undefined
                  }
                />
              ))}
            </SortableContext>
          </DndContext>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

interface SortablePinRowProps {
  pin: PinnedSubmodule;
  active: boolean;
  reorderDisabled: boolean;
  companyCode?: string;
}

function SortablePinRow({ pin, active, reorderDisabled, companyCode }: SortablePinRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: pin.id, disabled: reorderDisabled });

  const ModuleIcon = moduleConfig[pin.module_key]?.icon ?? Pin;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <SidebarMenuItem
      ref={setNodeRef}
      style={style}
      className="group/pin-row"
    >
      <SidebarMenuButton
        asChild
        isActive={active}
        className={cn(
          active
            ? "border-l-[3px] border-l-sidebar-primary bg-sidebar-accent/60 text-sidebar-accent-foreground font-medium"
            : "border-l-[3px] border-l-transparent"
        )}
      >
        <NavLink to={pin.submodule_url} className="flex items-center gap-2">
          <ModuleIcon className="h-[18px] w-[18px] shrink-0" />
          <span className="truncate text-sm flex-1">{pin.submodule_title}</span>
          {companyCode && (
            <Badge
              variant="outline"
              className="text-[9px] px-1 py-0 h-4 border-sidebar-border text-sidebar-muted"
            >
              {companyCode}
            </Badge>
          )}
          {!reorderDisabled && (
            <button
              type="button"
              {...attributes}
              {...listeners}
              onClick={(e) => e.preventDefault()}
              aria-label="Drag to reorder"
              className="ml-1 opacity-0 group-hover/pin-row:opacity-100 cursor-grab active:cursor-grabbing text-sidebar-muted hover:text-sidebar-accent-foreground"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
          )}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
