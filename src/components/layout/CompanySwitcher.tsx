import { useState } from "react";
import { Building2, Check, ChevronDown, ChevronsUpDown, Layers } from "lucide-react";
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
 * Company selection shared by the header pill and the sidebar switcher.
 * Rules: "All Companies" is super-admin only; a single-company user can't switch.
 */
function useCompanyPicker() {
  const { selectedCompany, setSelectedCompany, companies, isViewingAllCompanies } = useCompany();
  const { data: isSuperAdmin } = useSuperAdmin();
  return {
    selectedCompany,
    companies,
    isViewingAllCompanies,
    isSuperAdmin: !!isSuperAdmin,
    canSwitch: companies.length > 1 || !!isSuperAdmin,
    title: isViewingAllCompanies ? "All Companies" : selectedCompany?.name ?? "Select company",
    select: (id: string | null) => setSelectedCompany(id ? companies.find((c) => c.id === id) ?? null : null),
  };
}

function CompanyList({ onDone }: { onDone: () => void }) {
  const p = useCompanyPicker();
  const pick = (id: string | null) => {
    p.select(id);
    onDone();
  };
  return (
    <Command>
      <CommandInput placeholder="Search companies…" />
      <CommandList className="max-h-[320px]">
        <CommandEmpty>No company found.</CommandEmpty>
        {p.isSuperAdmin && (
          <CommandGroup>
            <CommandItem value="all companies" onSelect={() => pick(null)}>
              <Layers className="mr-2 h-4 w-4 text-muted-foreground" />
              <span className="flex-1 font-medium">All Companies</span>
              {p.isViewingAllCompanies && <Check className="h-4 w-4 text-primary" />}
            </CommandItem>
          </CommandGroup>
        )}
        <CommandGroup heading="Companies">
          {p.companies.map((c) => {
            const active = !p.isViewingAllCompanies && p.selectedCompany?.id === c.id;
            return (
              <CommandItem key={c.id} value={`${c.name} ${c.code ?? ""} ${c.id}`} onSelect={() => pick(c.id)}>
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
  );
}

/** Header pill — sits before the location pill, as the company selector always has. */
export function CompanySelector({ triggerClassName }: { triggerClassName?: string }) {
  const p = useCompanyPicker();
  const [open, setOpen] = useState(false);

  const pillClass = cn(
    "flex h-10 w-[210px] shrink-0 items-center gap-2 rounded-full border border-border/70 bg-card pl-3.5 pr-3 text-sm shadow-[var(--shadow-xs)]",
    triggerClassName,
  );
  const body = (
    <>
      {p.isViewingAllCompanies ? (
        <Layers className="h-4 w-4 shrink-0 text-muted-foreground" />
      ) : (
        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <span className="min-w-0 flex-1 truncate text-left">{p.title}</span>
    </>
  );

  if (!p.canSwitch) {
    return (
      <div className={pillClass} title={p.selectedCompany?.code ?? undefined}>
        {body}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Company: ${p.title}. Change company`}
          className={cn(
            pillClass,
            "transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          {body}
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-[280px] rounded-2xl p-0">
        <CompanyList onDone={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

/** Workspace-style identity + switcher at the top of the sidebar. */
export function CompanySwitcher({ moduleCount }: { moduleCount: number }) {
  const p = useCompanyPicker();
  const [open, setOpen] = useState(false);

  const subtitle = p.isViewingAllCompanies
    ? `${p.companies.length} companies · ${moduleCount} modules`
    : `${p.selectedCompany?.code ?? ""}${p.selectedCompany?.code ? " · " : ""}${moduleCount} modules`;

  const tile = (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white shadow-sm",
        "bg-[linear-gradient(145deg,hsl(213_94%_46%),hsl(224_85%_30%))]",
      )}
      aria-hidden
    >
      {p.isViewingAllCompanies ? <Layers className="h-4 w-4" /> : initials(p.selectedCompany?.name)}
    </span>
  );

  const label = (
    <span className="min-w-0 flex-1 text-left">
      <span className="block truncate text-sm font-semibold text-sidebar-accent-foreground">{p.title}</span>
      <span className="block truncate text-[11px] text-sidebar-muted">{subtitle}</span>
    </span>
  );

  if (!p.canSwitch) {
    return <div className="flex items-center gap-2.5 rounded-2xl px-2 py-2">{tile}{label}</div>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Switch company (current: ${p.title})`}
          className="flex w-full items-center gap-2.5 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          {tile}
          {label}
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-sidebar-muted" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="w-[--radix-popover-trigger-width] min-w-[260px] rounded-2xl p-0">
        <CompanyList onDone={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
