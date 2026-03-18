import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

interface ActivityItem {
  id: string;
  type: 'action' | 'task' | 'comment' | 'analysis';
  description: string;
  account_id: string;
  account_name: string;
  user_name: string | null;
  timestamp: string;
}

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const activities: ActivityItem[] = [];

  // Fetch recent actions
  const { data: actions } = await supabase
    .from('actions')
    .select('id, account_id, action_type, description, created_at, created_by, accounts!inner(account_name)')
    .order('created_at', { ascending: false })
    .limit(10);

  if (actions) {
    for (const row of actions) {
      const r = row as Record<string, unknown>;
      const acc = r.accounts as { account_name: string } | null;
      activities.push({
        id: `action-${r.id}`,
        type: 'action',
        description: `Recorded ${(r.action_type as string || 'action').replace(/_/g, ' ')}`,
        account_id: r.account_id as string,
        account_name: acc?.account_name || (r.account_id as string),
        user_name: null,
        timestamp: r.created_at as string,
      });
    }
  }

  // Fetch recent tasks
  const { data: tasks } = await supabase
    .from('user_tasks')
    .select('id, account_id, title, status, created_at, updated_at, accounts!inner(account_name)')
    .order('updated_at', { ascending: false })
    .limit(10);

  if (tasks) {
    for (const row of tasks) {
      const r = row as Record<string, unknown>;
      const acc = r.accounts as { account_name: string } | null;
      const status = r.status as string;
      const verb = status === 'done' ? 'Completed' : status === 'in_progress' ? 'Started' : 'Adopted';
      activities.push({
        id: `task-${r.id}`,
        type: 'task',
        description: `${verb}: ${(r.title as string).slice(0, 60)}`,
        account_id: r.account_id as string,
        account_name: acc?.account_name || (r.account_id as string),
        user_name: null,
        timestamp: (r.updated_at || r.created_at) as string,
      });
    }
  }

  // Fetch recent comments
  const { data: comments } = await supabase
    .from('comments')
    .select('id, account_id, content, created_at, profiles(display_name, email), accounts!inner(account_name)')
    .order('created_at', { ascending: false })
    .limit(10);

  if (comments) {
    for (const row of comments) {
      const r = row as Record<string, unknown>;
      const acc = r.accounts as { account_name: string } | null;
      const profile = r.profiles as { display_name: string | null; email: string | null } | null;
      const userName = profile?.display_name || profile?.email || null;
      activities.push({
        id: `comment-${r.id}`,
        type: 'comment',
        description: `"${(r.content as string).slice(0, 50)}${(r.content as string).length > 50 ? '...' : ''}"`,
        account_id: r.account_id as string,
        account_name: acc?.account_name || (r.account_id as string),
        user_name: userName,
        timestamp: r.created_at as string,
      });
    }
  }

  // Fetch recent AI analyses
  const { data: analyses } = await supabase
    .from('ai_analyses')
    .select('id, account_id, priority_tier, analysed_at, accounts!inner(account_name)')
    .order('analysed_at', { ascending: false })
    .limit(10);

  if (analyses) {
    for (const row of analyses) {
      const r = row as Record<string, unknown>;
      const acc = r.accounts as { account_name: string } | null;
      activities.push({
        id: `analysis-${r.id}`,
        type: 'analysis',
        description: `AI analysis completed (${r.priority_tier})`,
        account_id: r.account_id as string,
        account_name: acc?.account_name || (r.account_id as string),
        user_name: null,
        timestamp: r.analysed_at as string,
      });
    }
  }

  // Sort by timestamp descending and limit to 20
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return NextResponse.json(activities.slice(0, 20));
}
