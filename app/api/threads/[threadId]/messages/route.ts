// ---------------------------------------------------------------------------
// Thread Messages API — GET (load messages) / POST (save message)
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: { threadId: string } },
) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: messages, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('thread_id', params.threadId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(messages ?? []);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { threadId: string } },
) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, role, content } = await req.json();

  const { error } = await supabase
    .from('chat_messages')
    .upsert({ id, thread_id: params.threadId, role, content });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update thread's updated_at timestamp
  await supabase
    .from('chat_threads')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', params.threadId);

  return NextResponse.json({ ok: true });
}
