import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({
  start: vi.fn(),
  confirm: vi.fn(),
  pack: vi.fn(),
  resolve: vi.fn(),
  pickLines: [] as any[],
  packLines: [] as any[],
  holds: [] as any[],
  canDecide: true,
}));

vi.mock("@/hooks/usePickPackWork", () => ({
  usePickListLines: () => ({ data: m.pickLines, isLoading: false }),
  useSalesOrderPackLines: () => ({ data: m.packLines, isLoading: false }),
  useStartPickList: () => ({ mutate: m.start, isPending: false }),
  useConfirmPickList: () => ({ mutate: m.confirm, isPending: false }),
  usePackSalesOrder: () => ({ mutate: m.pack, isPending: false }),
}));
vi.mock("@/hooks/useQuarantineHolds", () => ({
  useQuarantineHolds: () => ({ data: m.holds, isLoading: false }),
  useCanDecideHolds: () => ({ data: m.canDecide }),
  useResolveHold: () => ({ mutate: m.resolve, isPending: false }),
}));
vi.mock("@/contexts/CompanyContext", () => ({ useCompany: () => ({ selectedCompany: { id: "co" } }) }));
vi.mock("@/lib/currentUser", () => ({ getCachedUserId: () => "me" }));

import { PickListWorkDialog } from "@/components/warehouse/PickListWorkDialog";
import { PackOrderDialog } from "@/components/warehouse/PackOrderDialog";
import { QuarantineHoldsPanel } from "@/components/warehouse/QuarantineHoldsPanel";
import { renderWithRouter } from "@/test/renderWithRouter";

const pickLine = (id: string, name: string, qty: number) => ({
  id, quantity_to_pick: qty, quantity_picked: 0, status: "pending", notes: null, pick_sequence: 1,
  finished_goods: { product_name: name, product_code: null }, warehouse_locations: { name: "Main" }, warehouse_bins: { bin_code: "A-01" },
});

describe("PickListWorkDialog", () => {
  beforeEach(() => {
    m.start.mockClear(); m.confirm.mockClear();
    m.pickLines = [pickLine("l1", "Shirt", 10), pickLine("l2", "Cap", 5)];
  });

  it("records what was picked, including short and missing lines", async () => {
    const user = userEvent.setup();
    renderWithRouter(<PickListWorkDialog pickList={{ id: "pl1", pick_list_number: "PL-1", status: "in_progress" }} onOpenChange={() => {}} />);
    const shirt = screen.getByLabelText(/picked quantity of shirt/i);
    expect(shirt).toHaveValue("10"); // starts at the full quantity
    await user.clear(shirt);
    await user.type(shirt, "8");
    await user.click(screen.getByLabelText(/cap not found/i));
    expect(screen.getByText(/2 lines are short/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /confirm pick/i }));
    expect(m.confirm).toHaveBeenCalledWith(
      { pickListId: "pl1", lines: [
        { pick_list_item_id: "l1", quantity_picked: 8, not_found: false, notes: undefined },
        { pick_list_item_id: "l2", quantity_picked: 0, not_found: true, notes: undefined },
      ] },
      expect.anything(),
    );
  });

  it("won't confirm more than the list asks for, and offers Start on a new list", async () => {
    const user = userEvent.setup();
    renderWithRouter(<PickListWorkDialog pickList={{ id: "pl1", pick_list_number: "PL-1", status: "pending" }} onOpenChange={() => {}} />);
    const shirt = screen.getByLabelText(/picked quantity of shirt/i);
    await user.clear(shirt);
    await user.type(shirt, "11");
    expect(screen.getByRole("button", { name: /confirm pick/i })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /start picking/i }));
    expect(m.start).toHaveBeenCalledWith("pl1");
  });

  it("shows results read-only once completed", () => {
    m.pickLines = [{ ...pickLine("l1", "Shirt", 10), quantity_picked: 10, status: "picked" }];
    renderWithRouter(<PickListWorkDialog pickList={{ id: "pl1", pick_list_number: "PL-1", status: "completed" }} onOpenChange={() => {}} />);
    expect(screen.queryByRole("button", { name: /confirm pick/i })).not.toBeInTheDocument();
    const row = screen.getByText("Shirt").closest("tr")!;
    expect(within(row).getByText("Picked")).toBeInTheDocument();
  });
});

describe("PackOrderDialog", () => {
  beforeEach(() => {
    m.pack.mockClear();
    m.packLines = [
      { id: "s1", item_name: "Shirt", quantity_issued: 10, quantity_picked: 10, quantity_packed: 4 },
      { id: "s2", item_name: "Cap", quantity_issued: 5, quantity_picked: 5, quantity_packed: 5 },
    ];
  });

  it("packs what is picked and not yet packed", async () => {
    const user = userEvent.setup();
    renderWithRouter(<PackOrderDialog salesOrder={{ id: "so1", order_number: "SO-1" }} onOpenChange={() => {}} />);
    expect(screen.queryByLabelText(/quantity of cap to pack/i)).not.toBeInTheDocument(); // fully packed already
    const shirt = screen.getByLabelText(/quantity of shirt to pack/i);
    expect(shirt).toHaveValue("6");
    await user.type(screen.getByLabelText(/weight/i), "12.5");
    await user.click(screen.getByRole("button", { name: /record package/i }));
    expect(m.pack).toHaveBeenCalledWith(
      expect.objectContaining({ salesOrderId: "so1", packageType: "Carton", packageWeight: 12.5,
        lines: [{ sales_order_item_id: "s1", quantity_packed: 6, package_number: 1 }] }),
      expect.anything(),
    );
  });

  it("refuses more than is waiting", async () => {
    const user = userEvent.setup();
    renderWithRouter(<PackOrderDialog salesOrder={{ id: "so1", order_number: "SO-1" }} onOpenChange={() => {}} />);
    const shirt = screen.getByLabelText(/quantity of shirt to pack/i);
    await user.clear(shirt);
    await user.type(shirt, "7");
    expect(screen.getByRole("button", { name: /record package/i })).toBeDisabled();
  });
});

describe("QuarantineHoldsPanel", () => {
  beforeEach(() => {
    m.resolve.mockClear();
    m.canDecide = true;
    m.holds = [{ hold_id: "h1", item_id: "i", item_code: "C-1", item_name: "Cement", bin_id: "b", bin_code: "A-02", location_name: "Main",
      quantity_held: 8, reason: "Damaged return", reference_number: "MRN-9", held_since: "2026-09-28T08:00:00Z" }];
  });

  it("scrapping needs a note and can be partial", async () => {
    const user = userEvent.setup();
    renderWithRouter(<QuarantineHoldsPanel />);
    const row = screen.getByText("Cement").closest("tr")!;
    await user.click(within(row).getByRole("button", { name: /^scrap$/i }));
    const dialog = screen.getByRole("dialog");
    const go = within(dialog).getByRole("button", { name: /^scrap$/i });
    expect(go).toBeDisabled();
    await user.clear(within(dialog).getByLabelText(/quantity/i));
    await user.type(within(dialog).getByLabelText(/quantity/i), "3");
    await user.type(within(dialog).getByLabelText(/note/i), "crushed bags");
    await user.click(go);
    expect(m.resolve).toHaveBeenCalledWith({ holdId: "h1", action: "scrap", quantity: 3, note: "crushed bags" }, expect.anything());
  });

  it("only managers see the decisions", () => {
    m.canDecide = false;
    renderWithRouter(<QuarantineHoldsPanel />);
    expect(screen.getByText(/a warehouse manager decides/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /release/i })).not.toBeInTheDocument();
  });
});
