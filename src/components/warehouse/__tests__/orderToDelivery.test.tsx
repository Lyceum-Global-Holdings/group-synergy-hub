import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as any;
Object.assign(window.HTMLElement.prototype, { hasPointerCapture: () => false, releasePointerCapture: () => {} });

const m = vi.hoisted(() => ({
  dispatch: vi.fn(),
  confirm: vi.fn(),
  post: vi.fn(),
  deliveryOrder: undefined as any,
  output: undefined as any,
}));

vi.mock("@/hooks/useDeliveryOrders", () => ({
  useDeliveryOrders: () => ({
    useDeliveryOrder: () => ({ data: m.deliveryOrder }),
    updateDeliveryOrderStatus: vi.fn(),
    isUpdatingStatus: false,
    cancelDeliveryOrder: vi.fn(),
    isCancelling: false,
    dispatchDeliveryOrder: m.dispatch,
    isDispatching: false,
    confirmDelivery: m.confirm,
    isConfirmingDelivery: false,
  }),
}));
vi.mock("@/hooks/useProductionOutput", () => ({
  useProductionOutputStatus: () => ({ data: m.output }),
  usePostProductionOutput: () => ({ mutate: m.post, isPending: false }),
}));
vi.mock("@/hooks/useFinishedGoods", () => ({
  useFinishedGoods: () => ({ products: [{ id: "fg1", product_code: "SH-1", product_name: "School shirt" }] }),
}));
vi.mock("@/contexts/CompanyContext", () => ({ useCompany: () => ({ selectedCompany: { id: "co" } }) }));

import { DeliveryOrderDetailsDialog } from "@/components/warehouse/DeliveryOrderDetailsDialog";
import ProductionOutputCard from "@/components/production/ProductionOutputCard";
import { renderWithRouter } from "@/test/renderWithRouter";

const DO = (patch = {}) => ({
  id: "do1", do_number: "DO-1", status: "approved", priority: "medium", created_at: "2026-09-29T02:00:00Z",
  delivery_date: "2026-09-30", sales_order: { order_number: "SO-1" }, customer: { customer_name: "Royal College" },
  items: [
    { id: "i1", quantity_ordered: 10, quantity_to_deliver: 10, item_condition: "good", finished_good: { product_name: "Shirt", product_code: "SH" } },
    { id: "i2", quantity_ordered: 4, quantity_to_deliver: 4, item_condition: "good", finished_good: { product_name: "Skirt", product_code: "SK" } },
  ],
  ...patch,
});

describe("Delivery order: dispatch and confirm delivery", () => {
  beforeEach(() => { m.dispatch.mockClear(); m.confirm.mockClear(); m.deliveryOrder = DO(); });

  it("an approved order can be dispatched", async () => {
    renderWithRouter(<DeliveryOrderDetailsDialog open onOpenChange={() => {}} deliveryOrderId="do1" />);
    await userEvent.click(screen.getByRole("button", { name: /^dispatch$/i }));
    expect(m.dispatch).toHaveBeenCalledWith("do1");
  });

  it("confirming records who received it and what arrived", async () => {
    const user = userEvent.setup();
    m.deliveryOrder = DO({ status: "in_transit", dispatched_at: "2026-09-29T03:00:00Z" });
    renderWithRouter(<DeliveryOrderDetailsDialog open onOpenChange={() => {}} deliveryOrderId="do1" />);
    expect(screen.queryByRole("button", { name: /^dispatch$/i })).not.toBeInTheDocument();
    expect(screen.getByText(/dispatched sep 29, 2026/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /confirm delivery/i }));
    const dialog = screen.getAllByRole("dialog").at(-1)!;
    const go = within(dialog).getByRole("button", { name: /confirm delivery/i });
    expect(go).toBeDisabled(); // who received it is required
    await user.type(within(dialog).getByLabelText(/received by/i), "Principal");
    const skirt = within(dialog).getByLabelText(/quantity of skirt delivered/i);
    await user.clear(skirt);
    await user.type(skirt, "5");
    expect(within(dialog).getByText(/between 0 and what was sent/i)).toBeInTheDocument();
    expect(go).toBeDisabled();
    await user.clear(skirt);
    await user.type(skirt, "1");
    await user.click(go);
    expect(m.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ doId: "do1", receivedBy: "Principal",
        lines: [{ item_id: "i1", quantity_delivered: 10 }, { item_id: "i2", quantity_delivered: 1 }] }),
      expect.anything(),
    );
  });

  it("a delivered order shows who received it", () => {
    m.deliveryOrder = DO({ status: "delivered", delivered_at: "2026-09-29T05:00:00Z", received_by_name: "Principal",
      items: [{ ...DO().items[0], quantity_delivered: 10 }] });
    renderWithRouter(<DeliveryOrderDetailsDialog open onOpenChange={() => {}} deliveryOrderId="do1" />);
    expect(screen.getByText(/received by principal/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /confirm delivery/i })).not.toBeInTheDocument();
  });
});

describe("Production output card", () => {
  beforeEach(() => m.post.mockClear());

  it("shows the receipt the database created", () => {
    m.output = { output: 10, finished_good: { id: "fg1", name: "School shirt", code: "SH-1" },
      receipt: { id: "b1", batch_number: "PRD-001", quantity: 10, approval_status: "pending" } };
    renderWithRouter(<ProductionOutputCard orderId="po1" completed />);
    expect(screen.getByText("PRD-001")).toBeInTheDocument();
    expect(screen.getByText(/waiting for approval/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /post/i })).not.toBeInTheDocument();
  });

  it("asks for the finished good when it can't be found", async () => {
    const user = userEvent.setup();
    m.output = { output: 3, finished_good: null, receipt: null };
    renderWithRouter(<ProductionOutputCard orderId="po3" completed />);
    const post = screen.getByRole("button", { name: /post 3 to finished goods/i });
    expect(post).toBeDisabled();
    await user.click(screen.getByRole("combobox", { name: "Finished good" }));
    await user.click(await screen.findByRole("option", { name: /School shirt/ }));
    await user.click(post);
    expect(m.post).toHaveBeenCalledWith({ orderId: "po3", finishedGoodId: "fg1" });
  });

  it("nothing for orders still in progress", () => {
    m.output = { output: 3, finished_good: null, receipt: null };
    const { container } = renderWithRouter(<ProductionOutputCard orderId="po3" completed={false} />);
    expect(container.textContent).not.toMatch(/finished goods/i);
  });
});
