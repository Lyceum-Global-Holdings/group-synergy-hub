import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { formatCurrency } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export function DepreciationScheduleView() {
  const { selectedCompany } = useCompany();

  const { data: schedule, isLoading } = useQuery({
    queryKey: ["depreciation-schedule", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("depreciation_schedule")
        .select(`
          *,
          asset_master (
            asset_name,
            purchase_price
          ),
          accounting_periods (
            period_name,
            start_date,
            end_date
          )
        `)
        .eq("company_id", selectedCompany?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id,
  });

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Depreciation Schedule</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset</TableHead>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Original Cost</TableHead>
              <TableHead className="text-right">Depreciation</TableHead>
              <TableHead className="text-right">Accumulated</TableHead>
              <TableHead className="text-right">Book Value</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedule?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No depreciation schedule entries. Run depreciation to generate schedule.
                </TableCell>
              </TableRow>
            ) : (
              schedule?.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">
                    {(entry.asset_master as any)?.asset_name}
                  </TableCell>
                  <TableCell>
                    {(entry.accounting_periods as any)?.period_name || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency((entry.asset_master as any)?.purchase_price || 0)}
                  </TableCell>
                  <TableCell className="text-right text-destructive">
                    ({formatCurrency(entry.depreciation_amount || 0)})
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(entry.accumulated_depreciation || 0)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(entry.book_value || 0)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={entry.is_posted ? "default" : "secondary"}>
                      {entry.is_posted ? "Posted" : "Pending"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
