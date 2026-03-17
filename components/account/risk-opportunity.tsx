import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ShieldAlert, Lightbulb, Sparkles } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RiskOpportunityProps {
  riskFactors: string[] | null;
  opportunityFactors: string[] | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RiskOpportunity({
  riskFactors,
  opportunityFactors,
}: RiskOpportunityProps) {
  const hasData =
    (riskFactors !== null && riskFactors.length > 0) ||
    (opportunityFactors !== null && opportunityFactors.length > 0);

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-amber-500" />
            <CardTitle>Risks &amp; Opportunities</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <Sparkles className="size-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Run AI analysis to identify risks and opportunities
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
          <ShieldAlert className="size-4 text-amber-500" />
          <CardTitle>Risks &amp; Opportunities</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Risk Factors */}
          <div className="space-y-2">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-red-600">
              <ShieldAlert className="size-3.5" />
              Risk Factors
            </h4>
            {riskFactors && riskFactors.length > 0 ? (
              <ul className="space-y-1.5">
                {riskFactors.map((risk, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm leading-snug"
                  >
                    <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-red-400" />
                    <span>{risk}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No risk factors identified
              </p>
            )}
          </div>

          {/* Opportunity Factors */}
          <div className="space-y-2">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-green-600">
              <Lightbulb className="size-3.5" />
              Opportunities
            </h4>
            {opportunityFactors && opportunityFactors.length > 0 ? (
              <ul className="space-y-1.5">
                {opportunityFactors.map((opp, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm leading-snug"
                  >
                    <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-green-500" />
                    <span>{opp}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No opportunities identified
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
