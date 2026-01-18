import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { formatCurrency } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, Edit, Package } from "lucide-react";
import { format } from "date-fns";

export function AssetRegister() {
  const { selectedCompany } = useCompany();

  const { data: assets, isLoading } = useQuery({
    queryKey: ["fixed-assets", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_master")
        .select(`
          *,
          asset_categories (
            name
          )
        `)
        .eq("company_id", selectedCompany?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id,
  });

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "active":
        return <Badge variant="default">Active</Badge>;
      case "disposed":
        return <Badge variant="destructive">Disposed</Badge>;
      case "under_maintenance":
        return <Badge variant="secondary">Maintenance</Badge>;
      case "retired":
        return <Badge variant="outline">Retired</Badge>;
      default:
        return <Badge variant="secondary">{status || "Unknown"}</Badge>;
    }
  };

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fixed Asset Register</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Purchase Date</TableHead>
              <TableHead className="text-right">Purchase Price</TableHead>
              <TableHead className="text-right">Accum. Depreciation</TableHead>
              <TableHead className="text-right">Net Book Value</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assets?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  <div className="flex flex-col items-center py-8">
                    <Package className="h-12 w-12 text-muted-foreground/50 mb-2" />
                    <p>No fixed assets registered</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              assets?.map((asset) => {
                const purchasePrice = Number(asset.purchase_price) || 0;
                const accumDepr = Number(asset.accumulated_depreciation) || 0;
                const netBookValue = purchasePrice - accumDepr;

                return (
                  <TableRow key={asset.id}>
                    <TableCell className="font-medium">
                      <div>
                        <div>{asset.asset_name}</div>
                        {asset.brand && (
                          <div className="text-sm text-muted-foreground">{asset.brand}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{(asset.asset_categories as any)?.name || "-"}</TableCell>
                    <TableCell>
                      {asset.purchase_date
                        ? format(new Date(asset.purchase_date), "dd MMM yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(purchasePrice)}</TableCell>
                    <TableCell className="text-right text-destructive">
                      ({formatCurrency(accumDepr)})
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(netBookValue)}
                    </TableCell>
                    <TableCell>{getStatusBadge(asset.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
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
