import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const m = vi.hoisted(() => ({ generate: vi.fn(async () => ({ created: 2, updated: 0, skipped: 0, deliveries: 5 })), company: { id: "co", name: "LGH Stores" } as any }));

vi.mock("@/contexts/CompanyContext", () => ({ useCompany: () => ({ selectedCompany: m.company }) }));
vi.mock("@/hooks/useSupplierEvaluations", () => ({
  useGenerateSupplierEvaluations: () => ({ mutateAsync: m.generate, isPending: false }),
}));

import { GenerateEvaluationsDialog } from "@/components/sourcing/GenerateEvaluationsDialog";
import { evaluationPeriods } from "@/lib/evaluationPeriods";
import { renderWithRouter } from "@/test/renderWithRouter";

describe("evaluationPeriods", () => {
  it("offers last month, this month and the last three months", () => {
    expect(evaluationPeriods(new Date(2026, 8, 28))).toEqual([
      { label: "Last month", from: "2026-08-01", to: "2026-08-31" },
      { label: "This month so far", from: "2026-09-01", to: "2026-09-28" },
      { label: "Last 3 months", from: "2026-06-01", to: "2026-08-31" },
    ]);
  });
});

describe("GenerateEvaluationsDialog", () => {
  beforeEach(() => { m.generate.mockClear(); m.company = { id: "co", name: "LGH Stores" }; });

  it("evaluates the chosen period for the selected company", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderWithRouter(<GenerateEvaluationsDialog open onOpenChange={onOpenChange} />);
    expect(screen.getByText(/delivered to LGH Stores/)).toBeInTheDocument();

    const [, , threeMonths] = evaluationPeriods();
    await user.click(screen.getByRole("button", { name: "Last 3 months" }));
    await user.click(screen.getByRole("button", { name: "Evaluate" }));
    expect(m.generate).toHaveBeenCalledWith({ companyId: "co", from: threeMonths.from, to: threeMonths.to });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("asks for a company when viewing all companies", () => {
    m.company = null;
    renderWithRouter(<GenerateEvaluationsDialog open onOpenChange={() => {}} />);
    expect(screen.getByText(/choose a company/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Evaluate" })).not.toBeInTheDocument();
  });
});
