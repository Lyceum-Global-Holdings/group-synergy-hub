import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as any;
Object.assign(window.HTMLElement.prototype, { hasPointerCapture: () => false, releasePointerCapture: () => {} });

const m = vi.hoisted(() => ({
  rpc: vi.fn(),
  tables: {} as Record<string, unknown[]>,
}));

vi.mock("@/lib/untypedRpc", () => ({
  untypedRpc: (fn: string, args: Record<string, unknown>) => {
    m.rpc(fn, args);
    if (fn === "company_user_directory") return Promise.resolve([{ user_id: "u2", full_name: "Eng Two", email: "e2@x" }]);
    return Promise.resolve("ok");
  },
}));
vi.mock("@/integrations/supabase/client", () => {
  const chain = (rows: unknown[]) => {
    const c: any = { then: (res: any) => Promise.resolve({ data: rows, error: null }).then(res) };
    for (const k of ["select", "eq", "in", "order", "limit"]) c[k] = () => c;
    return c;
  };
  return { supabase: { from: (t: string) => chain(m.tables[t] ?? []) } };
});
vi.mock("@/contexts/CompanyContext", () => ({ useCompany: () => ({ selectedCompany: { id: "co" } }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { RecordQualityResultDialog, CloseIncidentDialog, CompleteSafetyInspectionDialog } from "@/components/construction/qhse/QhseDialogs";
import { CorrectiveActionsDialog } from "@/components/construction/qhse/CorrectiveActionsDialog";

const wrap = (ui: React.ReactElement) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);
const calls = (fn: string) => m.rpc.mock.calls.filter((c) => c[0] === fn).map((c) => c[1]);

beforeEach(() => { m.rpc.mockClear(); m.tables = {}; });

describe("Recording a quality result", () => {
  it("a fail needs findings and an action, which are sent with the result", async () => {
    const user = userEvent.setup();
    wrap(<RecordQualityResultDialog open onOpenChange={() => {}} inspection={{ id: "q1", inspection_number: "QI-1", title: "Columns" }} />);
    await user.click(screen.getByRole("combobox", { name: "Result" }));
    await user.click(await screen.findByRole("option", { name: "Fail" }));
    const save = screen.getByRole("button", { name: /record result/i });
    expect(save).toBeDisabled();

    await user.type(screen.getByLabelText(/findings/i), "Honeycombing at C4");
    expect(save).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /add action/i }));
    await user.type(screen.getByLabelText("Action 1"), "Grout and repair C4");
    await user.click(screen.getByRole("combobox", { name: "Action 1 owner" }));
    await user.click(await screen.findByRole("option", { name: "Eng Two" }));
    expect(save).toBeEnabled();
    await user.click(save);

    expect(calls("record_quality_result")).toEqual([{
      p_id: "q1", p_result: "fail", p_findings: "Honeycombing at C4",
      p_actions: [{ description: "Grout and repair C4", action_type: "corrective", assigned_to: "u2", due_date: null }],
    }]);
  });

  it("a pass is recorded on its own", async () => {
    const user = userEvent.setup();
    wrap(<RecordQualityResultDialog open onOpenChange={() => {}} inspection={{ id: "q2", inspection_number: "QI-2", title: "Slab" }} />);
    await user.click(screen.getByRole("button", { name: /record result/i }));
    expect(calls("record_quality_result")[0]).toMatchObject({ p_id: "q2", p_result: "pass", p_actions: [] });
  });
});

describe("Closing an incident", () => {
  it("needs the root cause", async () => {
    const user = userEvent.setup();
    wrap(<CloseIncidentDialog open onOpenChange={() => {}} incident={{ id: "s1", incident_number: "SI-1", title: "Fall" }} />);
    const close = screen.getByRole("button", { name: /close incident/i });
    expect(close).toBeDisabled();
    await user.type(screen.getByLabelText(/root cause/i), "Ladder not tied off");
    await user.click(close);
    expect(calls("close_safety_incident")[0]).toMatchObject({ p_id: "s1", p_root_cause: "Ladder not tied off" });
  });
});

describe("Completing a safety inspection", () => {
  it("hazards found need an action; the score must be 0–100", async () => {
    const user = userEvent.setup();
    wrap(<CompleteSafetyInspectionDialog open onOpenChange={() => {}} inspection={{ id: "i1", inspection_number: "SINSP-1" }} />);
    const complete = screen.getByRole("button", { name: /complete inspection/i });
    await user.type(screen.getByLabelText(/score/i), "120");
    expect(complete).toBeDisabled();
    await user.clear(screen.getByLabelText(/score/i));
    await user.type(screen.getByLabelText(/score/i), "72");
    expect(complete).toBeEnabled();
    await user.type(screen.getByLabelText(/hazards/i), "Open edge L3");
    expect(complete).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /add action/i }));
    await user.type(screen.getByLabelText("Action 1"), "Edge protection L3");
    await user.click(complete);
    expect(calls("complete_safety_inspection")[0]).toMatchObject({ p_id: "i1", p_score: 72, p_hazards: "Open edge L3" });
  });
});

describe("Corrective actions", () => {
  it("done actions are verified or sent back with a note", async () => {
    m.tables.construction_corrective_actions = [
      { id: "a1", action_number: "CA-202609-0001", description: "Repair C4", action_type: "corrective", assigned_to: "u2", due_date: null,
        status: "done", completion_note: "Grouted", verification_note: null },
      { id: "a2", action_number: "CA-202609-0002", description: "Brief crew", action_type: "preventive", assigned_to: null, due_date: null,
        status: "open", completion_note: null, verification_note: null },
    ];
    const user = userEvent.setup();
    wrap(<CorrectiveActionsDialog open onOpenChange={() => {}} sourceType="quality_inspection" source={{ id: "q1", number: "QI-1" }} canAdd />);

    const done = (await screen.findByText("Repair C4")).closest("tr")!;
    const open = screen.getByText("Brief crew").closest("tr")!;
    expect(within(open).queryByRole("button", { name: "Verify" })).not.toBeInTheDocument();

    await user.click(within(done).getByRole("button", { name: "Send back" }));
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText(/still needs doing/i), "Surface rough");
    await user.click(save);
    expect(calls("verify_corrective_action")).toEqual([{ p_action_id: "a1", p_accept: false, p_note: "Surface rough" }]);

    await user.click(within(open).getByRole("button", { name: "Mark done" }));
    await user.type(screen.getByLabelText(/what was done/i), "Toolbox talk");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(calls("complete_corrective_action")).toEqual([{ p_action_id: "a2", p_note: "Toolbox talk" }]);
  });
});
