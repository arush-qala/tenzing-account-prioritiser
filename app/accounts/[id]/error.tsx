'use client';

import { useEffect } from 'react';

export default function AccountError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[AccountError] Full error:', error);
    // eslint-disable-next-line no-console
    console.error('[AccountError] Stack:', error.stack);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-8">
      <div className="max-w-xl rounded-lg border-2 border-red-300 bg-red-50 p-6">
        <h2 className="text-lg font-bold text-red-700">Account Page Error</h2>
        <p className="mt-2 text-sm text-red-600">{error.message}</p>
        <pre className="mt-3 max-h-60 overflow-auto rounded bg-red-100 p-3 text-xs text-red-800">
          {error.stack}
        </pre>
      </div>
    </div>
  );
}
