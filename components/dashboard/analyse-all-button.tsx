'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';

function formatEta(seconds: number): string {
  if (seconds <= 0) return 'almost done';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m > 0) return `~${m}m ${s}s remaining`;
  return `~${s}s remaining`;
}

export function AnalyseAllButton({ analysedCount, totalCount }: { analysedCount: number; totalCount: number }) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [result, setResult] = useState<{ analysed: number; failed: number } | null>(null);
  const router = useRouter();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function startPolling() {
    startTimeRef.current = Date.now();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/analyse-all/progress');
        if (res.ok) {
          const data = await res.json();
          setProgress(data.completed ?? 0);
        }
      } catch {
        // Ignore polling errors
      }
    }, 3000);
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function getEta(): string {
    if (progress <= 0) return '~1m remaining';
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    const perAccount = elapsed / progress;
    const remaining = (totalCount - progress) * perAccount;
    return formatEta(remaining);
  }

  const allAnalysed = analysedCount >= totalCount;
  const pct = totalCount > 0 ? Math.round((progress / totalCount) * 100) : 0;

  async function handleClick() {
    setLoading(true);
    setResult(null);
    setProgress(0);
    startPolling();
    try {
      const res = await fetch('/api/analyse-all', { method: 'POST' });
      const data = await res.json();
      setResult({ analysed: data.analysed ?? 0, failed: data.failed ?? 0 });
      router.refresh();
    } catch {
      setResult({ analysed: 0, failed: -1 });
    } finally {
      stopPolling();
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {result && result.failed === -1 && (
          <span className="text-xs text-red-600">Error running analysis</span>
        )}
        {result && result.failed >= 0 && (
          <span className="text-xs text-muted-foreground">
            Analysed {result.analysed} accounts{result.failed > 0 ? `, ${result.failed} failed` : ''}
          </span>
        )}
        <Button
          onClick={handleClick}
          disabled={loading}
          variant={allAnalysed ? 'outline' : 'default'}
          size="sm"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              Analysing...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-3 w-3" />
              {allAnalysed ? 'Re-run AI Analysis' : `Run AI Analysis (${totalCount - analysedCount} remaining)`}
            </>
          )}
        </Button>
      </div>

      {/* Progress bar */}
      {loading && (
        <div className="w-full max-w-xs ml-auto">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-purple-500 transition-all duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground text-right">
            {progress} of {totalCount} accounts — {getEta()}
          </p>
        </div>
      )}
    </div>
  );
}
