import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { formatCurrency } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin } from "lucide-react";

export function DepreciationScheduleView() {
  const { selectedCompany } = useCompany();

  const { data: schedule, isLoading } = useQuery({
    queryKey: ["depreciation-schedule", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("depreciation_schedule")
        .select(`
          *,
          warehouse_asset:warehouse_assets (
            name,
            asset_tag,
            purchase_price,
            location:warehouse_locations!warehouse_assets_location_id_fkey (
              name
            )
          ),
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
              <TableHead>Asset Tag</TableHead>
              <TableHead>Location</TableHead>
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
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  No depreciation schedule entries. Run depreciation to generate schedule.
                </TableCell>
              </TableRow>
            ) : (
              schedule?.map((entry) => {
                // Prefer warehouse_asset data, fallback to asset_master for backward compatibility
                const warehouseAsset = entry.warehouse_asset as any;
                const assetMaster = entry.asset_master as any;
                const assetName = warehouseAsset?.name || assetMaster?.asset_name || "Unknown Asset";
                const assetTag = warehouseAsset?.asset_tag;
                const purchasePrice = warehouseAsset?.purchase_price || assetMaster?.purchase_price || 0;
                const location = warehouseAsset?.location as any;

                return (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      {assetName}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {assetTag || "-"}
                    </TableCell>
                    <TableCell>
                      {location?.name ? (
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span>{location.name}</span>
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {(entry.accounting_periods as any)?.period_name || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(purchasePrice)}
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
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
