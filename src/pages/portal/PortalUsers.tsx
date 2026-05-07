import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSupplierContext } from "@/contexts/SupplierContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function PortalUsers() {
  const { activeSupplierId } = useSupplierContext();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeSupplierId) return;
    setLoading(true);
    supabase
      .from("supplier_users")
      .select("id, portal_role, is_active, accepted_at, invited_at, user_id")
      .eq("supplier_id", activeSupplierId)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setRows(data ?? []); setLoading(false); });
  }, [activeSupplierId]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Portal Users</h1>
      <Card>
        <CardHeader><CardTitle>Members</CardTitle></CardHeader>
        <CardContent>
          {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Accepted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.user_id.slice(0, 8)}…</TableCell>
                    <TableCell className="capitalize">{r.portal_role}</TableCell>
                    <TableCell>
                      <Badge variant={r.is_active ? "default" : "secondary"}>
                        {r.is_active ? "active" : "inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>{r.accepted_at ? new Date(r.accepted_at).toLocaleDateString() : "—"}</TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No users yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
