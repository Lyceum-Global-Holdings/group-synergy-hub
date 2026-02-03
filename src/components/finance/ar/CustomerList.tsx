import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useGLSettings } from "@/hooks/useGLSettings";

export function CustomerList() {
  const { selectedCompany } = useCompany();
  const { currencySymbol } = useGLSettings();

  const { data: customers, isLoading } = useQuery({
    queryKey: ['customers-directory', selectedCompany?.id],
    queryFn: async () => {
      // Use secure view - finance users see customer info with masked PII
      const { data, error } = await supabase.from('customers_directory').select('*').eq('company_id', selectedCompany?.id).order('customer_name');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id,
  });

  if (isLoading) return <div className="text-center py-8">Loading...</div>;

  return (
    <Card>
      <CardHeader><CardTitle>Customers</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers?.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No customers found</TableCell></TableRow>
            ) : customers?.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.customer_code}</TableCell>
                <TableCell>{c.customer_name}</TableCell>
                <TableCell>{c.contact_person || '-'}</TableCell>
                <TableCell>{c.email || '-'}</TableCell>
                <TableCell className="text-right">{currencySymbol} {c.current_balance?.toLocaleString() || '0'}</TableCell>
                <TableCell><Badge variant={c.is_active ? 'default' : 'secondary'}>{c.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
