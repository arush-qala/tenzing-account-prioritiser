'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function AnalyseAllButton({ analysedCount, totalCount }: { analysedCount: number; totalCount: number }) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<{ analysed: number; failed: number } | null>(null);
  const router = useRouter();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function startPolling() {
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
    setProgress(null);
  }

  const allAnalysed = analysedCount >= totalCount;

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
            {progress !== null
              ? `Analysing... ${progress}/${totalCount}`
              : `Analysing ${totalCount} accounts...`}
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-3 w-3" />
            {allAnalysed ? 'Re-analyse All' : `Analyse All (${totalCount - analysedCount} remaining)`}
          </>
        )}
      </Button>
    </div>
  );
}
