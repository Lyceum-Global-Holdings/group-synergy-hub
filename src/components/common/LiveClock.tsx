import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { format } from 'date-fns';

/** Compact header clock (minute resolution — a ticking seconds display is distracting). */
export function LiveClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    // Align to the next minute, then tick every minute.
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 60_000);
    }, 60_000 - (Date.now() % 60_000));
    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex items-center gap-2 whitespace-nowrap text-sm text-muted-foreground" aria-label={format(now, "EEEE d MMMM yyyy, HH:mm")}>
      <Clock className="h-4 w-4" />
      <span className="font-semibold tabular-nums text-foreground">{format(now, 'HH:mm')}</span>
      <span className="text-xs">{format(now, 'EEE, dd MMM')}</span>
    </div>
  );
}
