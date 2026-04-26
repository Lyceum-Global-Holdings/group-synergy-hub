import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Receipt, Clock, Users, Download } from "lucide-react";
import { CustomerList } from "@/components/finance/ar/CustomerList";
import { CustomerInvoiceList } from "@/components/finance/ar/CustomerInvoiceList";
import { CustomerReceiptList } from "@/components/finance/ar/CustomerReceiptList";
import { ARAgingReport } from "@/components/finance/ar/ARAgingReport";
import { CreateCustomerDialog } from "@/components/finance/ar/CreateCustomerDialog";
import { CreateCustomerInvoiceDialog } from "@/components/finance/ar/CreateCustomerInvoiceDialog";
import { CreateReceiptDialog } from "@/components/finance/ar/CreateReceiptDialog";
import { GenerateReportButton } from "@/components/management/reports/GenerateReportButton";

export default function AccountsReceivable() {
  const [activeTab, setActiveTab] = useState("customers");
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Accounts Receivable</h1>
          <p className="text-muted-foreground">
            Manage customers, invoices, receipts, and collections
          </p>
        </div>
        <div className="flex gap-2">
          <GenerateReportButton size="sm" template="FN-AR-AGE-001" />
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          {activeTab === "customers" && (
            <Button onClick={() => setShowCustomerDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Customer
            </Button>
          )}
          {activeTab === "invoices" && (
            <Button onClick={() => setShowInvoiceDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Invoice
            </Button>
          )}
          {activeTab === "receipts" && (
            <Button onClick={() => setShowReceiptDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Receipt
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="customers" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Customers
          </TabsTrigger>
          <TabsTrigger value="invoices" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Invoices
          </TabsTrigger>
          <TabsTrigger value="receipts" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Receipts
          </TabsTrigger>
          <TabsTrigger value="aging" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Aging Report
          </TabsTrigger>
        </TabsList>

        <TabsContent value="customers">
          <CustomerList />
        </TabsContent>

        <TabsContent value="invoices">
          <CustomerInvoiceList />
        </TabsContent>

        <TabsContent value="receipts">
          <CustomerReceiptList />
        </TabsContent>

        <TabsContent value="aging">
          <ARAgingReport />
        </TabsContent>
      </Tabs>

      <CreateCustomerDialog 
        open={showCustomerDialog} 
        onOpenChange={setShowCustomerDialog} 
      />
      
      <CreateCustomerInvoiceDialog 
        open={showInvoiceDialog} 
        onOpenChange={setShowInvoiceDialog} 
      />
      
      <CreateReceiptDialog 
        open={showReceiptDialog} 
        onOpenChange={setShowReceiptDialog} 
      />
    </div>
  );
}
