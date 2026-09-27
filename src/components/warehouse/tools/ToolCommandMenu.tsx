import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAccessibleNav } from "@/components/layout/useAccessibleNav";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut,
} from "@/components/ui/command";
import {
  Plus, PackagePlus, FileSpreadsheet, ArrowRightLeft, RotateCcw, Layers,
  Boxes, ArrowUpDown, AlertTriangle, Gauge, Wrench, FileBarChart, DollarSign,
} from "lucide-react";

export interface ToolCommandActions {
  onAddTool: () => void;
  onImportItemMaster: () => void;
  onBulkImport: () => void;
  onIssue: () => void;
  onBulkIssue: () => void;
  onReturn: () => void;
  onBulkReturn: () => void;
  onGoTab: (tab: string) => void;
}

interface Props extends ToolCommandActions {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

/** ⌘K command palette — makes every tool-management function discoverable + searchable. */
export function ToolCommandMenu({ open, onOpenChange, ...a }: Props) {
  const navigate = useNavigate();
  const canOpenReports = useAccessibleNav().canOpenPath("/management/reports");

  // Global ⌘K / Ctrl+K to open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const run = (fn: () => void) => { onOpenChange(false); fn(); };
  const report = (code: string) => run(() => navigate(`/management/reports?template=${code}`));

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search tool actions, reports, tabs…" />
      <CommandList>
        <CommandEmpty>No matching action.</CommandEmpty>

        <CommandGroup heading="Create">
          <CommandItem onSelect={() => run(a.onAddTool)}><Plus className="mr-2 h-4 w-4" /> Add single tool</CommandItem>
          <CommandItem onSelect={() => run(a.onImportItemMaster)}><PackagePlus className="mr-2 h-4 w-4" /> Import from Item Master</CommandItem>
          <CommandItem onSelect={() => run(a.onBulkImport)}><FileSpreadsheet className="mr-2 h-4 w-4" /> Bulk import from CSV</CommandItem>
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Issue & Return">
          <CommandItem onSelect={() => run(a.onIssue)}><ArrowRightLeft className="mr-2 h-4 w-4" /> Issue a tool</CommandItem>
          <CommandItem onSelect={() => run(a.onBulkIssue)}><Layers className="mr-2 h-4 w-4" /> Bulk issue</CommandItem>
          <CommandItem onSelect={() => run(a.onReturn)}><RotateCcw className="mr-2 h-4 w-4" /> Return a tool</CommandItem>
          <CommandItem onSelect={() => run(a.onBulkReturn)}><Layers className="mr-2 h-4 w-4" /> Bulk return</CommandItem>
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading="Go to">
          <CommandItem onSelect={() => run(() => a.onGoTab("inventory"))}><Boxes className="mr-2 h-4 w-4" /> Tools inventory
            <CommandShortcut>manage units · QR</CommandShortcut></CommandItem>
          <CommandItem onSelect={() => run(() => a.onGoTab("issues"))}><ArrowUpDown className="mr-2 h-4 w-4" /> Tool issues</CommandItem>
          <CommandItem onSelect={() => run(() => a.onGoTab("returns"))}><RotateCcw className="mr-2 h-4 w-4" /> Returns</CommandItem>
          <CommandItem onSelect={() => run(() => a.onGoTab("overdue"))}><AlertTriangle className="mr-2 h-4 w-4" /> Overdue</CommandItem>
          <CommandItem onSelect={() => run(() => a.onGoTab("due"))}><Gauge className="mr-2 h-4 w-4" /> Due &amp; alerts (calibration / maintenance)</CommandItem>
        </CommandGroup>

        {canOpenReports && <CommandSeparator />}
        {canOpenReports && <CommandGroup heading="Reports">
          <CommandItem onSelect={() => report("WH-TOOL-LED-001")}><FileBarChart className="mr-2 h-4 w-4" /> Tool ledger (issue / return)</CommandItem>
          <CommandItem onSelect={() => report("WH-TOOL-CAL-DUE-001")}><Gauge className="mr-2 h-4 w-4" /> Calibration due</CommandItem>
          <CommandItem onSelect={() => report("WH-TOOL-CAL-HIST-001")}><Gauge className="mr-2 h-4 w-4" /> Calibration history</CommandItem>
          <CommandItem onSelect={() => report("WH-TOOL-MAINT-DUE-001")}><Wrench className="mr-2 h-4 w-4" /> Maintenance due</CommandItem>
          <CommandItem onSelect={() => report("WH-TOOL-MAINT-HIST-001")}><Wrench className="mr-2 h-4 w-4" /> Maintenance history</CommandItem>
          <CommandItem onSelect={() => report("WH-TOOL-COST-001")}><DollarSign className="mr-2 h-4 w-4" /> Tool cost (calibration + maintenance)</CommandItem>
        </CommandGroup>}
      </CommandList>
    </CommandDialog>
  );
}
