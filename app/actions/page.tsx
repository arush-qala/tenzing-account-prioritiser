'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { NavHeader } from '@/components/nav-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CheckSquare,
  Circle,
  ArrowRight,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Sparkles,
  Clock,
  User,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserTask {
  id: string;
  account_id: string;
  title: string;
  description: string | null;
  source: string;
  source_rationale: string | null;
  owner_suggestion: string | null;
  timeframe: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  accounts: { account_name: string };
}

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string }
> = {
  open: { label: 'Open', icon: Circle, color: 'text-blue-500' },
  in_progress: { label: 'In Progress', icon: ArrowRight, color: 'text-amber-500' },
  done: { label: 'Done', icon: CheckCircle2, color: 'text-green-500' },
  dismissed: { label: 'Dismissed', icon: XCircle, color: 'text-gray-400' },
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ActionsPage() {
  const [tasks, setTasks] = useState<UserTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('active');
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) setUserEmail(user.email);

      const res = await fetch('/api/tasks');
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
      setLoading(false);
    }
    loadData();
  }, []);

  async function updateStatus(taskId: string, newStatus: string) {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
      );
    }
  }

  const filtered = tasks.filter((t) => {
    if (statusFilter === 'active') return t.status === 'open' || t.status === 'in_progress';
    if (statusFilter === 'all') return true;
    return t.status === statusFilter;
  });

  // Group by account
  const grouped = filtered.reduce<Record<string, UserTask[]>>((acc, task) => {
    const name = task.accounts?.account_name || task.account_id;
    if (!acc[name]) acc[name] = [];
    acc[name].push(task);
    return acc;
  }, {});

  const counts = {
    active: tasks.filter((t) => t.status === 'open' || t.status === 'in_progress').length,
    done: tasks.filter((t) => t.status === 'done').length,
    total: tasks.length,
  };

  return (
    <div className="min-h-screen bg-background">
      <NavHeader userEmail={userEmail} />

      <main className="mx-auto max-w-[1400px] px-6 py-6">
        <div className="flex flex-col gap-6">
          {/* Page header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">My Actions</h2>
              <p className="text-sm text-muted-foreground">
                Tasks adopted from AI recommendations across your portfolio
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-medium text-blue-600">{counts.active} active</span>
                <span>|</span>
                <span className="text-green-600">{counts.done} done</span>
                <span>|</span>
                <span>{counts.total} total</span>
              </div>
              <Select value={statusFilter} onValueChange={(v) => { if (v) setStatusFilter(v); }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                  <SelectItem value="dismissed">Dismissed</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tasks grouped by account */}
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading actions...
            </div>
          ) : Object.keys(grouped).length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12">
                <CheckSquare className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No actions yet. Visit an account page and adopt AI recommendations.
                </p>
                <Link href="/dashboard">
                  <Button variant="outline" size="sm">
                    Go to Dashboard
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            Object.entries(grouped).map(([accountName, accountTasks]) => (
              <Card key={accountName}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {accountName}
                    </CardTitle>
                    <Link href={`/accounts/${accountTasks[0].account_id}`}>
                      <Button variant="ghost" size="sm" className="text-xs">
                        View Account
                        <ExternalLink className="ml-1 size-3" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {accountTasks.map((task) => {
                      const config = STATUS_CONFIG[task.status] || STATUS_CONFIG.open;
                      const StatusIcon = config.icon;
                      return (
                        <div
                          key={task.id}
                          className="flex items-start gap-3 rounded-lg border p-3"
                        >
                          <StatusIcon className={`mt-0.5 size-4 shrink-0 ${config.color}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium leading-snug">
                              {task.title}
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2">
                              {task.source === 'ai_recommendation' && (
                                <Badge variant="secondary" className="text-[10px]">
                                  <Sparkles className="mr-0.5 size-2.5" />
                                  AI Rec
                                </Badge>
                              )}
                              {task.owner_suggestion && (
                                <Badge variant="outline" className="text-[10px]">
                                  <User className="mr-0.5 size-2.5" />
                                  {task.owner_suggestion}
                                </Badge>
                              )}
                              {task.timeframe && (
                                <Badge variant="outline" className="text-[10px]">
                                  <Clock className="mr-0.5 size-2.5" />
                                  {task.timeframe}
                                </Badge>
                              )}
                            </div>
                            {task.source_rationale && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {task.source_rationale}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 gap-1">
                            {task.status === 'open' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => updateStatus(task.id, 'in_progress')}
                              >
                                Start
                              </Button>
                            )}
                            {task.status === 'in_progress' && (
                              <Button
                                size="sm"
                                variant="default"
                                className="h-7 text-xs"
                                onClick={() => updateStatus(task.id, 'done')}
                              >
                                Done
                              </Button>
                            )}
                            {(task.status === 'open' || task.status === 'in_progress') && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-muted-foreground"
                                onClick={() => updateStatus(task.id, 'dismissed')}
                              >
                                Dismiss
                              </Button>
                            )}
                            {task.status === 'done' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-muted-foreground"
                                onClick={() => updateStatus(task.id, 'open')}
                              >
                                Reopen
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
