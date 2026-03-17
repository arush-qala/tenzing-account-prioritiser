import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { MessageSquare, AlertTriangle } from 'lucide-react';
import type { Account } from '@/lib/scoring/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NotesPanelProps {
  account: Account;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function vaderBadgeColor(score: number): string {
  if (score >= 0.3) return 'bg-green-100 text-green-800 border-green-200';
  if (score > -0.3) return 'bg-gray-100 text-gray-700 border-gray-200';
  return 'bg-red-100 text-red-800 border-red-200';
}

function formatVader(score: number): string {
  const sign = score >= 0 ? '+' : '';
  return `${sign}${score.toFixed(2)}`;
}

function sentimentHintColor(hint: Account['note_sentiment_hint']): string {
  switch (hint) {
    case 'Positive':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'Negative':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'Mixed':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'Neutral':
    default:
      return 'bg-gray-100 text-gray-600 border-gray-200';
  }
}

// ---------------------------------------------------------------------------
// Single Note Card
// ---------------------------------------------------------------------------

interface NoteCardProps {
  title: string;
  text: string | null;
  vaderScore: number | null;
  sentimentHint: Account['note_sentiment_hint'];
  showDisagreement: boolean;
}

function NoteCard({
  title,
  text,
  vaderScore,
  sentimentHint,
  showDisagreement,
}: NoteCardProps) {
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{title}</h4>
        <div className="flex items-center gap-1.5">
          {sentimentHint && (
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${sentimentHintColor(sentimentHint)}`}
            >
              {sentimentHint}
            </span>
          )}
          {vaderScore !== null && (
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tabular-nums ${vaderBadgeColor(vaderScore)}`}
            >
              VADER {formatVader(vaderScore)}
            </span>
          )}
          {showDisagreement && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                    <AlertTriangle className="size-3" />
                    Disagreement
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  VADER sentiment disagrees with the hand-labelled sentiment
                  hint. Manual review recommended.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
      {text ? (
        <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
      ) : (
        <p className="text-sm italic text-muted-foreground/60">
          No notes available
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function NotesPanel({ account }: NotesPanelProps) {
  const hasDisagreement = account.sentiment_disagreement === 1;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-indigo-500" />
          <CardTitle>Qualitative Notes</CardTitle>
          {account.note_sentiment_hint && (
            <Badge variant="secondary">
              Overall: {account.note_sentiment_hint}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <NoteCard
          title="Support Notes"
          text={account.recent_support_summary}
          vaderScore={account.support_sentiment_vader}
          sentimentHint={account.note_sentiment_hint}
          showDisagreement={
            hasDisagreement && account.support_sentiment_vader !== null
          }
        />
        <NoteCard
          title="Customer Notes"
          text={account.recent_customer_note}
          vaderScore={account.customer_sentiment_vader}
          sentimentHint={account.note_sentiment_hint}
          showDisagreement={
            hasDisagreement && account.customer_sentiment_vader !== null
          }
        />
        <NoteCard
          title="Sales Notes"
          text={account.recent_sales_note}
          vaderScore={account.sales_sentiment_vader}
          sentimentHint={account.note_sentiment_hint}
          showDisagreement={
            hasDisagreement && account.sales_sentiment_vader !== null
          }
        />
      </CardContent>
    </Card>
  );
}
