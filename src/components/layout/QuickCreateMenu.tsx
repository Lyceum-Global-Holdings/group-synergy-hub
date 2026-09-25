import { Link } from "react-router-dom";
import { ArrowLeftRight, ClipboardList, FileText, PackageCheck, Plus, ScanLine, ShoppingCart, type LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAccessibleNav } from "./useAccessibleNav";

interface CreateAction {
  module: string;
  submodule: string;
  label: string;
  hint: string;
  url: string;
  icon: LucideIcon;
}

// Each target page opens its create dialog from ?new=… (useOpenFromQuery).
const ACTIONS: CreateAction[] = [
  { module: "procurement", submodule: "purchase-requisition", label: "Purchase requisition", hint: "Request items to buy", url: "/procurement/purchase-requisition?new=1", icon: FileText },
  { module: "procurement", submodule: "purchase-order", label: "Purchase order", hint: "Order from a supplier", url: "/procurement/purchase-order?new=1", icon: ShoppingCart },
  { module: "warehouse", submodule: "grn", label: "Goods receipt (GRN)", hint: "Receive delivered goods", url: "/warehouse/grn?new=1", icon: PackageCheck },
  { module: "warehouse", submodule: "material-issue", label: "Material request", hint: "Request stock for a job", url: "/warehouse/material-issue?new=request", icon: ClipboardList },
  { module: "warehouse", submodule: "stock-transfer", label: "Stock transfer", hint: "Move stock between locations", url: "/warehouse/stock-transfer?new=1", icon: ArrowLeftRight },
];

/** Round "+" in the header: create the everyday documents from anywhere. */
export function QuickCreateMenu() {
  const nav = useAccessibleNav();
  const actions = ACTIONS.filter((a) => nav.canOpen(a.module, a.submodule));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Create new"
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-lg shadow-primary/25 transition hover:brightness-110",
          "bg-[linear-gradient(145deg,hsl(213_94%_46%),hsl(224_85%_30%))]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        )}
      >
        <Plus className="h-5 w-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64 rounded-2xl p-1.5">
        {actions.length > 0 && (
          <>
            <DropdownMenuLabel className="px-2 text-[11px] font-semibold text-muted-foreground">Create new</DropdownMenuLabel>
            {actions.map((a) => (
              <DropdownMenuItem key={a.url} asChild className="rounded-xl px-2 py-2">
                <Link to={a.url}>
                  <span className="mr-2.5 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <a.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{a.label}</span>
                    <span className="block text-[11px] text-muted-foreground">{a.hint}</span>
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem asChild className="rounded-xl px-2 py-2">
          <a href="/scanner/">
            <span className="mr-2.5 flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-foreground">
              <ScanLine className="h-4 w-4" />
            </span>
            <span className="text-sm font-medium">Open scanner</span>
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
