import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronRight, GripVertical, Pin } from "lucide-react";
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
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useReorderPins, type PinnedSubmodule } from "@/hooks/useSidebarPins";
import { moduleConfig } from "@/constants/moduleConfig";
import { useCompany } from "@/contexts/CompanyContext";
import { navPreloadProps } from "@/lib/navPreload";
import { leafClass, rowClass } from "./sidebarPrimitives";

interface PinnedGroupProps {
  /** Pins for the active scope (specific company or union for "all"). */
  pins: PinnedSubmodule[];
  /** When true, reordering is disabled (e.g. "All Companies" mode). */
  reorderDisabled?: boolean;
  /** When true, show a small company-code badge next to each pin. */
  showCompanyBadge?: boolean;
  /** Called after a pin is followed (closes the mobile drawer). */
  onNavigate?: () => void;
}

/** "Pinned" branch at the top of the sidebar — the app's equivalent of Starred. */
export function PinnedSubmodulesGroup({
  pins,
  reorderDisabled = false,
  showCompanyBadge = false,
  onNavigate,
}: PinnedGroupProps) {
  const location = useLocation();
  const reorder = useReorderPins();
  const { companies } = useCompany();
  const [open, setOpen] = useState(true);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

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
    reorder.mutate({ companyId: pins[0].company_id, orderedIds: next.map((p) => p.id) });
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-0.5">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={rowClass(false)}>
        <Pin className="h-[18px] w-[18px] shrink-0" />
        <span className="flex-1 text-left">Pinned</span>
        <span className="text-[11px] font-medium text-sidebar-muted">{pins.length}</span>
        <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 text-sidebar-muted transition-transform duration-200", open && "rotate-90")} />
      </button>
      <CollapsibleContent>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={pins.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <ul className="ml-[19px] mt-0.5 pb-1">
              {pins.map((pin, idx) => (
                <SortablePinRow
                  key={pin.id}
                  pin={pin}
                  last={idx === pins.length - 1}
                  active={location.pathname === pin.submodule_url}
                  reorderDisabled={reorderDisabled}
                  onNavigate={onNavigate}
                  companyCode={
                    showCompanyBadge ? companies.find((c) => c.id === pin.company_id)?.code : undefined
                  }
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface SortablePinRowProps {
  pin: PinnedSubmodule;
  last: boolean;
  active: boolean;
  reorderDisabled: boolean;
  companyCode?: string;
  onNavigate?: () => void;
}

function SortablePinRow({ pin, last, active, reorderDisabled, companyCode, onNavigate }: SortablePinRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: pin.id,
    disabled: reorderDisabled,
  });

  const ModuleIcon = moduleConfig[pin.module_key]?.icon ?? Pin;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <li ref={setNodeRef} style={style} className="group/pin-row relative pl-4">
      {/* tree guide — same geometry as TreeItem */}
      <span aria-hidden className="pointer-events-none absolute left-0 top-0 h-4 w-3 rounded-bl-lg border-b border-l border-sidebar-border" />
      {!last && <span aria-hidden className="pointer-events-none absolute bottom-0 left-0 top-4 border-l border-sidebar-border" />}
      <div className="flex items-center gap-1">
        <NavLink
          to={pin.submodule_url}
          onClick={onNavigate}
          className={cn(leafClass(active), "gap-2")}
          aria-current={active ? "page" : undefined}
          {...navPreloadProps(pin.submodule_url)}
        >
          <ModuleIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
          <span className="min-w-0 flex-1 truncate">{pin.submodule_title}</span>
          {companyCode && (
            <span className="shrink-0 rounded-md border border-sidebar-border px-1 text-[9px] font-medium text-sidebar-muted">
              {companyCode}
            </span>
          )}
        </NavLink>
        {!reorderDisabled && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Drag to reorder ${pin.submodule_title}`}
            className="inline-flex h-6 w-5 shrink-0 cursor-grab items-center justify-center rounded text-sidebar-muted opacity-0 transition-opacity hover:text-sidebar-accent-foreground focus-visible:opacity-100 active:cursor-grabbing group-hover/pin-row:opacity-100"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </li>
  );
}
