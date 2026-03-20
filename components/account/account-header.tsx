import Link from 'next/link';
import { ArrowLeft, User, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { TierBadge } from '@/components/ui/tier-badge';
import { TypeBadge } from '@/components/ui/type-badge';
import { DataQualityBadge } from '@/components/ui/data-quality-badge';
import { AnomalyBadge } from '@/components/ui/anomaly-badge';
import type { Account, ScoringResult } from '@/lib/scoring/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AccountHeaderProps {
  account: Account;
  result: ScoringResult;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AccountHeader({ account, result }: AccountHeaderProps) {
  return (
    <div className="space-y-4">
      {/* Back link */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        Back to Dashboard
      </Link>

      {/* Main header row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          {/* Account name */}
          <h1 className="text-2xl font-bold tracking-tight">
            {account.account_name}
          </h1>

          {/* Industry */}
          <p className="text-sm text-muted-foreground">{account.industry}</p>

          {/* Metadata badges */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {account.segment}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {account.region}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {account.account_status}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {account.lifecycle_stage}
            </Badge>
          </div>
        </div>

        {/* Right side: tier, type, data quality, anomaly */}
        <div className="flex flex-wrap items-center gap-2">
          <TierBadge tier={result.priorityTier} size="md" />
          <TypeBadge type={result.priorityType} />
          <DataQualityBadge score={account.data_completeness_score} />
          <AnomalyBadge
            isAnomaly={account.is_anomaly === 1}
            score={account.anomaly_score}
          />
        </div>
      </div>

      {/* Owners row */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <User className="size-3.5" />
          <span className="font-medium text-foreground">Owner:</span>{' '}
          {account.account_owner}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Users className="size-3.5" />
          <span className="font-medium text-foreground">CSM:</span>{' '}
          {account.csm_owner}
        </span>
      </div>
    </div>
  );
}
