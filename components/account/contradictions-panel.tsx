import { AlertTriangle } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { Contradiction } from '@/lib/scoring/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ContradictionsPanelProps {
  contradictions: Contradiction[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ContradictionsPanel({
  contradictions,
}: ContradictionsPanelProps) {
  if (contradictions.length === 0) {
    return null;
  }

  return (
    <Card className="border-amber-200 bg-amber-50/30">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-amber-600" />
          <CardTitle className="text-amber-800">
            Mixed Signals Detected
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {contradictions.map((contradiction, index) => (
            <div
              key={index}
              className="rounded-lg border border-amber-200 bg-white/60 p-3"
            >
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-amber-700">
                <span className="rounded bg-amber-100 px-1.5 py-0.5">
                  {contradiction.signal1}
                </span>
                <span className="text-amber-400">vs</span>
                <span className="rounded bg-amber-100 px-1.5 py-0.5">
                  {contradiction.signal2}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-amber-800">
                {contradiction.description}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
