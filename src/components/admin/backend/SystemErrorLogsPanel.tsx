import { useState } from "react";
import { useSystemErrorLogs } from "@/hooks/useSystemErrorLogs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";

export function SystemErrorLogsPanel() {
  const [fnFilter, setFnFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const { logs, isLoading, summary, functionNames, dismissLog, isDismissing } =
    useSystemErrorLogs({
      functionName: fnFilter,
      status: statusFilter,
    });

  const statusIcon = (status: string) => {
    switch (status) {
      case "open":
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case "auto_resolved":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "dismissed":
        return <XCircle className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Last 24h</p>
            <p className="text-2xl font-bold">{summary.total24h}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Open</p>
            <p className="text-2xl font-bold text-destructive">{summary.open}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Auto Resolved</p>
            <p className="text-2xl font-bold text-green-600">{summary.autoResolved}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground">Top Function</p>
            <p className="text-sm font-medium truncate">{summary.topFunction || "—"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={fnFilter} onValueChange={setFnFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Functions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Functions</SelectItem>
            {functionNames.map((fn) => (
              <SelectItem key={fn} value={fn}>{fn}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="auto_resolved">Auto Resolved</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Logs Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-480px)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">Status</TableHead>
                    <TableHead>Function</TableHead>
                    <TableHead>Error Message</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Resolution</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead className="w-20">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length ? (
                    logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{statusIcon(log.status)}</TableCell>
                        <TableCell className="font-mono text-xs">{log.function_name}</TableCell>
                        <TableCell className="text-xs max-w-[300px] truncate">
                          {log.error_message}
                        </TableCell>
                        <TableCell>
                          {log.error_code && (
                            <Badge variant={log.error_code >= 500 ? "destructive" : "secondary"}>
                              {log.error_code}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">
                          {log.resolution || "—"}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {format(new Date(log.created_at), "MMM dd, HH:mm")}
                        </TableCell>
                        <TableCell>
                          {log.status === "open" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              disabled={isDismissing}
                              onClick={() => dismissLog(log.id)}
                            >
                              Dismiss
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                        No error logs found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
