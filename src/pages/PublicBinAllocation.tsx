import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, MapPin, Package, Building2, Boxes, AlertCircle } from 'lucide-react';

interface BinQR {
  id: string;
  item_code: string | null;
  item_name: string | null;
  bin_code: string | null;
  bin_name: string | null;
  location_name: string | null;
  location_code: string | null;
  company_name: string | null;
  allocated_quantity: number | null;
  available_quantity: number | null;
  updated_at: string | null;
}

export default function PublicBinAllocation() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<BinQR | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    document.title = 'Bin Allocation · Lyceum Global Holdings';
    (async () => {
      const { data, error } = await supabase.rpc('get_public_bin_allocation_qr', { p_id: id });
      if (error) {
        setError(error.message);
      } else if (!data) {
        setError('Bin allocation not found.');
      } else {
        setData(data as unknown as BinQR);
      }
      setLoading(false);
    })();
  }, [id]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-primary" />
            Bin Allocation
          </CardTitle>
          <CardDescription>Lyceum Global Holdings — Warehouse</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          )}

          {!loading && error && (
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" /> {error}
            </div>
          )}

          {!loading && data && (
            <dl className="space-y-3 text-sm">
              <Row icon={<Package className="h-4 w-4" />} label="Item">
                <div className="font-mono font-semibold">{data.item_code ?? '—'}</div>
                <div className="text-muted-foreground">{data.item_name}</div>
              </Row>
              <Row icon={<MapPin className="h-4 w-4" />} label="Bin">
                <div className="font-mono">{data.bin_code ?? '—'}</div>
                <div className="text-muted-foreground">{data.bin_name}</div>
              </Row>
              <Row icon={<MapPin className="h-4 w-4" />} label="Location">
                <div>{data.location_name ?? '—'}</div>
                {data.location_code && (
                  <div className="font-mono text-xs text-muted-foreground">{data.location_code}</div>
                )}
              </Row>
              <Row icon={<Building2 className="h-4 w-4" />} label="Company">
                <div>{data.company_name ?? '—'}</div>
              </Row>
              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div>
                  <div className="text-xs text-muted-foreground">Allocated</div>
                  <div className="text-lg font-semibold">{data.allocated_quantity ?? 0}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Available</div>
                  <div className="text-lg font-semibold text-success">
                    {data.available_quantity ?? 0}
                  </div>
                </div>
              </div>
              {data.updated_at && (
                <div className="text-xs text-muted-foreground pt-2">
                  Last updated {new Date(data.updated_at).toLocaleString()}
                </div>
              )}
            </dl>
          )}

          <div className="mt-6 pt-4 border-t text-xs text-muted-foreground">
            <Link to="/" className="text-primary hover:underline">Sign in</Link> to manage this allocation.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div className="flex-1">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        {children}
      </div>
    </div>
  );
}
