import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatabaseBrowser } from "@/components/admin/backend/DatabaseBrowser";
import { SystemErrorLogsPanel } from "@/components/admin/backend/SystemErrorLogsPanel";
import { ActiveUsersPanel } from "@/components/admin/backend/ActiveUsersPanel";
import { TransactionsMonitorPanel } from "@/components/admin/backend/TransactionsMonitorPanel";
import { SchemaDiagramPanel } from "@/components/admin/backend/SchemaDiagramPanel";
import { Database, AlertTriangle, Users, ArrowLeftRight, GitBranch } from "lucide-react";

const BackendDashboard = () => {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Backend Monitor</h1>
        <p className="text-muted-foreground text-sm">
          View database tables, schema diagrams, system error logs, active user sessions, and transactions.
        </p>
      </div>

      <Tabs defaultValue="database" className="w-full">
        <TabsList className="grid w-full max-w-3xl grid-cols-5">
          <TabsTrigger value="database" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            <span className="hidden sm:inline">Database</span>
          </TabsTrigger>
          <TabsTrigger value="schema" className="flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            <span className="hidden sm:inline">Schema</span>
          </TabsTrigger>
          <TabsTrigger value="transactions" className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4" />
            <span className="hidden sm:inline">Transactions</span>
          </TabsTrigger>
          <TabsTrigger value="errors" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="hidden sm:inline">Error Logs</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Active Users</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="database" className="mt-4">
          <DatabaseBrowser />
        </TabsContent>
        <TabsContent value="schema" className="mt-4">
          <SchemaDiagramPanel />
        </TabsContent>
        <TabsContent value="transactions" className="mt-4">
          <TransactionsMonitorPanel />
        </TabsContent>
        <TabsContent value="errors" className="mt-4">
          <SystemErrorLogsPanel />
        </TabsContent>
        <TabsContent value="users" className="mt-4">
          <ActiveUsersPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BackendDashboard;
