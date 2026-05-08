'use client';

import { useEffect, useState } from 'react';

type Status = 'checking' | 'online' | 'offline';

export default function ServiceStatusBadge({ url }: { url: string | null }) {
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    if (!url) {
      setStatus('offline');
      return;
    }

    let cancelled = false;

    async function check() {
      try {
        const res = await fetch(
          `/api/health?url=${encodeURIComponent(url!)}`,
          { cache: 'no-store' }
        );
        const data = await res.json();
        if (!cancelled) setStatus(data.ok ? 'online' : 'offline');
      } catch {
        if (!cancelled) setStatus('offline');
      }
    }

    check();
    const interval = setInterval(check, 15_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [url]);

  if (status === 'checking') {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-pulse" />
        Checking
      </span>
    );
  }

  if (status === 'online') {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Online
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-600">
      <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
      Offline
    </span>
  );
}
