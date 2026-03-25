import { useState } from "react";
import { TabsContent } from "@/components/ui/tabs";
import { ModuleSubTabs } from "../ModuleSubTabs";
import { QuickActions } from "../QuickActions";
import { SupplierInvoiceList } from "@/components/finance/ap/SupplierInvoiceList";
import { SupplierPaymentList } from "@/components/finance/ap/SupplierPaymentList";
import { APAgingReport } from "@/components/finance/ap/APAgingReport";
import { CreateSupplierInvoiceDialog } from "@/components/finance/ap/CreateSupplierInvoiceDialog";
import { CreatePaymentDialog } from "@/components/finance/ap/CreatePaymentDialog";
import { Plus, CreditCard, Download } from "lucide-react";

const subTabs = [
  { id: "invoices", label: "Invoices" },
  { id: "payments", label: "Payments" },
  { id: "aging", label: "Aging Report" },
];

interface APModuleProps {
  activeSubTab: string;
  onSubTabChange: (tab: string) => void;
}

export default function APModule({ activeSubTab, onSubTabChange }: APModuleProps) {
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  const quickActions = [
    { label: "New Invoice", icon: Plus, onClick: () => setShowInvoiceDialog(true) },
    { label: "New Payment", icon: CreditCard, onClick: () => setShowPaymentDialog(true) },
    { label: "Export", icon: Download, onClick: () => {} },
  ];

  return (
    <>
      <ModuleSubTabs tabs={subTabs} activeTab={activeSubTab || "invoices"} onTabChange={onSubTabChange}>
        <TabsContent value="invoices" className="mt-4 space-y-6">
          <QuickActions actions={[quickActions[0], quickActions[2]]} />
          <SupplierInvoiceList />
        </TabsContent>

        <TabsContent value="payments" className="mt-4 space-y-6">
          <QuickActions actions={[quickActions[1], quickActions[2]]} />
          <SupplierPaymentList />
        </TabsContent>

        <TabsContent value="aging" className="mt-4">
          <APAgingReport />
        </TabsContent>
      </ModuleSubTabs>

      <CreateSupplierInvoiceDialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog} />
      <CreatePaymentDialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog} />
    </>
  );
}