import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, Receipt } from "lucide-react";
import { SupplierPaymentList } from "@/components/finance/ap/SupplierPaymentList";
import { CustomerReceiptList } from "@/components/finance/ar/CustomerReceiptList";

export default function Payments() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
        <p className="text-muted-foreground">
          View and manage all supplier payments and customer receipts
        </p>
      </div>

      <Tabs defaultValue="supplier-payments" className="w-full">
        <TabsList>
          <TabsTrigger value="supplier-payments">
            <CreditCard className="h-4 w-4 mr-2" />
            Supplier Payments
          </TabsTrigger>
          <TabsTrigger value="customer-receipts">
            <Receipt className="h-4 w-4 mr-2" />
            Customer Receipts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="supplier-payments" className="mt-6">
          <SupplierPaymentList />
        </TabsContent>

        <TabsContent value="customer-receipts" className="mt-6">
          <CustomerReceiptList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
