'use client';

import { useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  ClipboardCheck,
  Loader2,
  CheckCircle2,
  Star,
  History,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RecordedAction {
  id: string;
  action_type: string;
  description: string;
  ai_accuracy_rating: string | null;
  created_at: string;
}

interface ActionRecorderProps {
  accountId: string;
  existingActions: RecordedAction[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTION_TYPES = [
  { value: 'call_scheduled', label: 'Call Scheduled' },
  { value: 'escalation', label: 'Escalation' },
  { value: 'expansion_meeting', label: 'Expansion Meeting' },
  { value: 'qbr_booked', label: 'QBR Booked' },
  { value: 'note_added', label: 'Note Added' },
  { value: 'other', label: 'Other' },
] as const;

const ACCURACY_RATINGS = [
  { value: 'wrong', label: 'Wrong', color: 'bg-red-100 text-red-800 border-red-200' },
  { value: 'partially_right', label: 'Partially Right', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  { value: 'mostly_right', label: 'Mostly Right', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'spot_on', label: 'Spot On', color: 'bg-green-100 text-green-800 border-green-200' },
] as const;

const ACCURACY_MAP: Record<string, { label: string; color: string }> = {
  wrong: { label: 'Wrong', color: 'bg-red-100 text-red-800 border-red-200' },
  partially_right: { label: 'Partially Right', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  mostly_right: { label: 'Mostly Right', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  spot_on: { label: 'Spot On', color: 'bg-green-100 text-green-800 border-green-200' },
};

function formatActionType(type: string): string {
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActionRecorder({ accountId, existingActions }: ActionRecorderProps) {
  const [actions, setActions] = useState<RecordedAction[]>(existingActions);
  const [actionType, setActionType] = useState<string>('');
  const [description, setDescription] = useState('');
  const [accuracyRating, setAccuracyRating] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const canSubmit = actionType !== '' && description.trim() !== '' && accuracyRating !== '';

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: accountId,
          action_type: actionType,
          description: description.trim(),
          ai_accuracy_rating: accuracyRating,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(body.error ?? 'Failed to record action');
      }
      const data = await res.json();
      const newAction: RecordedAction = data.action ?? {
        id: crypto.randomUUID(),
        action_type: actionType,
        description: description.trim(),
        ai_accuracy_rating: accuracyRating,
        created_at: new Date().toISOString(),
      };
      setActions((prev) => [newAction, ...prev]);
      setActionType('');
      setDescription('');
      setAccuracyRating('');
      setFeedback({ type: 'success', message: 'Action recorded successfully' });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setSubmitting(false);
    }
  }, [accountId, actionType, description, accuracyRating, canSubmit]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ClipboardCheck className="size-4 text-emerald-500" />
          <CardTitle>Record Action</CardTitle>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* ---------- Form ---------- */}
        <div className="space-y-4">
          {/* Action Type */}
          <div className="space-y-1.5">
            <Label htmlFor="action-type">Action Type</Label>
            <Select value={actionType} onValueChange={(v) => setActionType(v ?? '')}>
              <SelectTrigger id="action-type" className="w-full">
                <SelectValue placeholder="Select action type..." />
              </SelectTrigger>
              <SelectContent>
                {ACTION_TYPES.map((at) => (
                  <SelectItem key={at.value} value={at.value}>
                    {at.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="action-description">Description</Label>
            <Textarea
              id="action-description"
              placeholder="Describe the action taken..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* AI Accuracy Rating - PROMINENT */}
          <div className="space-y-2 rounded-lg border-2 border-purple-200 bg-purple-50/50 p-3">
            <div className="flex items-center gap-2">
              <Star className="size-4 text-purple-600" />
              <Label htmlFor="accuracy-rating" className="text-sm font-semibold text-purple-800">
                AI Accuracy Rating
              </Label>
              <span className="text-[10px] font-medium text-purple-600">
                (Required)
              </span>
            </div>
            <p className="text-xs text-purple-700">
              How accurate was the AI recommendation for this account?
            </p>
            <Select value={accuracyRating} onValueChange={(v) => setAccuracyRating(v ?? '')}>
              <SelectTrigger id="accuracy-rating" className="w-full border-purple-300">
                <SelectValue placeholder="Rate AI accuracy..." />
              </SelectTrigger>
              <SelectContent>
                {ACCURACY_RATINGS.map((ar) => (
                  <SelectItem key={ar.value} value={ar.value}>
                    {ar.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="w-full"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-1.5 size-4 animate-spin" />
                Recording...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-1.5 size-4" />
                Record Action
              </>
            )}
          </Button>

          {/* Feedback */}
          {feedback && (
            <p
              className={`text-center text-xs font-medium ${
                feedback.type === 'success' ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {feedback.message}
            </p>
          )}
        </div>

        {/* ---------- History ---------- */}
        <Separator />

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <History className="size-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold">Action History</h4>
            <Badge variant="secondary">{actions.length}</Badge>
          </div>

          {actions.length === 0 ? (
            <p className="py-3 text-center text-sm text-muted-foreground">
              No actions recorded yet
            </p>
          ) : (
            <div className="space-y-2">
              {actions.map((action) => {
                const accuracy = action.ai_accuracy_rating
                  ? ACCURACY_MAP[action.ai_accuracy_rating]
                  : null;

                return (
                  <div
                    key={action.id}
                    className="rounded-lg border bg-card p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">
                            {formatActionType(action.action_type)}
                          </Badge>
                          {accuracy && (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${accuracy.color}`}
                            >
                              <Star className="size-2.5" />
                              {accuracy.label}
                            </span>
                          )}
                        </div>
                        <p className="text-sm leading-snug">
                          {action.description}
                        </p>
                      </div>
                      <time className="shrink-0 text-xs text-muted-foreground">
                        {formatTimestamp(action.created_at)}
                      </time>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
