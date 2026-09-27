import { moduleConfig } from "@/constants/moduleConfig";

export type ModuleRoute = { moduleKey: string; submoduleKey: string; url: string };

// Every page URL in the module catalogue, longest first so the most specific wins
// (e.g. /construction/resource-allocation/labour before /construction/resource-allocation).
const MODULE_ROUTES: ModuleRoute[] = Object.values(moduleConfig)
  .flatMap((module) =>
    module.subModules.flatMap((sub) => [
      { moduleKey: module.key, submoduleKey: sub.key, url: sub.url },
      ...(sub.children ?? []).map((child) => ({
        moduleKey: module.key,
        submoduleKey: child.key,
        url: child.url,
      })),
    ]),
  )
  .sort((a, b) => b.url.length - a.url.length);

/**
 * The module page a path belongs to, including its detail pages
 * (/tuh-modules/customer-po/123 → customer-po). Returns null for pages outside
 * the module catalogue, such as the dashboard or account settings.
 */
export function resolveModuleRoute(path: string): ModuleRoute | null {
  const pathname = path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  return (
    MODULE_ROUTES.find((route) => pathname === route.url || pathname.startsWith(`${route.url}/`)) ??
    null
  );
}
