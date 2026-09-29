import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as any;
Object.assign(window.HTMLElement.prototype, { hasPointerCapture: () => false, releasePointerCapture: () => {} });

const m = vi.hoisted(() => ({ issue: vi.fn(), ret: vi.fn(), warehouses: [] as { id: string; name: string }[] }));
vi.mock("@/hooks/construction/useRoomMaterialTransactions", () => ({
  useIssueMaterial: () => ({ mutate: m.issue, isPending: false }),
  useReturnMaterial: () => ({ mutate: m.ret, isPending: false }),
  useRoomWarehouseOptions: () => ({ data: m.warehouses, isLoading: false }),
}));

import { IssueMaterialDialog } from "@/components/construction/IssueMaterialDialog";
import { ReturnMaterialDialog } from "@/components/construction/ReturnMaterialDialog";
import { roomProgress } from "@/lib/roomProgress";
import { renderWithRouter } from "@/test/renderWithRouter";

const material: any = {
  id: "rm1", quantity_required: 30, quantity_allocated: 20,
  warehouse_item: { id: "w1", item_code: "CEM", name: "Cement", current_stock: 80 },
};

describe("Room materials go through issue and return notes", () => {
  beforeEach(() => { m.issue.mockClear(); m.ret.mockClear(); m.warehouses = [{ id: "wh", name: "Site store" }]; });

  it("requests from the project's warehouse, within what is still planned", async () => {
    const user = userEvent.setup();
    renderWithRouter(<IssueMaterialDialog material={material} roomId="r1" open onOpenChange={() => {}} />);
    expect(screen.getByText(/creates a material issue note/i)).toBeInTheDocument();
    const qty = screen.getByLabelText(/quantity/i);
    await user.type(qty, "11");
    expect(screen.getByText(/only 10 more is planned/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /submit issue note/i })).toBeDisabled();
    await user.clear(qty);
    await user.type(qty, "10");
    await user.click(screen.getByRole("button", { name: /submit issue note/i }));
    expect(m.issue).toHaveBeenCalledWith(
      { room_id: "r1", location_id: "wh", lines: [{ room_material_id: "rm1", quantity: 10 }], notes: "" },
      expect.anything(),
    );
  });

  it("a project without a warehouse can't request", () => {
    m.warehouses = [];
    renderWithRouter(<IssueMaterialDialog material={material} roomId="r1" open onOpenChange={() => {}} />);
    expect(screen.getByText(/allocate one to the project first/i)).toBeInTheDocument();
  });

  it("returns need a reason and can't exceed what the room holds", async () => {
    const user = userEvent.setup();
    renderWithRouter(<ReturnMaterialDialog material={material} roomId="r1" open onOpenChange={() => {}} />);
    const go = screen.getByRole("button", { name: /create return note/i });
    await user.type(screen.getByLabelText(/quantity/i), "25");
    expect(screen.getByText(/only 20 was issued/i)).toBeInTheDocument();
    await user.clear(screen.getByLabelText(/quantity/i));
    await user.type(screen.getByLabelText(/quantity/i), "5");
    expect(go).toBeDisabled();
    await user.type(screen.getByLabelText(/reason/i), "Surplus");
    await user.click(go);
    expect(m.ret).toHaveBeenCalledWith(
      { room_id: "r1", room_material_id: "rm1", quantity: 5, condition: "good", reason: "Surplus" },
      expect.anything(),
    );
  });
});

describe("roomProgress", () => {
  it("averages stages and counts a completed stage as 100%", () => {
    expect(roomProgress([])).toBe(0);
    expect(roomProgress([{ status: "completed", completion_percentage: 60 }, { status: "in_progress", completion_percentage: 50 }])).toBe(75);
    expect(roomProgress([{ status: "pending", completion_percentage: null }, { status: "in_progress", completion_percentage: 130 }])).toBe(50);
  });
});
