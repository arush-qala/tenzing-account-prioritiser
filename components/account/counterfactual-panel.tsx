import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ArrowUpCircle, ArrowDownCircle, Sparkles } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CounterfactualPanelProps {
  counterfactualUp: string | null;
  counterfactualDown: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CounterfactualPanel({
  counterfactualUp,
  counterfactualDown,
}: CounterfactualPanelProps) {
  const hasData = counterfactualUp !== null || counterfactualDown !== null;

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-purple-500" />
            <CardTitle>What-If Analysis</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <p className="text-sm text-muted-foreground">
              Run analysis to generate counterfactuals
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-purple-500" />
          <CardTitle>What-If Analysis</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Move UP in priority = account worsening = RED */}
          <div className="rounded-lg border-2 border-red-200 bg-red-50/50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <ArrowUpCircle className="size-5 text-red-600" />
              <h4 className="text-sm font-semibold text-red-800">
                Escalation Risk (Higher Priority Tier)
              </h4>
            </div>
            {counterfactualUp ? (
              <p className="text-sm leading-relaxed text-red-700">
                {counterfactualUp}
              </p>
            ) : (
              <p className="text-sm italic text-red-600/60">
                No escalation scenario available
              </p>
            )}
          </div>

          {/* Move DOWN in priority = account improving = GREEN */}
          <div className="rounded-lg border-2 border-green-200 bg-green-50/50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <ArrowDownCircle className="size-5 text-green-600" />
              <h4 className="text-sm font-semibold text-green-800">
                Path to Improvement (Lower Priority Tier)
              </h4>
            </div>
            {counterfactualDown ? (
              <p className="text-sm leading-relaxed text-green-700">
                {counterfactualDown}
              </p>
            ) : (
              <p className="text-sm italic text-green-600/60">
                No improvement scenario available
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
