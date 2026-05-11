import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export default function PublicBinAllocation() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<BinQR | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Bin Allocation · Lyceum Global Holdings';
    // No-index per-asset public route
    let meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      document.head.appendChild(meta);
    }
    const prev = meta.content;
    meta.content = 'noindex,nofollow';
    return () => {
      meta!.content = prev;
    };
  }, []);

  useEffect(() => {
    if (!id) {
      setError('Bin allocation not found.');
      setLoading(false);
      return;
    }
    // Canonical validation BEFORE any network call.
    if (!UUID_RE.test(id)) {
      setError('Bin allocation not found.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/public-bin-qr?id=${encodeURIComponent(id)}`,
          {
            method: 'GET',
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
          },
        );
        if (cancelled) return;
        if (res.status === 404) {
          setError('Bin allocation not found.');
        } else if (!res.ok) {
          setError('Unable to load bin allocation.');
        } else {
          const body = (await res.json()) as BinQR;
          setData(body);
        }
      } catch (e) {
        console.debug('public-bin-qr fetch failed', e);
        if (!cancelled) setError('Unable to load bin allocation.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
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
