import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CornerDownLeft, FileBarChart2, LayoutDashboard, Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { REPORT_REGISTRY } from "@/lib/reports/registry";
import { useAccessibleNav } from "./useAccessibleNav";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * Word-contains matching (every typed word must appear in the name, module or
 * code). cmdk's default fuzzy scoring matched letter sequences across words,
 * e.g. "stock" → "Backend Monitor".
 */
function matchWords(value: string, search: string, keywords?: string[]) {
  const hay = [value, ...(keywords ?? [])].join(" ").toLowerCase();
  return search
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w))
    ? 1
    : 0;
}

/** True when focus is in a field where "/" should type rather than open search. */
function isTyping(el: EventTarget | null) {
  const t = el as HTMLElement | null;
  return !!t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
}

/**
 * Header search: a jump-to palette over every page the user can open plus the
 * Reports Center catalogue. Opens with ⌘K / Ctrl+K or "/".
 */
export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const nav = useAccessibleNav();
  const canReports = nav.canOpen("management", "reports");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping(e.target)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const reports = useMemo(() => (canReports ? REPORT_REGISTRY : []), [canReports]);

  const go = (url: string) => {
    setOpen(false);
    navigate(url);
  };

  return (
    <>
      {/* Wide pill on tablet/desktop, icon on phones */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-10 min-w-0 flex-1 max-w-md items-center gap-2.5 rounded-full border border-border/70 bg-card px-4 text-sm text-muted-foreground shadow-[var(--shadow-xs)] transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex"
        aria-label="Search pages and reports"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate text-left">Try searching “purchase order” or “stock”</span>
        <kbd className="hidden shrink-0 rounded-md border border-border bg-muted px-1.5 py-0.5 font-sans text-[11px] font-medium md:inline">
          {isMac ? "⌘K" : "Ctrl K"}
        </kbd>
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-card text-muted-foreground sm:hidden"
        aria-label="Search pages and reports"
      >
        <Search className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[12vh] max-w-xl translate-y-0 gap-0 overflow-hidden rounded-2xl p-0 shadow-2xl sm:top-[15vh]">
          <DialogTitle className="sr-only">Search</DialogTitle>
          <DialogDescription className="sr-only">Jump to any page or report you have access to.</DialogDescription>
          <Command filter={matchWords} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-input]]:h-12">
            <CommandInput placeholder="Search modules, pages and reports…" />
            <CommandList className="max-h-[60vh]">
              <CommandEmpty>No matching page or report.</CommandEmpty>

              <CommandGroup heading="Go to">
                <CommandItem value="dashboard home operations pulse" onSelect={() => go("/")}>
                  <LayoutDashboard className="mr-2 h-4 w-4 text-muted-foreground" />
                  Dashboard
                </CommandItem>
              </CommandGroup>

              {nav.modules.map((m) => {
                const Icon = m.icon;
                return (
                  <CommandGroup key={m.key} heading={m.title}>
                    {m.items.flatMap((item) => {
                      const rows = item.children?.length
                        ? item.children.map((c) => ({ key: `${item.key}/${c.key}`, title: c.name, parent: item.title, url: c.url }))
                        : [{ key: item.key, title: item.title, parent: undefined as string | undefined, url: item.url }];
                      return rows.map((r) => (
                        <CommandItem
                          key={`${m.key}|${r.key}`}
                          value={`${m.key}|${r.key}`}
                          keywords={[r.title, m.title, r.parent ?? ""]}
                          onSelect={() => go(r.url)}
                        >
                          <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                          <span className="flex-1 truncate">
                            {r.parent && <span className="text-muted-foreground">{r.parent} › </span>}
                            {r.title}
                          </span>
                        </CommandItem>
                      ));
                    })}
                  </CommandGroup>
                );
              })}

              {reports.length > 0 && (
                <CommandGroup heading="Reports">
                  {reports.map((r) => (
                    <CommandItem
                      key={r.code}
                      value={`report|${r.code}`}
                      keywords={[r.title, r.code, r.moduleKey, r.group ?? "", "report"]}
                      onSelect={() => go(`/management/reports?template=${encodeURIComponent(r.code)}&module=${r.moduleKey}`)}
                    >
                      <FileBarChart2 className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 truncate">{r.title}</span>
                      <span className="ml-2 shrink-0 font-mono text-[10px] text-muted-foreground">{r.code}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
            <div className="flex items-center justify-between border-t px-3 py-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CornerDownLeft className="h-3 w-3" /> to open
              </span>
              <span>Esc to close</span>
            </div>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
