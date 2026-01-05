import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { format } from 'date-fns';

export function LiveClock() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Clock className="h-4 w-4" />
      <span className="font-medium">
        {format(currentTime, 'HH:mm:ss')}
      </span>
      <span className="text-xs hidden sm:inline">
        {format(currentTime, 'EEE, dd MMM yyyy')}
      </span>
    </div>
  );
}
