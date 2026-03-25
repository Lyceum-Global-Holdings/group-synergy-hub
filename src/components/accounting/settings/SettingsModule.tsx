import { TabsContent } from "@/components/ui/tabs";
import { ModuleSubTabs } from "../ModuleSubTabs";
import { PaymentTermsList } from "@/components/finance/settings/PaymentTermsList";
import { CurrencyList } from "@/components/finance/settings/CurrencyList";
import { ExchangeRatesList } from "@/components/finance/settings/ExchangeRatesList";
import { TaxTemplateList } from "@/components/finance/settings/TaxTemplateList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2, Map, CreditCard, FileText, Mail, Settings2,
  Calculator, GitBranch, Activity, Bell, Database
} from "lucide-react";

const subTabs = [
  { id: "payment-terms", label: "Payment Terms" },
  { id: "currencies", label: "Currencies" },
  { id: "taxes", label: "Tax Templates" },
  { id: "companies", label: "Companies" },
  { id: "account-mapping", label: "Account Mapping" },
  { id: "payment-modes", label: "Payment Modes" },
  { id: "doc-templates", label: "Document Templates" },
  { id: "email-templates", label: "Email Templates" },
  { id: "custom-fields", label: "Custom Fields" },
  { id: "costing-budget", label: "Costing & Budget" },
  { id: "approval-workflow", label: "Approval Workflow" },
  { id: "activity", label: "Activity Log" },
  { id: "data-import", label: "Data Import" },
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

      <TabsContent value="companies" className="mt-4">
        <SettingsPlaceholder
          icon={Building2}
          title="Company Setup"
          description="Manage company profiles, registration details, tax identification numbers, and default accounting settings. Configure multi-company structures and inter-company relationships."
          items={["Company profile & registration", "Tax ID and statutory info", "Default GL accounts", "Inter-company settings"]}
        />
      </TabsContent>

      <TabsContent value="account-mapping" className="mt-4">
        <SettingsPlaceholder
          icon={Map}
          title="Account Mapping"
          description="Map default GL accounts for automated postings across modules. Configure control accounts for AP, AR, inventory, and tax to ensure proper journal entry generation."
          items={["AP/AR control accounts", "Inventory valuation accounts", "Tax liability accounts", "Bank clearing accounts"]}
        />
      </TabsContent>

      <TabsContent value="payment-modes" className="mt-4">
        <SettingsPlaceholder
          icon={CreditCard}
          title="Payment Modes"
          description="Define available payment methods for customer receipts and vendor payments. Configure bank details, processing rules, and GL account associations for each mode."
          items={["Cash, cheque, bank transfer", "Mobile money / digital wallets", "GL account per mode", "Processing fee configuration"]}
        />
      </TabsContent>

      <TabsContent value="doc-templates" className="mt-4">
        <SettingsPlaceholder
          icon={FileText}
          title="Document Templates"
          description="Customize print templates for invoices, receipts, purchase orders, and other financial documents. Configure layouts, headers, footers, and branding elements."
          items={["Invoice & receipt templates", "Purchase order layouts", "Statement of account", "Company branding & logos"]}
        />
      </TabsContent>

      <TabsContent value="email-templates" className="mt-4">
        <SettingsPlaceholder
          icon={Mail}
          title="Email Templates"
          description="Configure email templates for automated notifications including invoice delivery, payment reminders, receipt confirmations, and approval notifications."
          items={["Invoice delivery emails", "Payment reminder sequences", "Receipt confirmations", "Approval request notifications"]}
        />
      </TabsContent>

      <TabsContent value="custom-fields" className="mt-4">
        <SettingsPlaceholder
          icon={Settings2}
          title="Custom Fields"
          description="Add custom fields to financial documents and master data. Extend the data model to capture industry-specific or organization-specific information."
          items={["Custom invoice fields", "Vendor/customer attributes", "Transaction metadata", "Reporting dimensions"]}
        />
      </TabsContent>

      <TabsContent value="costing-budget" className="mt-4">
        <SettingsPlaceholder
          icon={Calculator}
          title="Costing & Budget Configuration"
          description="Set up cost centers, profit centers, and budget structures. Define budget periods, approval thresholds, and variance alert rules."
          items={["Cost center hierarchy", "Budget period setup", "Approval thresholds", "Variance alert rules"]}
        />
      </TabsContent>

      <TabsContent value="approval-workflow" className="mt-4">
        <SettingsPlaceholder
          icon={GitBranch}
          title="Approval Workflow"
          description="Configure multi-level approval workflows for financial documents. Set up approval hierarchies, delegation rules, and escalation policies."
          items={["Multi-level approval chains", "Amount-based routing", "Delegation and escalation", "Auto-approval rules"]}
        />
      </TabsContent>

      <TabsContent value="activity" className="mt-4">
        <SettingsPlaceholder
          icon={Activity}
          title="Activity Log"
          description="View a comprehensive log of all configuration changes and administrative actions. Track who modified settings, when, and what was changed."
          items={["Settings change history", "User login activity", "Permission changes", "System event log"]}
        />
      </TabsContent>

      <TabsContent value="data-import" className="mt-4">
        <SettingsPlaceholder
          icon={Database}
          title="Data Import"
          description="Import financial data from external systems. Upload chart of accounts, opening balances, customer/vendor master data, and historical transactions."
          items={["Chart of accounts import", "Opening balance upload", "Customer/vendor data", "Historical transactions"]}
        />
      </TabsContent>
    </ModuleSubTabs>
  );
}

function SettingsPlaceholder({ icon: Icon, title, description, items }: {
  icon: any; title: string; description: string; items: string[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Icon className="h-5 w-5" /> {title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Icon className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground max-w-lg mt-2">{description}</p>
          <div className="mt-6 grid grid-cols-2 gap-3 text-left max-w-md">
            {items.map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
