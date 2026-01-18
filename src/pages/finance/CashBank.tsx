import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, Building2, ArrowUpDown, FileCheck, Download } from "lucide-react";
import { BankAccountList } from "@/components/finance/bank/BankAccountList";
import { BankTransactionList } from "@/components/finance/bank/BankTransactionList";
import { CashPositionDashboard } from "@/components/finance/bank/CashPositionDashboard";
import { CreateBankAccountDialog } from "@/components/finance/bank/CreateBankAccountDialog";
import { CreateBankTransactionDialog } from "@/components/finance/bank/CreateBankTransactionDialog";

export default function CashBank() {
  const [activeTab, setActiveTab] = useState("accounts");
  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [showTransactionDialog, setShowTransactionDialog] = useState(false);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cash & Bank Management</h1>
          <p className="text-muted-foreground">
            Manage bank accounts, transactions, and cash position
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          {activeTab === "accounts" && (
            <Button onClick={() => setShowAccountDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Account
            </Button>
          )}
          {activeTab === "transactions" && (
            <Button onClick={() => setShowTransactionDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Transaction
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="accounts" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Bank Accounts
          </TabsTrigger>
          <TabsTrigger value="transactions" className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4" />
            Transactions
          </TabsTrigger>
          <TabsTrigger value="position" className="flex items-center gap-2">
            <FileCheck className="h-4 w-4" />
            Cash Position
          </TabsTrigger>
        </TabsList>

        <TabsContent value="accounts">
          <BankAccountList />
        </TabsContent>

        <TabsContent value="transactions">
          <BankTransactionList />
        </TabsContent>

        <TabsContent value="position">
          <CashPositionDashboard />
        </TabsContent>
      </Tabs>

      <CreateBankAccountDialog 
        open={showAccountDialog} 
        onOpenChange={setShowAccountDialog} 
      />
      
      <CreateBankTransactionDialog 
        open={showTransactionDialog} 
        onOpenChange={setShowTransactionDialog} 
      />
    </div>
  );
}
