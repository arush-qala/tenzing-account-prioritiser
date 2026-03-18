import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getAnthropicClient } from '@/lib/ai/client';
import { buildChatSystemPrompt } from '@/lib/ai/chat';
import { scoreAllAccounts } from '@/lib/scoring/engine';
import type { Account } from '@/lib/scoring/types';

export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { account_id, messages } = body;

  if (!account_id || !messages || !Array.isArray(messages)) {
    return NextResponse.json(
      { error: 'account_id and messages are required' },
      { status: 400 },
    );
  }

  // Fetch account data
  const { data: rawAccounts } = await supabase.from('accounts').select('*');
  const accounts = (rawAccounts ?? []) as Account[];
  const scoredResults = scoreAllAccounts(accounts);
  const match = scoredResults.find(({ account }) => account.account_id === account_id);

  if (!match) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  // Fetch AI analysis if exists
  const { data: analysisRow } = await supabase
    .from('ai_analyses')
    .select('*')
    .eq('account_id', account_id)
    .order('analysed_at', { ascending: false })
    .limit(1)
    .single();

  const systemPrompt = buildChatSystemPrompt(
    match.account,
    match.result,
    analysisRow as Record<string, unknown> | null,
  );

  // Build conversation for Claude
  const claudeMessages = messages.map((msg: { role: string; content: string }) => ({
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
  }));

  try {
    const anthropic = getAnthropicClient();

    // Use streaming
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: claudeMessages,
    });

    // Convert to ReadableStream for Next.js
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI chat failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
