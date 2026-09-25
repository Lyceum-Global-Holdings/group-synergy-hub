import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronRight, Download, LayoutDashboard, SlidersHorizontal } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { TooltipProvider } from "@/components/ui/tooltip";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { navPreloadProps } from "@/lib/navPreload";
import { cn } from "@/lib/utils";
import { CompanySwitcher } from "./CompanySwitcher";
import { PinnedSubmodulesGroup } from "./PinnedSubmodulesGroup";
import { SidebarPinButton } from "./SidebarPinButton";
import { useAccessibleNav, type NavItem, type NavModule } from "./useAccessibleNav";
import { useNavBadges, type NavBadge } from "./useNavBadges";
import { CountPill, leafClass, rowClass, SectionLabel, TreeItem } from "./sidebarPrimitives";

// ---------------------------------------------------------------------------

export function CompanySidebar() {
  const location = useLocation();
  const currentPath = location.pathname;
  const { isMobile, setOpenMobile } = useSidebar();
  const nav = useAccessibleNav();
  const badges = useNavBadges();
  const { installed } = usePwaInstall();

  // On phones the sidebar is a drawer — close it once a destination is chosen.
  const onNavigate = () => {
    if (isMobile) setOpenMobile(false);
  };

  const isActive = (path: string) => currentPath === path;
  const canManageModules = nav.canOpen("administration", "module-allocation");

  return (
    <TooltipProvider delayDuration={300}>
      <Sidebar className="border-r-0">
        <SidebarHeader className="px-3 pb-1 pt-3">
          <CompanySwitcher moduleCount={nav.moduleCount} />
        </SidebarHeader>

        <SidebarContent className="gap-0 px-3 pb-3">
          <nav aria-label="Main">
            <NavLink to="/" onClick={onNavigate} className={rowClass(currentPath === "/")} {...navPreloadProps("/")}>
              <LayoutDashboard className="h-[18px] w-[18px] shrink-0" />
              <span className="truncate">Dashboard</span>
            </NavLink>

            <PinnedSubmodulesGroup
              pins={nav.visiblePins}
              reorderDisabled={nav.isViewingAllCompanies}
              showCompanyBadge={nav.isViewingAllCompanies}
              onNavigate={onNavigate}
            />

            {nav.modules.length > 0 && (
              <>
                <SectionLabel>{nav.isViewingAllCompanies ? "All modules" : "Modules"}</SectionLabel>
                <ul className="space-y-0.5">
                  {nav.modules.map((m) => (
                    <ModuleBranch
                      key={m.key}
                      module={m}
                      currentPath={currentPath}
                      isActive={isActive}
                      badges={badges}
                      pinCompanyId={nav.pinTargetCompany?.id}
                      isItemPinned={nav.isItemPinned}
                      showUsage={nav.isViewingAllCompanies}
                      onNavigate={onNavigate}
                    />
                  ))}
                </ul>
              </>
            )}
          </nav>
        </SidebarContent>

        {(!installed || canManageModules) && (
          <SidebarFooter className="gap-0.5 border-t border-sidebar-border/70 px-3 py-2">
            {canManageModules && (
              <NavLink to="/admin/modules" onClick={onNavigate} className={rowClass(isActive("/admin/modules"))} {...navPreloadProps("/admin/modules")}>
                <SlidersHorizontal className="h-4 w-4 shrink-0" />
                <span className="truncate">Manage modules</span>
              </NavLink>
            )}
            {!installed && (
              <NavLink to="/install" onClick={onNavigate} className={rowClass(isActive("/install"))}>
                <Download className="h-4 w-4 shrink-0" />
                <span className="truncate">Install app</span>
              </NavLink>
            )}
          </SidebarFooter>
        )}
      </Sidebar>
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------

type BranchProps = {
  module: NavModule;
  currentPath: string;
  isActive: (path: string) => boolean;
  badges: Record<string, NavBadge>;
  pinCompanyId?: string;
  isItemPinned: (moduleKey: string, submoduleKey: string) => boolean;
  showUsage: boolean;
  onNavigate: () => void;
};

function ModuleBranch({ module: m, currentPath, isActive, badges, pinCompanyId, isItemPinned, showUsage, onNavigate }: BranchProps) {
  const groupActive = m.items.some(
    (item) => currentPath.startsWith(item.url) || item.children?.some((c) => currentPath.startsWith(c.url)),
  );
  const [open, setOpen] = useState(groupActive);

  // Follow navigation: opening a page inside a module expands it.
  useEffect(() => {
    if (groupActive) setOpen(true);
  }, [groupActive]);

  const itemBadges = m.items.map((i) => badges[`${m.key}|${i.key}`]).filter(Boolean) as NavBadge[];
  const rollup: NavBadge | null = itemBadges.length
    ? {
        count: itemBadges.reduce((s, b) => s + b.count, 0),
        tone: itemBadges.some((b) => b.tone === "alert") ? "alert" : "info",
        label: itemBadges.map((b) => b.label).join(", "),
      }
    : null;

  const Icon = m.icon;
  return (
    <li>
      <Collapsible open={open} onOpenChange={setOpen}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={cn(
            rowClass(false),
            groupActive && "font-semibold text-sidebar-accent-foreground",
          )}
        >
          <Icon className={cn("h-[18px] w-[18px] shrink-0", groupActive && "text-sidebar-primary")} />
          <span className="min-w-0 flex-1 truncate text-left">{m.title}</span>
          {showUsage && m.companiesUsing && (
            <span className="text-[11px] font-medium text-sidebar-muted" title={`Enabled for ${m.companiesUsing.length} companies`}>
              {m.companiesUsing.length}
            </span>
          )}
          {!open && rollup && <CountPill badge={rollup} />}
          <ChevronRight
            className={cn("h-3.5 w-3.5 shrink-0 text-sidebar-muted transition-transform duration-200", open && "rotate-90")}
          />
        </button>
        <CollapsibleContent>
          <ul className="ml-[19px] mt-0.5 pb-1">
            {m.items.map((item, idx) => (
              <TreeItem key={item.url} last={idx === m.items.length - 1}>
                {item.children && item.children.length > 0 ? (
                  <NestedBranch
                    item={item}
                    moduleKey={m.key}
                    currentPath={currentPath}
                    isActive={isActive}
                    pinCompanyId={pinCompanyId}
                    isItemPinned={isItemPinned}
                    onNavigate={onNavigate}
                  />
                ) : (
                  <Leaf
                    moduleKey={m.key}
                    itemKey={item.key}
                    title={item.title}
                    url={item.url}
                    active={isActive(item.url)}
                    badge={badges[`${m.key}|${item.key}`]}
                    pinCompanyId={pinCompanyId}
                    pinned={isItemPinned(m.key, item.key)}
                    onNavigate={onNavigate}
                  />
                )}
              </TreeItem>
            ))}
          </ul>
          {showUsage && m.companiesUsing && m.companiesUsing.length > 0 && (
            <p className="mb-1 ml-[35px] truncate text-[11px] text-sidebar-muted" title={m.companiesUsing.map((c) => c.name).join(", ")}>
              Used by {m.companiesUsing.map((c) => c.code).join(" · ")}
            </p>
          )}
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}

function Leaf({
  moduleKey,
  itemKey,
  title,
  url,
  active,
  badge,
  pinCompanyId,
  pinned,
  onNavigate,
}: {
  moduleKey: string;
  itemKey: string;
  title: string;
  url: string;
  active: boolean;
  badge?: NavBadge;
  pinCompanyId?: string;
  pinned: boolean;
  onNavigate: () => void;
}) {
  return (
    <div className="group/pin-row flex items-center gap-1">
      <NavLink to={url} onClick={onNavigate} className={leafClass(active)} aria-current={active ? "page" : undefined} {...navPreloadProps(url)}>
        <span className="min-w-0 flex-1 truncate">{title}</span>
        {badge && <CountPill badge={badge} className="ml-1.5" />}
      </NavLink>
      {pinCompanyId && (
        <SidebarPinButton
          isPinned={pinned}
          companyId={pinCompanyId}
          moduleKey={moduleKey}
          submoduleKey={itemKey}
          submoduleUrl={url}
          submoduleTitle={title}
        />
      )}
    </div>
  );
}

function NestedBranch({
  item,
  moduleKey,
  currentPath,
  isActive,
  pinCompanyId,
  isItemPinned,
  onNavigate,
}: {
  item: NavItem;
  moduleKey: string;
  currentPath: string;
  isActive: (path: string) => boolean;
  pinCompanyId?: string;
  isItemPinned: (moduleKey: string, submoduleKey: string) => boolean;
  onNavigate: () => void;
}) {
  const childActive = !!item.children?.some((c) => currentPath.startsWith(c.url));
  const [open, setOpen] = useState(childActive || isActive(item.url));
  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={cn(leafClass(false), "w-full gap-1", childActive && "font-semibold text-sidebar-accent-foreground")}
      >
        <span className="min-w-0 flex-1 truncate text-left">{item.title}</span>
        <ChevronRight className={cn("h-3 w-3 shrink-0 text-sidebar-muted transition-transform duration-200", open && "rotate-90")} />
      </button>
      <CollapsibleContent>
        <ul className="ml-2 pb-0.5">
          {item.children?.map((child, idx, arr) => (
            <TreeItem key={child.url} last={idx === arr.length - 1}>
              <Leaf
                moduleKey={moduleKey}
                itemKey={child.key}
                title={child.name}
                url={child.url}
                active={isActive(child.url)}
                pinCompanyId={pinCompanyId}
                pinned={isItemPinned(moduleKey, child.key)}
                onNavigate={onNavigate}
              />
            </TreeItem>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
