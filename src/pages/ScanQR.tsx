import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ScanLine, CameraOff, RefreshCw, SwitchCamera, AlertCircle, ArrowLeft } from 'lucide-react';

// RFC 4122 canonical UUID — same as PublicBinAllocation.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Status = 'idle' | 'starting' | 'scanning' | 'denied' | 'error' | 'unsupported';
type Intent = 'adjust-stock' | 'move-asset' | null;
type Match = { kind: 'bin' | 'asset'; path: string };

/**
 * Parse a scanned payload (URL or bare UUID) into a typed match.
 * - Bin allocations: `/b/:uuid`
 * - Assets: `/a/:uuid` (GS1 Digital Link) or `/asset/:uuid` (legacy alias)
 * - Bare UUIDs default to bin allocations (back-compat with old labels).
 */
function parseScanned(raw: string): Match | null {
  const text = raw.trim();
  if (!text) return null;
  if (UUID_RE.test(text)) return { kind: 'bin', path: `/b/${text.toLowerCase()}` };
  try {
    const url = new URL(text, window.location.origin);
    const path = url.pathname;
    const search = url.search;
    if (/^\/b\/[0-9a-f-]{36}$/i.test(path)) return { kind: 'bin', path: path + search };
    if (/^\/(a|asset)\/[0-9a-f-]{36}$/i.test(path)) return { kind: 'asset', path: path + search };
  } catch {
    // not a URL
  }
  return null;
}

/** Attach `?action=...` (preserving any existing params) so the destination auto-opens the right dialog. */
function withAction(path: string, action: 'adjust' | 'move'): string {
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}action=${action}`;
}


const INTENT_COPY: Record<Exclude<Intent, null>, { title: string; description: string; expects: string; backLabel: string; backTo: string }> = {
  'adjust-stock': {
    title: 'Scan to adjust stock',
    description: 'Point your camera at a bin QR label. We\'ll open the bin and let you adjust the on-hand quantity straight away.',
    expects: 'bin',
    backLabel: 'Back to Bin Allocations',
    backTo: '/warehouse/bin-allocations',
  },
  'move-asset': {
    title: 'Scan to move asset',
    description: 'Point your camera at an asset QR label. We\'ll open the asset and let you transfer it to a new location.',
    expects: 'asset',
    backLabel: 'Back to Asset Management',
    backTo: '/warehouse/asset-management',
  },
};

function parseIntent(value: string | null): Intent {
  if (value === 'adjust-stock' || value === 'move-asset') return value;
  return null;
}

export default function ScanQR() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const intent: Intent = parseIntent(searchParams.get('intent'));
  const copy = intent ? INTENT_COPY[intent] : null;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  const [status, setStatus] = useState<Status>('idle');
  const [rawResult, setRawResult] = useState<string | null>(null);
  const [mismatch, setMismatch] = useState<'expected-bin' | 'expected-asset' | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);

  useEffect(() => {
    document.title = copy ? `${copy.title} · Lyceum Global Holdings` : 'Scan QR · Lyceum Global Holdings';
  }, [copy]);

  const stop = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
  }, []);

  const handleScan = useCallback(
    (text: string): boolean => {
      const match = parseScanned(text);
      if (!match) {
        setRawResult(text);
        setMismatch(null);
        return false;
      }
      // Enforce intent gating so a wrong-type label can't open the wrong dialog.
      if (intent === 'adjust-stock' && match.kind !== 'bin') {
        setRawResult(text);
        setMismatch('expected-bin');
        return false;
      }
      if (intent === 'move-asset' && match.kind !== 'asset') {
        setRawResult(text);
        setMismatch('expected-asset');
        return false;
      }
      const action = match.kind === 'bin' ? 'adjust' : 'move';
      // Only append ?action when this scan came from a module intent — bare
      // /scan keeps the existing read-only landing behaviour.
      const target = intent ? withAction(match.path, action) : match.path;
      navigate(target);
      return true;
    },
    [intent, navigate],
  );

  const start = useCallback(async (chosenDeviceId?: string) => {
    setErrMsg(null);
    setRawResult(null);
    setMismatch(null);
    if (!('mediaDevices' in navigator) || !navigator.mediaDevices.getUserMedia) {
      setStatus('unsupported');
      return;
    }
    setStatus('starting');
    try {
      if (!readerRef.current) {
        readerRef.current = new BrowserMultiFormatReader();
      }
      const videoEl = videoRef.current;
      if (!videoEl) return;

      const constraints: MediaStreamConstraints = chosenDeviceId
        ? { video: { deviceId: { exact: chosenDeviceId } } }
        : { video: { facingMode: { ideal: 'environment' } } };

      controlsRef.current = await readerRef.current.decodeFromConstraints(
        constraints,
        videoEl,
        (result, _err, controls) => {
          if (!result) return;
          const text = result.getText();
          const accepted = handleScan(text);
          if (accepted) {
            controls.stop();
            controlsRef.current = null;
          } else {
            // Keep scanning; user can re-aim at a different label.
            setStatus('scanning');
          }
        },
      );

      try {
        const list = await BrowserMultiFormatReader.listVideoInputDevices();
        setDevices(list);
        if (chosenDeviceId) setDeviceId(chosenDeviceId);
      } catch {
        // Non-fatal — switch-camera just won't be available.
      }
      setStatus('scanning');
    } catch (err) {
      const name = (err as { name?: string })?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setStatus('denied');
      } else {
        setStatus('error');
        setErrMsg((err as Error)?.message || 'Could not start the camera.');
      }
    }
  }, [handleScan]);

  useEffect(() => {
    void start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchCamera = useCallback(async () => {
    if (devices.length < 2) return;
    stop();
    const idx = devices.findIndex((d) => d.deviceId === deviceId);
    const next = devices[(idx + 1) % devices.length];
    await start(next.deviceId);
  }, [devices, deviceId, start, stop]);

  const title = copy?.title ?? 'Scan QR';
  const description =
    copy?.description ??
    "Point your camera at a bin or asset QR code. You'll go straight to the details screen — no re-login needed.";

  return (
    <div className="container max-w-xl py-6 space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <ScanLine className="h-6 w-6 text-primary" />
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Camera</CardTitle>
          <CardDescription>
            {status === 'scanning' ? 'Looking for a QR code…' : 'Camera will start automatically.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative aspect-square w-full overflow-hidden rounded-md bg-black">
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              playsInline
              muted
              aria-label="QR scanner camera preview"
            />
            {status === 'starting' && (
              <div className="absolute inset-0 grid place-items-center bg-black/50 text-white">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
            {status === 'scanning' && (
              <div className="pointer-events-none absolute inset-8 rounded-lg border-2 border-primary/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" />
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {status === 'scanning' && (
              <Button variant="outline" size="sm" onClick={stop}>
                <CameraOff className="h-4 w-4 mr-2" />
                Stop
              </Button>
            )}
            {(status === 'idle' || status === 'error' || status === 'denied') && (
              <Button size="sm" onClick={() => void start(deviceId)}>
                <RefreshCw className="h-4 w-4 mr-2" />
                {status === 'idle' ? 'Scan again' : 'Try again'}
              </Button>
            )}
            {devices.length > 1 && (
              <Button variant="outline" size="sm" onClick={() => void switchCamera()}>
                <SwitchCamera className="h-4 w-4 mr-2" />
                Switch camera
              </Button>
            )}
            {copy && (
              <Button variant="ghost" size="sm" asChild className="ml-auto">
                <Link to={copy.backTo}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {copy.backLabel}
                </Link>
              </Button>
            )}
          </div>

          {status === 'denied' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Camera permission denied</AlertTitle>
              <AlertDescription>
                Allow camera access in your browser settings, then tap <strong>Try again</strong>.
              </AlertDescription>
            </Alert>
          )}
          {status === 'unsupported' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Camera not supported</AlertTitle>
              <AlertDescription>
                This browser doesn't expose a camera API. Open the app in Chrome, Safari, or Edge.
              </AlertDescription>
            </Alert>
          )}
          {status === 'error' && errMsg && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Could not start the camera</AlertTitle>
              <AlertDescription>{errMsg}</AlertDescription>
            </Alert>
          )}
          {mismatch && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Wrong code type</AlertTitle>
              <AlertDescription>
                {mismatch === 'expected-bin'
                  ? "This is an asset QR code. To adjust stock, scan a bin QR label instead."
                  : "This is a bin QR code. To move an asset, scan an asset QR label instead."}
              </AlertDescription>
            </Alert>
          )}
          {rawResult && !mismatch && (
            <Alert>
              <AlertTitle>Unrecognised code</AlertTitle>
              <AlertDescription className="break-all">
                Scanned: <code>{rawResult}</code>
                <div className="mt-2">
                  This QR isn't a Lyceum ERP bin or asset link. Scan another code or contact your
                  warehouse admin if you expected it to work.
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

