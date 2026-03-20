'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, ClipboardList, CheckSquare, MessageSquare, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

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

export function NotificationBell() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/activity');
        if (res.ok) {
          const data: ActivityItem[] = await res.json();
          setActivities(data);

          // Check for unread based on localStorage timestamp
          const lastSeen = localStorage.getItem('activity_last_seen');
          if (data.length > 0) {
            if (!lastSeen || new Date(data[0].timestamp).getTime() > parseInt(lastSeen, 10)) {
              setHasUnread(true);
            }
          }
        }
      } finally {
        setLoaded(true);
      }
    }
    load();
  }, []);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      // Mark as read
      localStorage.setItem('activity_last_seen', Date.now().toString());
      setHasUnread(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon-sm" className="relative">
            <Bell className="size-4" />
            {hasUnread && (
              <span className="absolute top-0.5 right-0.5 size-2 rounded-full bg-red-500" />
            )}
          </Button>
        }
      />
      <SheetContent side="right" className="sm:max-w-sm">
        <SheetHeader>
          <SheetTitle>Recent Activity</SheetTitle>
          <SheetDescription>
            Latest actions, comments, and analyses across your portfolio.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {!loaded ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading...
            </p>
          ) : activities.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No activity yet. Analyse accounts, record actions, or post comments to see activity here.
            </p>
          ) : (
            <div className="space-y-3">
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
                          onClick={() => setOpen(false)}
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
