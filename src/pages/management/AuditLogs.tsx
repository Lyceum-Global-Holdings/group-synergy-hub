import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollText, Download, Filter, AlertTriangle, CheckCircle, XCircle, Activity, Zap, Clock } from "lucide-react";
import { useSystemErrorLogs } from "@/hooks/useSystemErrorLogs";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { GenerateReportButton } from "@/components/management/reports/GenerateReportButton";

export default function AuditLogs() {
  const { toast } = useToast();
  const [filterFunction, setFilterFunction] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { logs, isLoading, summary, functionNames, dismissLog, isDismissing } =
    useSystemErrorLogs({
      functionName: filterFunction,
      status: filterStatus,
    });

  const handleDismiss = async (logId: string) => {
    try {
      await dismissLog(logId);
      toast({ title: "Log dismissed" });
    } catch {
      toast({ title: "Failed to dismiss", variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Open</Badge>;
      case "auto_resolved":
        return <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-700"><CheckCircle className="h-3 w-3" />Auto-Resolved</Badge>;
      case "dismissed":
        return <Badge variant="secondary" className="gap-1"><XCircle className="h-3 w-3" />Dismissed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCodeBadge = (code: number | null) => {
    if (!code) return <span className="text-muted-foreground">—</span>;
    if (code >= 500) return <Badge variant="destructive">{code}</Badge>;
    if (code >= 400) return <Badge variant="outline" className="border-amber-500 text-amber-600">{code}</Badge>;
    return <Badge variant="secondary">{code}</Badge>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Error Logs</h1>
          <p className="text-muted-foreground">
            Monitor edge function errors, auto-retries, and resolution suggestions
          </p>
        </div>
        <GenerateReportButton template="MG-AUD-LOG-001" />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Errors (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary.total24h}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-500" />
              Auto-Resolved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">{summary.autoResolved}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Open
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">{summary.open}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Top Failing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-semibold truncate">{summary.topFunction || "None"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Select value={filterFunction} onValueChange={setFilterFunction}>
              <SelectTrigger>
                <SelectValue placeholder="Function Name" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Functions</SelectItem>
                {functionNames.map((fn) => (
                  <SelectItem key={fn} value={fn}>{fn}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="auto_resolved">Auto-Resolved</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Error Log Table */}
      <Card>
        <CardHeader>
          <CardTitle>Error Log</CardTitle>
          <CardDescription>
            {logs.length} log entries found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ScrollText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No error logs found</p>
              <p className="text-sm mt-2">
                Edge function errors will be captured here automatically
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Date</TableHead>
                    <TableHead>Function</TableHead>
                    <TableHead className="max-w-[300px]">Error</TableHead>
                    <TableHead className="w-[80px]">Code</TableHead>
                    <TableHead className="max-w-[250px]">Suggestion</TableHead>
                    <TableHead className="w-[130px]">Status</TableHead>
                    <TableHead className="w-[90px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.created_at), "MMM d, HH:mm")}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.function_name}
                      </TableCell>
                      <TableCell className="text-sm max-w-[300px] truncate" title={log.error_message}>
                        {log.error_message}
                      </TableCell>
                      <TableCell>{getCodeBadge(log.error_code)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[250px]">
                        {log.resolution || "—"}
                      </TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell>
                        {log.status === "open" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDismiss(log.id)}
                            disabled={isDismissing}
                          >
                            Dismiss
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
