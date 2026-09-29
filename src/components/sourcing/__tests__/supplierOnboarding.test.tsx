import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Radix radio/select need these in jsdom.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as any;
Object.assign(window.HTMLElement.prototype, {
  hasPointerCapture: () => false,
  releasePointerCapture: () => {},
});

const m = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  submit: vi.fn(),
  approve: vi.fn(),
  draft: undefined as any,
  review: undefined as any,
  registrations: [] as any[],
}));

vi.mock("@/hooks/useSupplierRegistration", () => ({
  useSupplierRegistration: (id: string) => ({ data: id ? m.draft : undefined, isLoading: false, error: null }),
  useSupplierRegistrations: () => ({ data: m.registrations, isLoading: false }),
  useCreateRegistration: () => ({ mutateAsync: m.create, isPending: false }),
  useUpdateRegistration: () => ({ mutateAsync: m.update, isPending: false }),
  useSubmitRegistration: () => ({ mutateAsync: m.submit, isPending: false }),
  useApproveRegistration: () => ({ mutate: m.approve, isPending: false }),
  useRejectRegistration: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRegistrationReview: (id?: string) => ({ data: id ? m.review : undefined, isLoading: false, error: null }),
  useCheckDuplicates: () => ({ mutate: vi.fn(), data: undefined }),
}));
vi.mock("@/contexts/CompanyContext", () => ({ useCompany: () => ({ selectedCompany: { id: "co", name: "Lyceum", code: "LGH" } }) }));
vi.mock("@/hooks/useSupplierFormConfig", () => ({
  useSupplierPortalSettings: () => ({ data: null }),
  useSaveSupplierPortalSettings: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/components/sourcing/registration/FormBuilder", () => ({ default: () => null }));

import SupplierRegistrationWizard from "@/components/sourcing/SupplierRegistrationWizard";
import SupplierRegistration from "@/pages/sourcing/SupplierRegistration";
import { ApproveRegistrationDialog } from "@/components/sourcing/ApproveRegistrationDialog";
import { renderWithRouter } from "@/test/renderWithRouter";

const savedData = {
  supplier_name: "Fresh Supplies",
  supplier_type: "vendor",
  email: "a@fresh.lk",
  phone: "0771112222",
  street_address: "1 Main St",
  city: "Kandy",
  country: "Sri Lanka",
  bank_name: "Commercial Bank",
  bank_account_number: "8001234567",
  primary_contact_name: "Nimal",
  primary_contact_email: "nimal@fresh.lk",
  primary_contact_phone: "0771112223",
};
const lankaCement = {
  kind: "supplier", id: "s1", name: "Lanka Cement", code: "SUP00001", status: "active", reasons: ["email"], in_company: true,
};

describe("reopening a draft", () => {
  beforeEach(() => {
    m.create.mockReset(); m.update.mockReset().mockResolvedValue({}); m.submit.mockReset().mockResolvedValue(undefined);
    m.draft = { id: "d1", status: "draft", company_id: "co", supplier_data: savedData };
    m.review = { status: "draft", can_approve: false, duplicate_reason: null, duplicates: [] };
  });

  it("Continue opens the wizard on that draft", async () => {
    const user = userEvent.setup();
    m.registrations = [{ id: "d1", status: "draft", supplier_data: savedData, created_at: "2026-09-27T08:00:00Z", updated_at: "2026-09-28T09:30:00Z" }];
    renderWithRouter(<SupplierRegistration />);
    await user.click(screen.getByRole("button", { name: /^continue$/i }));
    expect(await screen.findByDisplayValue("Fresh Supplies")).toBeInTheDocument();
    expect(screen.getByDisplayValue("a@fresh.lk")).toBeInTheDocument();
  });

  it("saves into the same draft instead of starting a new one", async () => {
    const user = userEvent.setup();
    renderWithRouter(<SupplierRegistrationWizard draftId="d1" />);
    expect(screen.getByDisplayValue("Fresh Supplies")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /save & continue/i }));
    await waitFor(() => expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ id: "d1", supplier_data: expect.objectContaining({ supplier_name: "Fresh Supplies", bank_name: "Commercial Bank" }) })));
    expect(m.create).not.toHaveBeenCalled();
  });

  it("a possible duplicate needs a reason before it can be submitted", async () => {
    const user = userEvent.setup();
    m.review = { ...m.review, duplicates: [lankaCement] };
    renderWithRouter(<SupplierRegistrationWizard draftId="d1" />);
    for (const step of [2, 3, 4]) {
      await user.click(screen.getByRole("button", { name: /save & continue/i }));
      await screen.findByText(new RegExp(`Step ${step} of 4`));
    }
    expect(await screen.findByText(/may already be registered/i)).toBeInTheDocument();
    expect(screen.getByText("SUP00001 Lanka Cement")).toBeInTheDocument();
    const submit = screen.getByRole("button", { name: /submit for approval/i });
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText(/why is this a different supplier/i), "Separate legal entity");
    expect(submit).toBeEnabled();
    await user.click(submit);
    expect(m.submit).toHaveBeenCalledWith({ id: "d1", duplicateReason: "Separate legal entity" });
  });

  it("a submitted registration can't be reopened as a draft", () => {
    m.draft = { ...m.draft, status: "pending_approval" };
    renderWithRouter(<SupplierRegistrationWizard draftId="d1" />);
    expect(screen.getByText(/already been submitted/i)).toBeInTheDocument();
  });
});

describe("ApproveRegistrationDialog", () => {
  const registration: any = {
    id: "r1", request_type: "self_service", status: "pending_approval", company_id: "co",
    supplier_data: { supplier_name: "LC Distributors", email: "sales@lc.lk", tax_id: "134567890", bank_name: "HNB", bank_account_number: "0012345678" },
  };
  beforeEach(() => {
    m.approve.mockReset();
    m.review = { status: "pending_approval", can_approve: true, duplicate_reason: null, duplicates: [] };
  });

  it("with no match, creates the supplier and says the bank details are copied", async () => {
    const user = userEvent.setup();
    renderWithRouter(<ApproveRegistrationDialog registration={registration} onOpenChange={() => {}} />);
    expect(screen.getByText(/HNB, account ending 5678\) are copied/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /approve and create supplier/i }));
    expect(m.approve).toHaveBeenCalledWith({ id: "r1", notes: "", duplicateReason: undefined, linkSupplierId: undefined }, expect.anything());
  });

  it("creating a new supplier despite a match needs the approver's reason", async () => {
    const user = userEvent.setup();
    m.review = { ...m.review, duplicate_reason: "Distributor arm", duplicates: [lankaCement] };
    renderWithRouter(<ApproveRegistrationDialog registration={registration} onOpenChange={() => {}} />);
    expect(screen.getByText("Distributor arm")).toBeInTheDocument();
    const go = screen.getByRole("button", { name: /approve and create supplier/i });
    expect(go).toBeDisabled();
    await user.type(screen.getByLabelText(/why is this a different supplier/i), "Different entity");
    await user.click(go);
    expect(m.approve).toHaveBeenCalledWith({ id: "r1", notes: "", duplicateReason: "Different entity", linkSupplierId: undefined }, expect.anything());
  });

  it("linking uses the existing supplier and doesn't copy bank details", async () => {
    const user = userEvent.setup();
    m.review = { ...m.review, duplicates: [lankaCement] };
    renderWithRouter(<ApproveRegistrationDialog registration={registration} onOpenChange={() => {}} />);
    await user.click(screen.getByLabelText(/link to SUP00001 Lanka Cement/i));
    expect(screen.getByText(/are not copied to an existing supplier/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/why is this a different supplier/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /approve and link/i }));
    expect(m.approve).toHaveBeenCalledWith({ id: "r1", notes: "", duplicateReason: undefined, linkSupplierId: "s1" }, expect.anything());
  });

  it("a tax ID on file must be linked; creating new is not offered", async () => {
    m.review = { ...m.review, duplicates: [{ ...lankaCement, reasons: ["tax_id", "email"], in_company: false }] };
    renderWithRouter(<ApproveRegistrationDialog registration={registration} onOpenChange={() => {}} />);
    expect(await screen.findByRole("button", { name: /approve and link/i })).toBeEnabled();
    expect(screen.getByRole("radio", { name: /create a new supplier/i })).toBeDisabled();
    expect(screen.getByText(/tax ID 134567890 is already on file for SUP00001/)).toBeInTheDocument();
    expect(screen.getByText(/supplier elsewhere in the group/i)).toBeInTheDocument();
  });

  it("only administrators can approve", () => {
    m.review = { ...m.review, can_approve: false };
    renderWithRouter(<ApproveRegistrationDialog registration={registration} onOpenChange={() => {}} />);
    expect(screen.getByText(/only an administrator/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /approve and create supplier/i })).toBeDisabled();
  });
});
