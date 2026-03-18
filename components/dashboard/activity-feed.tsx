'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Activity,
  CheckSquare,
  MessageSquare,
  Sparkles,
  ClipboardList,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActivityItem {
  id: string;
  type: 'action' | 'task' | 'comment' | 'analysis';
  description: string;
  account_id: string;
  account_name: string;
  user_name: string | null;
  timestamp: string;
}

const TYPE_CONFIG: Record<
  string,
  { icon: React.ElementType; color: string; bg: string }
> = {
  action: { icon: ClipboardList, color: 'text-blue-600', bg: 'bg-blue-100' },
  task: { icon: CheckSquare, color: 'text-green-600', bg: 'bg-green-100' },
  comment: { icon: MessageSquare, color: 'text-amber-600', bg: 'bg-amber-100' },
  analysis: { icon: Sparkles, color: 'text-purple-600', bg: 'bg-purple-100' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActivityFeed() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/activity');
        if (res.ok) {
          setActivities(await res.json());
        }
      } finally {
        setLoaded(true);
      }
    }
    load();
  }, []);

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-blue-500" />
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {!loaded ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Loading activity...
          </p>
        ) : activities.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No activity yet. Analyse accounts, record actions, or post comments
            to see activity here.
          </p>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {activities.map((item) => {
              const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.action;
              const Icon = config.icon;
              return (
                <div key={item.id} className="flex items-start gap-3">
                  <div
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full ${config.bg}`}
                  >
                    <Icon className={`size-3.5 ${config.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug">
                      {item.user_name && (
                        <span className="font-medium">{item.user_name} </span>
                      )}
                      <span className="text-muted-foreground">
                        {item.description}
                      </span>
                    </p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <Link
                        href={`/accounts/${item.account_id}`}
                        className="text-xs font-medium text-blue-600 hover:underline"
                      >
                        {item.account_name}
                      </Link>
                      <span className="text-[10px] text-muted-foreground">
                        {formatTime(item.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
