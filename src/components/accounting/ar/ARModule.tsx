import { useState } from "react";
import { TabsContent } from "@/components/ui/tabs";
import { ModuleSubTabs } from "../ModuleSubTabs";
import { QuickActions } from "../QuickActions";
import { CustomerList } from "@/components/finance/ar/CustomerList";
import { CustomerInvoiceList } from "@/components/finance/ar/CustomerInvoiceList";
import { CustomerReceiptList } from "@/components/finance/ar/CustomerReceiptList";
import { ARAgingReport } from "@/components/finance/ar/ARAgingReport";
import { CreateCustomerDialog } from "@/components/finance/ar/CreateCustomerDialog";
import { CreateCustomerInvoiceDialog } from "@/components/finance/ar/CreateCustomerInvoiceDialog";
import { CreateReceiptDialog } from "@/components/finance/ar/CreateReceiptDialog";
import { Plus, Download } from "lucide-react";

const subTabs = [
  { id: "customers", label: "Customers" },
  { id: "invoices", label: "Invoices" },
  { id: "receipts", label: "Receipts" },
  { id: "aging", label: "Aging Report" },
];

interface ARModuleProps {
  activeSubTab: string;
  onSubTabChange: (tab: string) => void;
}

export default function ARModule({ activeSubTab, onSubTabChange }: ARModuleProps) {
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);

  const quickActions = [
    { label: "New Customer", icon: Plus, onClick: () => setShowCustomerDialog(true) },
    { label: "New Invoice", icon: Plus, onClick: () => setShowInvoiceDialog(true) },
    { label: "New Receipt", icon: Plus, onClick: () => setShowReceiptDialog(true) },
    { label: "Export", icon: Download, onClick: () => {} },
  ];

  return (
    <>
      <ModuleSubTabs tabs={subTabs} activeTab={activeSubTab || "customers"} onTabChange={onSubTabChange}>
        <TabsContent value="customers" className="mt-4 space-y-6">
          <QuickActions actions={[quickActions[0], quickActions[3]]} />
          <CustomerList />
        </TabsContent>

        <TabsContent value="invoices" className="mt-4 space-y-6">
          <QuickActions actions={[quickActions[1], quickActions[3]]} />
          <CustomerInvoiceList />
        </TabsContent>

        <TabsContent value="receipts" className="mt-4 space-y-6">
          <QuickActions actions={[quickActions[2], quickActions[3]]} />
          <CustomerReceiptList />
        </TabsContent>

        <TabsContent value="aging" className="mt-4">
          <ARAgingReport />
        </TabsContent>
      </ModuleSubTabs>

      <CreateCustomerDialog open={showCustomerDialog} onOpenChange={setShowCustomerDialog} />
      <CreateCustomerInvoiceDialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog} />
      <CreateReceiptDialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog} />
    </>
  );
}