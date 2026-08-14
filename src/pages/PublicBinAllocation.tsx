import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  MapPin,
  Package,
  Building2,
  Boxes,
  AlertCircle,
  LogIn,
  Pencil,
  RefreshCw,
  Mail,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ScannedBinAdjustmentDialog } from '@/components/warehouse/ScannedBinAdjustmentDialog';

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

// RFC 4122 canonical UUID (versions 1–8).
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Source the project URL/anon key from the shared client rather than reading
// import.meta.env directly: the generated client already resolves build-time
// VITE_* vars with baked-in fallbacks, so a deploy without those build args
// (e.g. the hosted build) still works. Reading the raw env here made this page
// fail closed with "Temporarily unavailable" even though the service was fine.
const SUPABASE_URL =
  (supabase as unknown as { supabaseUrl?: string }).supabaseUrl ||
  (import.meta.env.VITE_SUPABASE_URL as string);
const SUPABASE_ANON_KEY =
  (supabase as unknown as { supabaseKey?: string }).supabaseKey ||
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string);
const SUPPORT_EMAIL = 'support@lyceumglobal.co';

// HTTP-aligned error kinds (RFC 9110 §15.5/§15.6).
type ErrKind = 'invalid' | 'not_found' | 'unavailable';

export default function PublicBinAllocation() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<BinQR | null>(null);
  const [loading, setLoading] = useState(true);
  const [errKind, setErrKind] = useState<ErrKind | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [autoOpened, setAutoOpened] = useState(false);

  const shortId = id ? `${id.slice(0, 8)}…` : '';

  useEffect(() => {
    document.title = id
      ? `Bin ${shortId} · Lyceum Global Holdings`
      : 'Bin Allocation · Lyceum Global Holdings';
    let robots = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!robots) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      document.head.appendChild(robots);
    }
    const prev = robots.content;
    robots.content = 'noindex,nofollow';
    return () => {
      robots!.content = prev;
    };
  }, [id, shortId]);

  const fetchData = useCallback(async () => {
    if (!id || !UUID_RE.test(id)) {
      setErrKind('invalid');
      setLoading(false);
      return;
    }
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('public-bin-qr: missing Supabase env config');
      setErrKind('unavailable');
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrKind(null);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/public-bin-qr?id=${encodeURIComponent(id)}&ts=${Date.now()}`,
        {
          method: 'GET',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        },
      );
      if (res.status === 400) {
        // Distinguish malformed id from captcha-required (Turnstile gate).
        let kind: ErrKind = 'invalid';
        try {
          const body = await res.clone().json();
          if (body?.error === 'captcha-required') kind = 'unavailable';
        } catch { /* ignore */ }
        setErrKind(kind);
      } else if (res.status === 403) setErrKind('unavailable');
      else if (res.status === 404) setErrKind('not_found');
      else if (!res.ok) setErrKind('unavailable');
      else {
        setData((await res.json()) as BinQR);
        setErrKind(null);
      }
    } catch (e) {
      console.debug('public-bin-qr fetch failed', e);
      setErrKind('unavailable');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-open the Adjust dialog when arriving from the in-app scanner
  // (`/scan?intent=adjust-stock` → `/b/:id?action=adjust`).
  useEffect(() => {
    if (autoOpened) return;
    if (loading || errKind || !data) return;
    if (searchParams.get('action') !== 'adjust') return;
    if (!user) return;
    setAdjustOpen(true);
    setAutoOpened(true);
    // Strip the query so a refresh doesn't re-open the dialog.
    navigate(`/b/${id}`, { replace: true });
  }, [autoOpened, loading, errKind, data, searchParams, user, id, navigate]);

  const handleSignIn = () => {
    navigate(`/auth?redirect=${encodeURIComponent(`/b/${id}`)}`);
  };

  const reportMailto = () => {
    const subject = encodeURIComponent(`Obsolete bin QR label: ${id ?? '(missing)'}`);
    const body = encodeURIComponent(
      `Hello Warehouse Ops,\n\nI scanned a bin QR label that no longer resolves.\n\nAllocation ID: ${id ?? '(missing)'}\nScanned at: ${new Date().toISOString()}\nURL: ${window.location.href}\n\nPlease decommission the printed label.\n`,
    );
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  };

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

          {!loading && errKind && (
            <ErrorState
              kind={errKind}
              shortId={shortId}
              onRetry={fetchData}
              onReport={reportMailto}
            />
          )}

          {!loading && !errKind && data && (
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
                  <div className="font-mono text-xs text-muted-foreground">
                    {data.location_code}
                  </div>
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

          {!loading && !errKind && data && (
            <div className="mt-6 pt-4 border-t space-y-2">
              {authLoading ? null : user ? (
                <Button className="w-full" onClick={() => setAdjustOpen(true)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Adjust stock
                </Button>
              ) : (
                <Button className="w-full" onClick={handleSignIn}>
                  <LogIn className="h-4 w-4 mr-2" />
                  Sign in to adjust stock
                </Button>
              )}
              <div className="text-xs text-muted-foreground text-center">
                {user ? (
                  <Link
                    to="/warehouse/item-bin-master"
                    className="text-primary hover:underline"
                  >
                    Open Bin Master
                  </Link>
                ) : (
                  <>Adjustments require company access.</>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {data && (
        <ScannedBinAdjustmentDialog
          open={adjustOpen}
          onOpenChange={setAdjustOpen}
          allocationId={data.id}
          itemCode={data.item_code}
          itemName={data.item_name}
          binCode={data.bin_code}
          locationName={data.location_name}
          allocatedQuantity={data.allocated_quantity ?? 0}
          availableQuantity={data.available_quantity ?? 0}
          onAdjusted={fetchData}
        />
      )}
    </div>
  );
}

function ErrorState({
  kind,
  shortId,
  onRetry,
  onReport,
}: {
  kind: ErrKind;
  shortId: string;
  onRetry: () => void;
  onReport: () => void;
}) {
  const copy = {
    invalid: {
      title: 'This QR code is malformed',
      body: 'The link inside this QR code does not match the expected format. The label may be damaged or counterfeit.',
    },
    not_found: {
      title: 'This bin allocation no longer exists',
      body: `Allocation ${shortId} was not found. It may have been deleted, merged, or moved to another bin. Please retire this printed label.`,
    },
    unavailable: {
      title: 'Temporarily unavailable',
      body: 'We could not reach the warehouse service. Check your connection and try again in a moment.',
    },
  }[kind];

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold">{copy.title}</div>
          <p className="text-sm text-muted-foreground mt-1">{copy.body}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2 pt-2 border-t">
        {kind === 'unavailable' && (
          <Button variant="default" onClick={onRetry} className="w-full">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        )}
        {kind === 'not_found' && (
          <Button variant="outline" onClick={onReport} className="w-full">
            <Mail className="h-4 w-4 mr-2" />
            Report this label
          </Button>
        )}
        <Link
          to="/warehouse/item-bin-master"
          className="text-xs text-center text-muted-foreground hover:text-primary hover:underline"
        >
          Open Bin Master (sign-in required)
        </Link>
      </div>
    </div>
  );
}

function Row({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
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
