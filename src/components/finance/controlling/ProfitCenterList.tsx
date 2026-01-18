import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, Edit, Target } from "lucide-react";

export function ProfitCenterList() {
  const { selectedCompany } = useCompany();

  const { data: profitCenters, isLoading } = useQuery({
    queryKey: ["profit-centers", selectedCompany?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profit_centers")
        .select("*")
        .eq("company_id", selectedCompany?.id)
        .order("code");

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
        <CardTitle>Profit Centers</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profitCenters?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  <div className="flex flex-col items-center py-8">
                    <Target className="h-12 w-12 text-muted-foreground/50 mb-2" />
                    <p>No profit centers defined</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              profitCenters?.map((pc) => (
                <TableRow key={pc.id}>
                  <TableCell className="font-mono">{pc.code}</TableCell>
                  <TableCell className="font-medium">{pc.name}</TableCell>
                  <TableCell className="text-muted-foreground">{pc.description || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={pc.is_active ? "default" : "secondary"}>
                      {pc.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
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
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
