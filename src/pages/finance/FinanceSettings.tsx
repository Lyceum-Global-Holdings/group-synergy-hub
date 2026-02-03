import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, Globe, Receipt, Calendar, Settings } from "lucide-react";
import { PaymentTermsList } from "@/components/finance/settings/PaymentTermsList";
import { CurrencyList } from "@/components/finance/settings/CurrencyList";
import { ExchangeRatesList } from "@/components/finance/settings/ExchangeRatesList";
import { TaxTemplateList } from "@/components/finance/settings/TaxTemplateList";

export default function FinanceSettings() {
  const [activeTab, setActiveTab] = useState("payment-terms");

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Finance Settings</h1>
        <p className="text-muted-foreground">
          Configure payment terms, currencies, taxes, and GL defaults
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="payment-terms" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Payment Terms
          </TabsTrigger>
          <TabsTrigger value="currencies" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Currencies
          </TabsTrigger>
          <TabsTrigger value="taxes" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Tax Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="payment-terms">
          <PaymentTermsList />
        </TabsContent>

        <TabsContent value="currencies" className="space-y-6">
          <CurrencyList />
          <ExchangeRatesList />
        </TabsContent>

        <TabsContent value="taxes">
          <TaxTemplateList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
