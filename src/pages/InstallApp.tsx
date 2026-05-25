import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Download,
  Smartphone,
  ScanLine,
  CheckCircle2,
  Share,
  Plus,
  Info,
} from 'lucide-react';
import { usePwaInstall } from '@/hooks/usePwaInstall';

export default function InstallApp() {
  const { canPrompt, installed, isIos, promptInstall } = usePwaInstall();

  useEffect(() => {
    document.title = 'Install App · Lyceum Global Holdings';
  }, []);

  return (
    <div className="container max-w-2xl py-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Install Lyceum ERP on your phone</h1>
        <p className="text-sm text-muted-foreground">
          Add the app to your home screen so you can sign in once and scan bin or asset QR codes
          without re-entering your password every time.
        </p>
      </div>

      {installed ? (
        <Alert className="border-emerald-600/40">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <AlertTitle>App is installed</AlertTitle>
          <AlertDescription>
            You're already using the installed app. Your session is held privately on this device
            and QR scans will reuse it.
          </AlertDescription>
        </Alert>
      ) : null}

      {!installed && canPrompt ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              One-tap install
            </CardTitle>
            <CardDescription>Your browser supports direct installation.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="lg" onClick={() => void promptInstall()} className="w-full sm:w-auto">
              <Download className="h-4 w-4 mr-2" />
              Install app
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!installed && isIos ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              Install on iPhone / iPad
            </CardTitle>
            <CardDescription>iOS requires adding the app from Safari's share menu.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ol className="list-decimal pl-5 space-y-2">
              <li>
                Open this page in <strong>Safari</strong> (not Chrome or an in-app browser).
              </li>
              <li>
                Tap the <Share className="inline h-4 w-4 align-text-bottom" /> <strong>Share</strong> button at
                the bottom of the screen.
              </li>
              <li>
                Choose <Plus className="inline h-4 w-4 align-text-bottom" /> <strong>Add to Home Screen</strong>.
              </li>
              <li>Tap <strong>Add</strong> to confirm.</li>
            </ol>
          </CardContent>
        </Card>
      ) : null}

      {!installed && !canPrompt && !isIos ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              Install on Android / Desktop
            </CardTitle>
            <CardDescription>Use your browser's install option.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>Open the browser menu (⋮) and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>
            <p className="text-muted-foreground">
              If you don't see the option, refresh this page and try again — some browsers wait a few
              seconds before offering installation.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-primary" />
            Scan QR codes without signing in every time
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className="list-decimal pl-5 space-y-2">
            <li>Install the app using the steps above.</li>
            <li>Open the installed app from your home screen and sign in once.</li>
            <li>
              From the home screen, tap <strong>Scan</strong> (or use the
              {' '}
              <Link to="/scan" className="text-primary underline">in-app scanner</Link>) to scan any
              bin or asset QR.
            </li>
            <li>
              You'll go straight to the adjustment screen — no re-login, as long as you scan from
              inside the installed app.
            </li>
          </ol>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Why this works</AlertTitle>
            <AlertDescription>
              When you scan a QR with your phone camera, the link often opens in a different browser
              that doesn't share your login. Scanning from inside the installed app keeps the
              session and skips the login step.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
