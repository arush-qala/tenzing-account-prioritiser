// ---------------------------------------------------------------------------
// Single Thread API — PATCH (update title) / DELETE
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { threadId: string } },
) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { title } = await req.json();

  const { data: thread, error } = await supabase
    .from('chat_threads')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', params.threadId)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(thread);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { threadId: string } },
) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await supabase
    .from('chat_threads')
    .delete()
    .eq('id', params.threadId)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
