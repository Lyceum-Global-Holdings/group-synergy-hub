import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Building2, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RouteSkeleton } from "@/components/layout/RouteSkeleton";
import { useAccessibleNav } from "@/components/layout/useAccessibleNav";
import { resolveModuleRoute } from "@/components/layout/moduleRoutes";
import { moduleConfig } from "@/constants/moduleConfig";

/**
 * Blocks module pages the user cannot open, so typing a URL gives the same
 * answer as the sidebar. Pages outside the module catalogue pass through;
 * administration pages keep their own AdminRoute / SuperAdminRoute guards.
 */
export function ModuleAccessGuard({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { canOpen, isReady, isSuperAdmin, hasCompanyScope } = useAccessibleNav();

  const route = resolveModuleRoute(pathname);
  if (!route || route.moduleKey === "administration") return <>{children}</>;
  if (!isReady) return <RouteSkeleton />;
  if (isSuperAdmin) return <>{children}</>;

  if (!hasCompanyScope) {
    return (
      <Blocked
        icon={Building2}
        title="Choose a company to continue"
        description="Pick a company from the selector at the top of the page. The pages you can open depend on the company."
      />
    );
  }

  if (canOpen(route.moduleKey, route.submoduleKey)) return <>{children}</>;

  const moduleDef = moduleConfig[route.moduleKey];
  const page =
    moduleDef?.subModules.find((s) => s.key === route.submoduleKey)?.name ??
    moduleDef?.subModules.flatMap((s) => s.children ?? []).find((c) => c.key === route.submoduleKey)?.name;

  return (
    <Blocked
      icon={LockKeyhole}
      title="You don't have access to this page"
      description={`${moduleDef?.name ?? "This module"}${page ? ` › ${page}` : ""} isn't switched on for your role in this company. Ask an administrator if you need it.`}
      showHome
    />
  );
}

function Blocked({
  icon: Icon,
  title,
  description,
  showHome,
}: {
  icon: typeof LockKeyhole;
  title: string;
  description: string;
  showHome?: boolean;
}) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div
        role="alert"
        className="flex max-w-md flex-col items-center gap-3 rounded-2xl border border-border/60 bg-card px-8 py-10 text-center shadow-[var(--shadow-xs)]"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Icon className="h-6 w-6" />
        </span>
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
        {showHome && (
          <Button asChild className="mt-2 rounded-full px-5">
            <Link to="/">Go to dashboard</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
