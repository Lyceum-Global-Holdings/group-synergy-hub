import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as any;
Object.assign(window.HTMLElement.prototype, { hasPointerCapture: () => false, releasePointerCapture: () => {} });

const m = vi.hoisted(() => ({ save: vi.fn(), remove: vi.fn(), settings: vi.fn(), setup: undefined as any }));

vi.mock("@/hooks/useCompanyApprovers", async (orig) => ({
  ...(await orig<typeof import("@/hooks/useCompanyApprovers")>()),
  useCompanyApprovalSetup: () => ({ data: m.setup, isLoading: false, error: null }),
  useSaveCompanyApprover: () => ({ mutate: m.save, isPending: false }),
  useRemoveCompanyApprover: () => ({ mutate: m.remove, isPending: false }),
  useSaveCompanyApprovalSettings: () => ({ mutate: m.settings, isPending: false }),
}));

import { CompanyApproversDialog } from "@/components/admin/CompanyApproversDialog";
import { renderWithRouter } from "@/test/renderWithRouter";

const company = { id: "co", name: "Lyceum" };

describe("CompanyApproversDialog", () => {
  beforeEach(() => {
    m.save.mockClear(); m.remove.mockClear(); m.settings.mockClear();
    m.setup = {
      company_id: "co", company_name: "Lyceum", pr_final_approval_above: 100000,
      hod: { user_id: "h", full_name: "Hu Hod", email: "hod@lgh.lk" }, manager: null,
      approvers: [{ id: "a1", user_id: "f", full_name: "Fi Nance", email: "fin@lgh.lk", approval_level: "finance", department: null,
        is_primary: true, can_approve_up_to_amount: 250000, deactivated: false, in_company: true }],
      candidates: [{ user_id: "f", full_name: "Fi Nance", email: "fin@lgh.lk" }, { user_id: "l", full_name: "Li Limited", email: "lim@lgh.lk" }],
    };
  });

  it("shows the rule, the company HOD and manager, and each approver's limit", () => {
    renderWithRouter(<CompanyApproversDialog company={company} onOpenChange={() => {}} />);
    expect(screen.getByLabelText(/final approval needed above/i)).toHaveValue(100000);
    expect(screen.getByText(/above LKR 100,000 need a department head's approval and then a final approval/i)).toBeInTheDocument();
    expect(screen.getByText("Hu Hod")).toBeInTheDocument();
    expect(screen.getByText("Not set")).toBeInTheDocument();
    const row = screen.getByText("Fi Nance").closest("tr")!;
    expect(within(row).getByText("LKR 250,000")).toBeInTheDocument();
    expect(within(row).getByText(/requisitions \(first or final approval\)/i)).toBeInTheDocument();
  });

  it("clearing the threshold saves one approval level", async () => {
    const user = userEvent.setup();
    renderWithRouter(<CompanyApproversDialog company={company} onOpenChange={() => {}} />);
    const save = screen.getByRole("button", { name: /^save$/i });
    expect(save).toBeDisabled(); // nothing changed yet
    await user.clear(screen.getByLabelText(/final approval needed above/i));
    expect(screen.getByText(/a department head's approval is enough/i)).toBeInTheDocument();
    await user.click(save);
    expect(m.settings).toHaveBeenCalledWith({ companyId: "co", prFinalApprovalAbove: null });
  });

  it("adds an approver with a limit", async () => {
    const user = userEvent.setup();
    renderWithRouter(<CompanyApproversDialog company={company} onOpenChange={() => {}} />);
    await user.click(screen.getByRole("button", { name: /add approver/i }));
    const add = screen.getAllByRole("button", { name: /add approver/i }).at(-1)!;
    expect(add).toBeDisabled(); // no person yet
    await user.click(screen.getByRole("combobox", { name: "Person" }));
    await user.click(await screen.findByRole("option", { name: "Li Limited" }));
    await user.type(screen.getByLabelText(/limit \(lkr\)/i), "50000");
    await user.click(add);
    expect(m.save).toHaveBeenCalledWith(
      { id: undefined, companyId: "co", userId: "l", level: "hod", limit: 50000, department: "", isPrimary: false },
      expect.anything(),
    );
  });

  it("edits keep the row's id; blank limit means no limit; removing asks first", async () => {
    const user = userEvent.setup();
    renderWithRouter(<CompanyApproversDialog company={company} onOpenChange={() => {}} />);
    await user.click(screen.getByRole("button", { name: /edit fi nance/i }));
    await user.clear(screen.getByLabelText(/limit \(lkr\)/i));
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(m.save).toHaveBeenCalledWith(expect.objectContaining({ id: "a1", userId: "f", level: "finance", limit: null, isPrimary: true }), expect.anything());

    await user.click(screen.getByRole("button", { name: /remove fi nance/i }));
    expect(m.remove).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /^remove$/i }));
    expect(m.remove).toHaveBeenCalledWith({ id: "a1", companyId: "co" }, expect.anything());
  });
});
