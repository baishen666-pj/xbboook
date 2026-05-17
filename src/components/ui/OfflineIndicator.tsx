import { useState, useEffect } from 'react';

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) {
    return (
      <span className="inline-flex items-center gap-1" aria-label="在线">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded bg-yellow-500/15 px-1.5 py-0.5" aria-label="离线模式">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
      <span className="text-[10px] text-yellow-400">离线模式</span>
    </span>
  );
}
