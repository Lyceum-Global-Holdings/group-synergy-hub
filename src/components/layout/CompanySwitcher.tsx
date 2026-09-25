import { useState } from "react";
import { Building2, Check, ChevronsUpDown, Layers } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useCompany } from "@/contexts/CompanyContext";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { cn } from "@/lib/utils";

/** Initials for the company tile, e.g. "LNPE (Pvt) Ltd" → "LN". */
function initials(name?: string | null) {
  if (!name) return "LG";
  const words = name.replace(/[()]/g, " ").split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? words[0]?.[1] ?? "")).toUpperCase();
}

/**
 * Workspace-style company switcher at the top of the sidebar. Replaces the
 * header company dropdown; same rules — "All Companies" is super-admin only,
 * and a single-company user sees a static label.
 */
export function CompanySwitcher({ moduleCount }: { moduleCount: number }) {
  const { selectedCompany, setSelectedCompany, companies, isViewingAllCompanies } = useCompany();
  const { data: isSuperAdmin } = useSuperAdmin();
  const [open, setOpen] = useState(false);

  const canSwitch = companies.length > 1 || !!isSuperAdmin;
  const title = isViewingAllCompanies ? "All Companies" : selectedCompany?.name ?? "Select company";
  const subtitle = isViewingAllCompanies
    ? `${companies.length} companies · ${moduleCount} modules`
    : `${selectedCompany?.code ?? ""}${selectedCompany?.code ? " · " : ""}${moduleCount} modules`;

  const tile = (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white shadow-sm",
        "bg-[linear-gradient(145deg,hsl(213_94%_46%),hsl(224_85%_30%))]",
      )}
      aria-hidden
    >
      {isViewingAllCompanies ? <Layers className="h-4 w-4" /> : initials(selectedCompany?.name)}
    </span>
  );

  const label = (
    <span className="min-w-0 flex-1 text-left">
      <span className="block truncate text-sm font-semibold text-sidebar-accent-foreground">{title}</span>
      <span className="block truncate text-[11px] text-sidebar-muted">{subtitle}</span>
    </span>
  );

  if (!canSwitch) {
    return <div className="flex items-center gap-2.5 rounded-2xl px-2 py-2">{tile}{label}</div>;
  }

  const select = (id: string | null) => {
    setSelectedCompany(id ? companies.find((c) => c.id === id) ?? null : null);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Switch company (current: ${title})`}
          className="flex w-full items-center gap-2.5 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          {tile}
          {label}
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-sidebar-muted" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-[--radix-popover-trigger-width] min-w-[260px] rounded-2xl p-0">
        <Command>
          <CommandInput placeholder="Search companies…" />
          <CommandList className="max-h-[320px]">
            <CommandEmpty>No company found.</CommandEmpty>
            {isSuperAdmin && (
              <CommandGroup>
                <CommandItem value="all companies" onSelect={() => select(null)}>
                  <Layers className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 font-medium">All Companies</span>
                  {isViewingAllCompanies && <Check className="h-4 w-4 text-primary" />}
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup heading="Companies">
              {companies.map((c) => {
                const active = !isViewingAllCompanies && selectedCompany?.id === c.id;
                return (
                  <CommandItem key={c.id} value={`${c.name} ${c.code ?? ""} ${c.id}`} onSelect={() => select(c.id)}>
                    <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{c.name}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {c.code}
                        {c.status && c.status !== "active" ? ` · ${c.status}` : ""}
                      </span>
                    </span>
                    {active && <Check className="h-4 w-4 text-primary" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
