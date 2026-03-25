import { TabsContent } from "@/components/ui/tabs";
import { ModuleSubTabs } from "../ModuleSubTabs";
import { KPICard } from "../KPICard";
import { PlaceholderContent } from "../PlaceholderContent";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, RefreshCw, Bell, GitBranch, Calendar, Play, CheckCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AutomationModuleProps {
  activeSubTab: string;
  onSubTabChange: (tab: string) => void;
}

const subTabs = [
  { id: "jobs", label: "Job Dashboard" },
  { id: "recurring", label: "Recurring Invoices" },
  { id: "reminders", label: "Payment Reminders" },
  { id: "workflow", label: "Workflow Rules" },
  { id: "scheduled", label: "Scheduled Tasks" },
];

export default function AutomationModule({ activeSubTab, onSubTabChange }: AutomationModuleProps) {
  const effectiveTab = activeSubTab || "jobs";

  return (
    <ModuleSubTabs tabs={subTabs} activeTab={effectiveTab} onTabChange={onSubTabChange}>
      <TabsContent value="jobs"><JobDashboard /></TabsContent>
      <TabsContent value="recurring">
        <PlaceholderContent title="Recurring Invoices" description="Set up automated recurring invoice generation for regular billing cycles. Coming soon." />
      </TabsContent>
      <TabsContent value="reminders">
        <PlaceholderContent title="Payment Reminders" description="Configure automatic payment reminder emails for overdue invoices. Coming soon." />
      </TabsContent>
      <TabsContent value="workflow"><WorkflowRulesTab /></TabsContent>
      <TabsContent value="scheduled">
        <PlaceholderContent title="Scheduled Tasks" description="View and manage scheduled background tasks. Requires edge function infrastructure. Coming soon." />
      </TabsContent>
    </ModuleSubTabs>
  );
}

function JobDashboard() {
  const jobs = [
    { name: "Depreciation Posting", schedule: "Monthly", lastRun: "Not yet", status: "inactive", icon: RefreshCw },
    { name: "Invoice Reminders", schedule: "Weekly", lastRun: "Not yet", status: "inactive", icon: Bell },
    { name: "Bank Reconciliation", schedule: "Daily", lastRun: "Not yet", status: "inactive", icon: GitBranch },
    { name: "Period Closing", schedule: "Monthly", lastRun: "Not yet", status: "inactive", icon: Calendar },
  ];

  return (
    <div className="space-y-6 mt-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard label="Total Jobs" value={jobs.length} icon={Bot} />
        <KPICard label="Active" value={0} icon={Play} variant="success" />
        <KPICard label="Completed Today" value={0} icon={CheckCircle} variant="primary" />
        <KPICard label="Pending" value={0} icon={Clock} variant="warning" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {jobs.map((job) => (
          <Card key={job.name}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <job.icon className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-base">{job.name}</CardTitle>
                </div>
                <Badge variant="outline" className="text-muted-foreground">{job.status}</Badge>
              </div>
              <CardDescription>Schedule: {job.schedule}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Last run: {job.lastRun}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function WorkflowRulesTab() {
  return (
    <div className="space-y-6 mt-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard label="Total Rules" value="—" icon={GitBranch} />
        <KPICard label="Active" value="—" icon={GitBranch} variant="success" />
        <KPICard label="Triggered Today" value="—" icon={GitBranch} variant="primary" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Approval Workflow Rules</CardTitle>
          <CardDescription>Configure approval stages, routing rules, and escalation policies.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-muted-foreground">
            <div className="text-center">
              <GitBranch className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Workflow rules management will be available here</p>
              <p className="text-xs mt-1">Uses existing approval_stages and approval_routing_rules tables</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
