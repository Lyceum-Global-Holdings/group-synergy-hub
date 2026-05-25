import { Suspense, lazy, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Database, AlertTriangle, Users, ArrowLeftRight, GitBranch, Activity, Loader2 } from "lucide-react";

// Each tab is its own chunk so opening Backend Monitor only loads the
// shell + the default (Database) tab. Mermaid (Schema), Active Users,
// Transactions, and Error Logs stay off the critical path until clicked.
const DatabaseBrowser = lazy(() =>
  import("@/components/admin/backend/DatabaseBrowser").then(m => ({ default: m.DatabaseBrowser }))
);
const SchemaDiagramPanel = lazy(() =>
  import("@/components/admin/backend/SchemaDiagramPanel").then(m => ({ default: m.SchemaDiagramPanel }))
);
const TransactionsMonitorPanel = lazy(() =>
  import("@/components/admin/backend/TransactionsMonitorPanel").then(m => ({ default: m.TransactionsMonitorPanel }))
);
const SystemErrorLogsPanel = lazy(() =>
  import("@/components/admin/backend/SystemErrorLogsPanel").then(m => ({ default: m.SystemErrorLogsPanel }))
);
const ActiveUsersPanel = lazy(() =>
  import("@/components/admin/backend/ActiveUsersPanel").then(m => ({ default: m.ActiveUsersPanel }))
);
const UptimeMonitorPanel = lazy(() =>
  import("@/components/admin/backend/UptimeMonitorPanel").then(m => ({ default: m.UptimeMonitorPanel }))
);

function TabFallback() {
  return (
    <div className="flex items-center justify-center py-16 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin mr-2" />
      Loading…
    </div>
  );
}

const BackendDashboard = () => {
  const [tab, setTab] = useState("database");

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Backend Monitor</h1>
        <p className="text-muted-foreground text-sm">
          View database tables, schema diagrams, system error logs, active user sessions, and transactions.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full max-w-3xl grid-cols-6">
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
          <TabsTrigger value="uptime" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Uptime</span>
          </TabsTrigger>
        </TabsList>

        {/* Only mount the active tab so inactive panels do not load their
            JS chunk or trigger their data queries. */}
        <TabsContent value="database" className="mt-4">
          <Suspense fallback={<TabFallback />}>
            {tab === "database" && <DatabaseBrowser />}
          </Suspense>
        </TabsContent>
        <TabsContent value="schema" className="mt-4">
          <Suspense fallback={<TabFallback />}>
            {tab === "schema" && <SchemaDiagramPanel />}
          </Suspense>
        </TabsContent>
        <TabsContent value="transactions" className="mt-4">
          <Suspense fallback={<TabFallback />}>
            {tab === "transactions" && <TransactionsMonitorPanel />}
          </Suspense>
        </TabsContent>
        <TabsContent value="errors" className="mt-4">
          <Suspense fallback={<TabFallback />}>
            {tab === "errors" && <SystemErrorLogsPanel />}
          </Suspense>
        </TabsContent>
        <TabsContent value="users" className="mt-4">
          <Suspense fallback={<TabFallback />}>
            {tab === "users" && <ActiveUsersPanel />}
          </Suspense>
        </TabsContent>
        <TabsContent value="uptime" className="mt-4">
          <Suspense fallback={<TabFallback />}>
            {tab === "uptime" && <UptimeMonitorPanel />}
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BackendDashboard;
