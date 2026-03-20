'use client';

import Link from 'next/link';
import { formatCurrency } from '@/lib/utils/format';
import type { Account, ScoringResult } from '@/lib/scoring/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { TierBadge } from '@/components/ui/tier-badge';

interface SummaryDrillDownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  accounts: Array<{ account: Account; result: ScoringResult }>;
  valueAccessor?: (item: { account: Account; result: ScoringResult }) => string;
}

export function SummaryDrillDown({
  open,
  onOpenChange,
  title,
  description,
  accounts,
  valueAccessor,
}: SummaryDrillDownProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {accounts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No accounts in this category.
            </p>
          ) : (
            <div className="space-y-1">
              <p className="mb-3 text-xs text-muted-foreground">
                {accounts.length} account{accounts.length !== 1 ? 's' : ''}
              </p>
              {accounts.map(({ account, result }) => (
                <Link
                  key={account.account_id}
                  href={`/accounts/${account.account_id}`}
                  onClick={() => onOpenChange(false)}
                  className="flex items-center justify-between rounded-md px-3 py-2.5 transition-colors hover:bg-muted"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {account.account_name}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <TierBadge tier={result.priorityTier} size="sm" />
                      {account.days_to_renewal <= 90 && (
                        <span className="text-[10px] text-muted-foreground">
                          {account.days_to_renewal}d to renewal
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="ml-3 text-right shrink-0">
                    <p className="text-sm font-semibold tabular-nums">
                      {valueAccessor
                        ? valueAccessor({ account, result })
                        : formatCurrency(account.arr_gbp)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
