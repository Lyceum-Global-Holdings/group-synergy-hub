import { Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { usePwaInstall } from '@/hooks/usePwaInstall';

/**
 * Compact header chip that takes the user to the install page.
 * Hidden when the app is already running as an installed PWA.
 */
export function InstallAppButton() {
  const { installed } = usePwaInstall();
  if (installed) return null;
  return (
    <Button asChild variant="outline" size="sm" className="h-8 gap-1.5">
      <Link to="/install" aria-label="Install Lyceum ERP as an app">
        <Download className="h-3.5 w-3.5" />
        <span className="hidden md:inline">Install app</span>
      </Link>
    </Button>
  );
}
