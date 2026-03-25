import { TabsContent } from "@/components/ui/tabs";
import { ModuleSubTabs } from "../ModuleSubTabs";
import { PaymentTermsList } from "@/components/finance/settings/PaymentTermsList";
import { CurrencyList } from "@/components/finance/settings/CurrencyList";
import { ExchangeRatesList } from "@/components/finance/settings/ExchangeRatesList";
import { TaxTemplateList } from "@/components/finance/settings/TaxTemplateList";

const subTabs = [
  { id: "payment-terms", label: "Payment Terms" },
  { id: "currencies", label: "Currencies" },
  { id: "taxes", label: "Tax Templates" },
];

interface SettingsModuleProps {
  activeSubTab: string;
  onSubTabChange: (tab: string) => void;
}

export default function SettingsModule({ activeSubTab, onSubTabChange }: SettingsModuleProps) {
  return (
    <ModuleSubTabs tabs={subTabs} activeTab={activeSubTab || "payment-terms"} onTabChange={onSubTabChange}>
      <TabsContent value="payment-terms" className="mt-4">
        <PaymentTermsList />
      </TabsContent>

      <TabsContent value="currencies" className="mt-4 space-y-6">
        <CurrencyList />
        <ExchangeRatesList />
      </TabsContent>

      <TabsContent value="taxes" className="mt-4">
        <TaxTemplateList />
      </TabsContent>
    </ModuleSubTabs>
  );
}