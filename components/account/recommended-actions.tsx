'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, ClipboardList, Clock, User, Plus, Check } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RecommendedAction {
  action: string;
  owner: string;
  timeframe: string;
  rationale: string;
}

interface RecommendedActionsProps {
  actions: RecommendedAction[] | null;
  accountId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RecommendedActions({ actions, accountId }: RecommendedActionsProps) {
  const [adoptedIndexes, setAdoptedIndexes] = useState<Set<number>>(new Set());
  const [loadingIndex, setLoadingIndex] = useState<number | null>(null);

  async function handleAdopt(action: RecommendedAction, index: number) {
    setLoadingIndex(index);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: accountId,
          title: action.action,
          description: action.action,
          source: 'ai_recommendation',
          source_rationale: action.rationale,
          owner_suggestion: action.owner,
          timeframe: action.timeframe,
        }),
      });

      if (res.ok) {
        setAdoptedIndexes((prev) => new Set(prev).add(index));
      }
    } finally {
      setLoadingIndex(null);
    }
  }

  if (!actions || actions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ClipboardList className="size-4 text-blue-500" />
            <CardTitle>Recommended Actions</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <Sparkles className="size-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Run AI analysis to get recommendations
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
          <ClipboardList className="size-4 text-blue-500" />
          <CardTitle>Recommended Actions</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {actions.map((action, index) => {
            const adopted = adoptedIndexes.has(index);
            return (
              <div
                key={index}
                className="rounded-lg border bg-card p-3"
              >
                <div className="flex items-start gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="text-sm font-semibold leading-snug">
                      {action.action}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        <User className="size-3" />
                        {action.owner}
                      </Badge>
                      <Badge variant="outline">
                        <Clock className="size-3" />
                        {action.timeframe}
                      </Badge>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {action.rationale}
                    </p>
                    <Button
                      size="sm"
                      variant={adopted ? 'secondary' : 'outline'}
                      className="mt-1 h-7 text-xs"
                      disabled={adopted || loadingIndex === index}
                      onClick={() => handleAdopt(action, index)}
                    >
                      {adopted ? (
                        <>
                          <Check className="mr-1 size-3" />
                          Added to My Actions
                        </>
                      ) : loadingIndex === index ? (
                        'Adding...'
                      ) : (
                        <>
                          <Plus className="mr-1 size-3" />
                          Add to My Actions
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
