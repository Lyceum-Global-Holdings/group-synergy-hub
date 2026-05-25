import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ScanLine, CameraOff, RefreshCw, SwitchCamera, AlertCircle } from 'lucide-react';

// RFC 4122 canonical UUID — same as PublicBinAllocation.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Status = 'idle' | 'starting' | 'scanning' | 'denied' | 'error' | 'unsupported';

function resolveTarget(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  // Bare UUID → bin allocation.
  if (UUID_RE.test(text)) return `/b/${text.toLowerCase()}`;
  // Try to parse as URL.
  try {
    const url = new URL(text, window.location.origin);
    if (url.origin === window.location.origin) {
      return url.pathname + url.search + url.hash;
    }
    // Also accept other origins that match the QR conventions used by our PDFs.
    if (/\/b\/[0-9a-f-]{36}$/i.test(url.pathname) || /\/asset\//i.test(url.pathname)) {
      return url.pathname + url.search;
    }
  } catch {
    // not a URL
  }
  return null;
}

export default function ScanQR() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  const [status, setStatus] = useState<Status>('idle');
  const [rawResult, setRawResult] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>(undefined);

  useEffect(() => {
    document.title = 'Scan QR · Lyceum Global Holdings';
  }, []);

  const stop = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
  }, []);

  const start = useCallback(async (chosenDeviceId?: string) => {
    setErrMsg(null);
    setRawResult(null);
    if (!('mediaDevices' in navigator) || !navigator.mediaDevices.getUserMedia) {
      setStatus('unsupported');
      return;
    }
    setStatus('starting');
    try {
      if (!readerRef.current) {
        readerRef.current = new BrowserMultiFormatReader();
      }
      // Enumerate cameras (after permission is implicitly requested below).
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
          controls.stop();
          controlsRef.current = null;
          const target = resolveTarget(text);
          if (target) {
            navigate(target);
          } else {
            setRawResult(text);
            setStatus('idle');
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
  }, [navigate]);

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

  return (
    <div className="container max-w-xl py-6 space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <ScanLine className="h-6 w-6 text-primary" />
          Scan QR
        </h1>
        <p className="text-sm text-muted-foreground">
          Point your camera at a bin or asset QR code. You'll go straight to the adjustment screen
          — no re-login needed.
        </p>
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
          {rawResult && (
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
