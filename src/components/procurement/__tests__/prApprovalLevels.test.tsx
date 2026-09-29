import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({ approve: vi.fn(), info: undefined as any }));

vi.mock("@/hooks/usePurchaseRequisitions", () => ({
  useSubmitPurchaseRequisition: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useApprovePurchaseRequisition: () => ({ mutateAsync: m.approve, isPending: false }),
  usePrApprovalInfo: () => ({ data: m.info }),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "approver" } }) }));

import { PrDetailsDialog } from "@/components/procurement/PrDetailsDialog";
import { renderWithRouter } from "@/test/renderWithRouter";

const pr = (patch = {}): any => ({
  id: "pr1", pr_number: "PR-20260929-001", title: "Site cement", status: "submitted", priority: "medium",
  requested_by: "requester", requested_date: "2026-09-29", required_date: "2026-10-10", total_estimated_amount: 300000,
  created_at: "2026-09-29T03:00:00Z", updated_at: "2026-09-29T03:00:00Z", items: [],
  bom: { bom_number: "BOM-7", product_name: "Uniform shirt" },
  ...patch,
});
const openActions = () => userEvent.click(screen.getByRole("tab", { name: /actions/i }));

describe("PrDetailsDialog: two approval levels", () => {
  beforeEach(() => {
    m.approve.mockReset().mockResolvedValue("pending_approval");
    m.info = { stage: "department_head", amount: 300000, final_threshold: 100000, needs_final: true, block_reason: null, history: [] };
  });

  it("says a final approval will follow, shows the BOM, and approves", async () => {
    renderWithRouter(<PrDetailsDialog pr={pr()} open onOpenChange={() => {}} />);
    expect(screen.getByText("Awaiting approval")).toBeInTheDocument();
    expect(screen.getByText(/a manager or finance approver then gives the final approval/i)).toBeInTheDocument();
    expect(screen.getByText("BOM-7 · Uniform shirt")).toBeInTheDocument();
    await openActions();
    await userEvent.click(screen.getByRole("button", { name: /^approve/i }));
    expect(m.approve).toHaveBeenCalledWith({ id: "pr1", action: "approved", comments: undefined });
  });

  it("at the final stage, a refused approver sees why and no buttons", async () => {
    m.info = { ...m.info, stage: "final", block_reason: "You gave the first approval, so a different person must give the final approval",
      history: [{ action: "approved", level: "department_head", comments: "Needed for site", at: "2026-09-29T05:00:00Z", approver: "Hu Hod" }] };
    renderWithRouter(<PrDetailsDialog pr={pr({ status: "pending_approval" })} open onOpenChange={() => {}} />);
    expect(screen.getAllByText("Awaiting final approval").length).toBeGreaterThan(0);
    expect(screen.getByText(/waiting for the final approval from a manager or finance approver/i)).toBeInTheDocument();
    await openActions();
    expect(screen.queryByRole("button", { name: /^approve/i })).not.toBeInTheDocument();
    expect(screen.getByText(/different person must give the final approval/i)).toBeInTheDocument();
  });

  it("history lists each approval with its level", async () => {
    m.info = { ...m.info, stage: null, history: [
      { action: "approved", level: "department_head", comments: "Needed for site", at: "2026-09-29T05:00:00Z", approver: "Hu Hod" },
      { action: "rejected", level: "final", comments: "Over budget", at: "2026-09-29T06:00:00Z", approver: "Fi Two" },
    ] };
    renderWithRouter(<PrDetailsDialog pr={pr({ status: "rejected", rejection_reason: "Over budget" })} open onOpenChange={() => {}} />);
    await userEvent.click(screen.getByRole("tab", { name: /approval history/i }));
    expect(screen.getByText("Department head: approved by Hu Hod")).toBeInTheDocument();
    expect(screen.getByText("Final approval: rejected by Fi Two")).toBeInTheDocument();
    expect(screen.getByText("Needed for site")).toBeInTheDocument();
  });
});
