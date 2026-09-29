import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({
  blockReason: null as string | null,
  approve: vi.fn(),
  withdraw: vi.fn(),
  createAmendment: vi.fn(async () => "a1"),
  createRelease: vi.fn(),
  decideRelease: vi.fn(),
  releaseBlock: null as string | null,
  releases: [] as any[],
  userId: "creator",
  send: vi.fn(),
  email: vi.fn(),
}));

vi.mock("@/hooks/useTwoLevelPoApprovals", () => {
  const idle = () => ({ mutate: vi.fn(), isPending: false });
  return {
    usePoApprovalBlockReason: () => ({ data: m.blockReason, isSuccess: true }),
    useSubmitForMerchandiserApproval: idle,
    useApprovePOAsMerchandiser: () => ({ mutate: m.approve, isPending: false }),
    useApprovePOAsDeptHead: () => ({ mutate: m.approve, isPending: false }),
    useRejectPO: idle,
    useSendDeptHeadApprovalEmail: idle,
    useWithdrawPo: () => ({ mutate: m.withdraw, isPending: false }),
  };
});
vi.mock("@/hooks/usePurchaseOrders", () => ({
  usePurchaseOrder: () => ({ data: undefined, isLoading: false }),
  useSendPurchaseOrder: () => ({ mutate: m.send, isPending: false }),
  useEmailPurchaseOrder: () => ({ mutate: m.email, isPending: false }),
}));
vi.mock("@/hooks/usePurchaseOrderApprovals", () => ({ usePurchaseOrderApprovals: () => ({ data: [] }) }));
vi.mock("@/components/procurement/PoAmendmentsTab", () => ({ PoAmendmentsTab: () => null }));
vi.mock("@/components/procurement/PoDocument", () => ({ PoDocument: () => null }));
vi.mock("@/components/procurement/PoDocumentDreamTeam", () => ({ PoDocumentDreamTeam: () => null }));
vi.mock("@/lib/currentUser", () => ({ getCachedUserId: () => m.userId }));
vi.mock("@/hooks/usePoAmendments", () => ({
  useCreatePoAmendment: () => ({ mutateAsync: m.createAmendment, isPending: false }),
}));
vi.mock("@/hooks/useBlanketPoReleases", () => ({
  useBpoReleases: () => ({ data: m.releases, isLoading: false }),
  useBpoReleaseBlockReason: () => ({ data: m.releaseBlock, isSuccess: true }),
  useCreateBpoRelease: () => ({ mutate: m.createRelease, isPending: false }),
  useDecideBpoRelease: () => ({ mutate: m.decideRelease, isPending: false }),
  useCancelBpoRelease: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { PoDetailsDialog } from "@/components/procurement/PoDetailsDialog";
import { CreatePoAmendmentDialog } from "@/components/procurement/CreatePoAmendmentDialog";
import { BlanketPoDetailsDialog } from "@/components/procurement/BlanketPoDetailsDialog";
import ThreeWayMatchDetail from "@/components/procurement/ThreeWayMatchDetail";
import { rfqPaths } from "@/components/sourcing/rfq/rfqPaths";
import { renderWithRouter } from "@/test/renderWithRouter";
import type { MatchResult } from "@/hooks/useThreeWayMatch";

const po = (patch = {}): any => ({
  id: "po1", po_number: "PO-0001", status: "pending_approval", total_amount: 140000, final_amount: 140000, tax_amount: 0, discount_amount: 0, currency: "LKR",
  created_by: "creator", po_date: "2026-09-20", payment_terms: "Net 30", delivery_terms: "DAP", expected_delivery_date: "2026-10-01",
  items: [
    { id: "i1", po_id: "po1", item_name: "Cement", item_code: "C-1", quantity_ordered: 100, quantity_received: 20, quantity_pending: 80, unit_price: 900, total_price: 90000, unit_of_measure: "bag" },
    { id: "i2", po_id: "po1", item_name: "Sand", quantity_ordered: 10, quantity_received: 0, quantity_pending: 10, unit_price: 5000, total_price: 50000, unit_of_measure: "cube" },
  ],
  ...patch,
});

describe("PoDetailsDialog approval buttons follow the database", () => {
  beforeEach(() => { m.approve.mockClear(); m.blockReason = null; m.userId = "someone-else"; });

  it("shows approve when the database allows it", async () => {
    renderWithRouter(<PoDetailsDialog open onOpenChange={() => {}} purchaseOrder={po()} />);
    await userEvent.click(screen.getAllByRole("button", { name: /approve \(merchandiser\)/i })[0]);
    expect(m.approve).toHaveBeenCalledWith({ poId: "po1", comments: undefined });
  });

  it("hides approve and says why when the database refuses", () => {
    m.blockReason = "You created this purchase order, so someone else must approve it";
    renderWithRouter(<PoDetailsDialog open onOpenChange={() => {}} purchaseOrder={po()} />);
    expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument();
    expect(screen.getByText(/someone else must approve it/i)).toBeInTheDocument();
  });

  it("lets the creator withdraw a pending PO, and offers amendments only once approved", async () => {
    m.userId = "creator";
    m.blockReason = "You created this purchase order, so someone else must approve it";
    const { unmount } = renderWithRouter(<PoDetailsDialog open onOpenChange={() => {}} purchaseOrder={po()} />);
    expect(screen.queryByRole("button", { name: /create amendment/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /withdraw to draft/i }));
    expect(m.withdraw).toHaveBeenCalledWith({ poId: "po1" });
    unmount();
    renderWithRouter(<PoDetailsDialog open onOpenChange={() => {}} purchaseOrder={po({ status: "sent" })} />);
    expect(screen.getByRole("button", { name: /create amendment/i })).toBeInTheDocument();
  });
});

describe("PoDetailsDialog emailing the supplier", () => {
  beforeEach(() => { m.send.mockClear(); m.email.mockClear(); m.userId = "creator"; });

  it("Send PO sends (and the hook emails it)", async () => {
    renderWithRouter(<PoDetailsDialog open onOpenChange={() => {}} purchaseOrder={po({ status: "approved" })} />);
    expect(screen.queryByRole("button", { name: /email/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /send po/i }));
    expect(m.send).toHaveBeenCalledWith("po1");
  });

  it("a sent PO says where it was emailed and can be emailed again", async () => {
    renderWithRouter(<PoDetailsDialog open onOpenChange={() => {}}
      purchaseOrder={po({ status: "sent", supplier_emailed_at: "2026-09-29T04:30:00Z", supplier_emailed_to: "sales@cement.lk" })} />);
    expect(screen.getByText(/emailed to sales@cement.lk on/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /email again/i }));
    expect(m.email).toHaveBeenCalledWith("po1");
  });

  it("a sent PO that wasn't emailed offers to email it", () => {
    renderWithRouter(<PoDetailsDialog open onOpenChange={() => {}} purchaseOrder={po({ status: "sent" })} />);
    expect(screen.getByText(/not emailed to the supplier yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /email to supplier/i })).toBeInTheDocument();
  });
});

describe("CreatePoAmendmentDialog", () => {
  beforeEach(() => m.createAmendment.mockClear());

  it("sends the structured change with the reason", async () => {
    const user = userEvent.setup();
    renderWithRouter(<CreatePoAmendmentDialog open onOpenChange={() => {}} purchaseOrder={po({ status: "approved" })} />);
    const submit = screen.getByRole("button", { name: /request amendment/i });
    await user.type(screen.getByLabelText(/new price for cement/i), "950");
    expect(screen.getByText(/LKR 145,000\.00/)).toBeInTheDocument();
    expect(submit).toBeDisabled(); // no reason yet
    await user.type(screen.getByLabelText(/reason/i), "Supplier price rise");
    await user.click(submit);
    expect(m.createAmendment).toHaveBeenCalledWith({
      po_id: "po1", amendment_type: "price_change", reason: "Supplier price rise", notes: undefined,
      changes: { lines: [{ po_item_id: "i1", unit_price: 950 }] },
    });
  });
});

const bpo = (): any => ({
  id: "b1", bpo_number: "BPO-1", contract_status: "active", currency: "LKR",
  contract_start_date: "2020-01-01", contract_end_date: "2099-12-31", total_contract_value: 100000, remaining_value: 36000,
  supplier: { name: "Alpha" },
  items: [{ id: "bi1", bpo_id: "b1", item_name: "Cement", unit_price: 1000, discount_percentage: 10, unit_of_measure: "bag",
    total_quantity_limit: 100, quantity_released: 60, remaining_quantity: 40, min_order_quantity: 10 }],
});

describe("BlanketPoDetailsDialog releases", () => {
  beforeEach(() => { m.createRelease.mockClear(); m.decideRelease.mockClear(); m.releases = []; m.releaseBlock = null; m.userId = "me"; });

  it("checks the release against the contract before submitting", async () => {
    const user = userEvent.setup();
    renderWithRouter(<BlanketPoDetailsDialog bpo={bpo()} open onOpenChange={() => {}} />);
    await user.click(screen.getByRole("tab", { name: /releases/i }));
    await user.click(screen.getByRole("button", { name: /new release/i }));
    const qty = screen.getByLabelText(/quantity of cement/i);
    const submit = screen.getByRole("button", { name: /submit for approval/i });
    await user.type(qty, "50");
    expect(screen.getByText(/more than what's left/i)).toBeInTheDocument();
    expect(submit).toBeDisabled();
    await user.clear(qty);
    await user.type(qty, "5");
    expect(screen.getByText(/below the item's minimum/i)).toBeInTheDocument();
    await user.clear(qty);
    await user.type(qty, "20");
    expect(screen.getByText(/LKR 18,000\.00/)).toBeInTheDocument(); // 20 × 900 contract price
    await user.click(submit);
    expect(m.createRelease).toHaveBeenCalledWith(
      expect.objectContaining({ bpo_id: "b1", urgency_level: "normal", items: [{ bpo_item_id: "bi1", quantity_requested: 20 }] }),
      expect.anything(),
    );
  });

  it("offers approval only when the database allows it", async () => {
    const user = userEvent.setup();
    m.releases = [{ id: "r1", bpo_id: "b1", release_number: "REL-1", release_status: "submitted", urgency_level: "normal",
      total_amount: 18000, created_at: "2026-09-27T10:00:00Z", requested_by: "someone", items: [] }];
    const { unmount } = renderWithRouter(<BlanketPoDetailsDialog bpo={bpo()} open onOpenChange={() => {}} />);
    await user.click(screen.getByRole("tab", { name: /releases/i }));
    await user.click(screen.getByRole("button", { name: /approve and create po/i }));
    expect(m.decideRelease).toHaveBeenCalledWith(expect.objectContaining({ releaseId: "r1", approve: true }));
    unmount();

    m.releaseBlock = "You requested this release, so someone else must approve it";
    renderWithRouter(<BlanketPoDetailsDialog bpo={bpo()} open onOpenChange={() => {}} />);
    await user.click(screen.getByRole("tab", { name: /releases/i }));
    expect(screen.queryByRole("button", { name: /approve and create po/i })).not.toBeInTheDocument();
    expect(screen.getByText(/someone else must approve it/i)).toBeInTheDocument();
  });
});

const match = (patch: Partial<MatchResult> = {}): MatchResult => ({
  invoiceId: "inv1", invoiceNumber: "INV-1", invoiceDate: "2026-09-20", currency: "LKR", supplierName: "Alpha",
  poId: "po1", poNumber: "PO-0001", grnNumbers: "GRN-1", poAmount: 140000, receivedAmount: 81000, invoiceAmount: 85500,
  variancePercent: -38.9, status: "exception", computedStatus: "exception", storedStatus: "pending", decided: false, notes: null,
  lineItems: [{ poItemId: "i1", itemName: "Cement", itemCode: "C-1", unitOfMeasure: "bag", poQty: 100, poUnitPrice: 900,
    receivedQty: 90, invoicedBefore: 0, invoiceQty: 95, invoiceUnitPrice: 900, qtyCheck: "over", priceCheck: "match" }],
  ...patch,
});

describe("ThreeWayMatchDetail", () => {
  it("needs a reason to accept an invoice that doesn't match", async () => {
    const user = userEvent.setup();
    const onDecide = vi.fn();
    renderWithRouter(<ThreeWayMatchDetail result={match()} onDecide={onDecide} isUpdating={false} />);
    expect(screen.getByText(/more than received/i)).toBeInTheDocument();
    const accept = screen.getByRole("button", { name: /accept with differences/i });
    expect(accept).toBeDisabled();
    expect(screen.getByRole("button", { name: /fail match/i })).toBeDisabled();
    await user.type(screen.getByLabelText(/reason/i), "Credit note agreed");
    await user.click(accept);
    expect(onDecide).toHaveBeenCalledWith(true, "Credit note agreed");
  });

  it("accepts a clean match without a reason and shows a person's decision", () => {
    const onDecide = vi.fn();
    const { unmount } = renderWithRouter(<ThreeWayMatchDetail result={match({ status: "matched", computedStatus: "matched",
      lineItems: [{ ...match().lineItems[0], invoiceQty: 90, qtyCheck: "match" }] })} onDecide={onDecide} isUpdating={false} />);
    expect(screen.getByRole("button", { name: /^accept$/i })).toBeEnabled();
    unmount();
    renderWithRouter(<ThreeWayMatchDetail result={match({ decided: true, status: "matched", notes: "Accepted with differences: credit note" })}
      onDecide={onDecide} isUpdating={false} />);
    const decision = screen.getByText(/decided by finance/i).closest("div")!;
    expect(within(decision).getByText(/^accepted$/i)).toBeInTheDocument();
    expect(screen.getByText(/accepted with differences: credit note/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /fail match/i })).not.toBeInTheDocument();
  });
});

describe("rfqPaths", () => {
  it("keeps RFQ links inside the section the user came from", () => {
    expect(rfqPaths("/procurement/rfq-rfp")).toEqual({ list: "/procurement/rfq-rfp", compare: "/procurement/rfq-rfp/compare" });
    expect(rfqPaths("/sourcing/rfq-management").compare).toBe("/sourcing/quotation-comparison");
  });
});
