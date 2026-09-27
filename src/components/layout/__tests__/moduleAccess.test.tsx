import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen } from "@testing-library/react";

import { resolveModuleRoute } from "@/components/layout/moduleRoutes";

const nav = {
  canOpen: vi.fn((_m: string, _s: string) => false),
  isReady: true,
  isSuperAdmin: false,
  hasCompanyScope: true,
};
vi.mock("@/components/layout/useAccessibleNav", () => ({ useAccessibleNav: () => nav }));

import { ModuleAccessGuard } from "@/components/layout/ModuleAccessGuard";
import { renderWithRouter } from "@/test/renderWithRouter";

describe("resolveModuleRoute", () => {
  it("maps a module page and its detail pages", () => {
    expect(resolveModuleRoute("/warehouse/grn")).toMatchObject({ moduleKey: "warehouse", submoduleKey: "grn" });
    expect(resolveModuleRoute("/tuh-modules/customer-po/abc-123")).toMatchObject({
      moduleKey: "tuh-modules",
      submoduleKey: "customer-po",
    });
    expect(resolveModuleRoute("/management/dashboards/42/edit")).toMatchObject({ submoduleKey: "dashboards" });
    expect(resolveModuleRoute("/finance/anything")).toMatchObject({ moduleKey: "finance", submoduleKey: "finance" });
  });

  it("prefers the most specific page", () => {
    expect(resolveModuleRoute("/construction/resource-allocation/labour")).toMatchObject({
      moduleKey: "construction",
      submoduleKey: "labour",
    });
    expect(resolveModuleRoute("/construction/resource-allocation")).toMatchObject({
      submoduleKey: "resource-allocation",
    });
  });

  it("ignores query strings, hashes and trailing slashes", () => {
    expect(resolveModuleRoute("/management/reports?template=WH-GRN-REG-001")).toMatchObject({
      moduleKey: "management",
      submoduleKey: "reports",
    });
    expect(resolveModuleRoute("/warehouse/inventory/#top")).toMatchObject({ submoduleKey: "inventory" });
  });

  it("does not match look-alike prefixes or pages outside the catalogue", () => {
    expect(resolveModuleRoute("/warehouse/grn-archive")).toBeNull();
    expect(resolveModuleRoute("/")).toBeNull();
    expect(resolveModuleRoute("/account/mfa")).toBeNull();
  });
});

describe("ModuleAccessGuard", () => {
  beforeEach(() => {
    nav.canOpen.mockReset().mockReturnValue(false);
    nav.isReady = true;
    nav.isSuperAdmin = false;
    nav.hasCompanyScope = true;
  });

  const renderAt = (route: string) =>
    renderWithRouter(
      <ModuleAccessGuard>
        <p>page content</p>
      </ModuleAccessGuard>,
      { route },
    );

  it("blocks a module page the user cannot open", () => {
    renderAt("/finance");
    expect(screen.getByText(/you don't have access to this page/i)).toBeInTheDocument();
    expect(screen.getByText(/finance & accounting/i)).toBeInTheDocument();
    expect(screen.queryByText("page content")).not.toBeInTheDocument();
    expect(nav.canOpen).toHaveBeenCalledWith("finance", "finance");
  });

  it("shows a module page the user can open", () => {
    nav.canOpen.mockReturnValue(true);
    renderAt("/warehouse/grn");
    expect(screen.getByText("page content")).toBeInTheDocument();
  });

  it("checks detail pages against their module page", () => {
    renderAt("/tuh-modules/customer-po/abc-123");
    expect(nav.canOpen).toHaveBeenCalledWith("tuh-modules", "customer-po");
    expect(screen.queryByText("page content")).not.toBeInTheDocument();
  });

  it("lets super admins through", () => {
    nav.isSuperAdmin = true;
    renderAt("/finance");
    expect(screen.getByText("page content")).toBeInTheDocument();
  });

  it("leaves pages outside the catalogue and admin pages to their own guards", () => {
    renderAt("/account/mfa");
    expect(screen.getByText("page content")).toBeInTheDocument();
  });

  it("leaves administration pages to AdminRoute", () => {
    renderAt("/admin/users-roles");
    expect(screen.getByText("page content")).toBeInTheDocument();
    expect(nav.canOpen).not.toHaveBeenCalled();
  });

  it("waits for access to load instead of flashing a block", () => {
    nav.isReady = false;
    renderAt("/finance");
    expect(screen.queryByText(/you don't have access/i)).not.toBeInTheDocument();
    expect(screen.queryByText("page content")).not.toBeInTheDocument();
  });

  it("asks for a company when none is selected", () => {
    nav.hasCompanyScope = false;
    renderAt("/warehouse/grn");
    expect(screen.getByText(/choose a company to continue/i)).toBeInTheDocument();
  });
});
