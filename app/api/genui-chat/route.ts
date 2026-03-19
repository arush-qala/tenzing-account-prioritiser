// ---------------------------------------------------------------------------
// Generative UI Chat API Route — Thesys C1 (streaming, persistent threads)
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getGenuiClient } from '@/lib/ai/genui-client';
import { PORTFOLIO_SYSTEM_PROMPT } from '@/lib/ai/genui-chat';
import { transformStream } from '@crayonai/stream';
import { scoreAllAccounts } from '@/lib/scoring/engine';
import type { Account } from '@/lib/scoring/types';
import type OpenAI from 'openai';

export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Build data context string (embedded in system prompt)
// ---------------------------------------------------------------------------

async function buildDataContext(supabase: ReturnType<typeof createServerSupabaseClient>): Promise<string> {
  const { data: rawAccounts } = await supabase.from('accounts').select('*');
  const accounts = (rawAccounts ?? []) as Account[];
  const scored = scoreAllAccounts(accounts);

  const totalArr = accounts.reduce((sum, a) => sum + (a.arr_gbp ?? 0), 0);
  const totalExpansion = accounts.reduce((sum, a) => sum + (a.expansion_pipeline_gbp ?? 0), 0);
  const totalContraction = accounts.reduce((sum, a) => sum + (a.contraction_risk_gbp ?? 0), 0);

  const tierDist: Record<string, number> = {};
  const segmentArr: Record<string, { count: number; arr: number }> = {};
  const regionArr: Record<string, { count: number; arr: number }> = {};

  for (const { account, result: r } of scored) {
    tierDist[r.priorityTier] = (tierDist[r.priorityTier] ?? 0) + 1;

    if (!segmentArr[account.segment]) segmentArr[account.segment] = { count: 0, arr: 0 };
    segmentArr[account.segment].count++;
    segmentArr[account.segment].arr += account.arr_gbp ?? 0;

    if (!regionArr[account.region]) regionArr[account.region] = { count: 0, arr: 0 };
    regionArr[account.region].count++;
    regionArr[account.region].arr += account.arr_gbp ?? 0;
  }

  const accountRows = scored.map(({ account: a, result: r }) =>
    [
      a.account_name,
      a.segment,
      a.region,
      `£${Math.round(a.arr_gbp).toLocaleString()}`,
      r.priorityTier,
      r.priorityType,
      Math.round(r.calibratedScore * 10) / 10,
      Math.round(r.healthComposite * 10) / 10,
      a.days_to_renewal,
      a.lifecycle_stage,
      `£${Math.round(a.expansion_pipeline_gbp).toLocaleString()}`,
      `£${Math.round(a.contraction_risk_gbp).toLocaleString()}`,
      a.seats_used + '/' + a.seats_purchased,
      a.latest_nps ?? 'N/A',
      a.open_tickets_count,
      a.urgent_open_tickets_count,
    ].join(' | ')
  ).join('\n');

  return `
PORTFOLIO SUMMARY:
- Total Accounts: ${accounts.length}
- Total ARR: £${Math.round(totalArr).toLocaleString()}
- Total Expansion Pipeline: £${Math.round(totalExpansion).toLocaleString()}
- Total Contraction Risk: £${Math.round(totalContraction).toLocaleString()}
- Tier Distribution: ${Object.entries(tierDist).map(([k, v]) => `${k}: ${v}`).join(', ')}
- Segment Breakdown: ${Object.entries(segmentArr).map(([k, v]) => `${k}: ${v.count} accounts, £${Math.round(v.arr).toLocaleString()}`).join('; ')}
- Region Breakdown: ${Object.entries(regionArr).map(([k, v]) => `${k}: ${v.count} accounts, £${Math.round(v.arr).toLocaleString()}`).join('; ')}

ACCOUNT DATA (Name | Segment | Region | ARR | Tier | Type | Score | Health | DaysToRenewal | Stage | ExpansionPipeline | ContractionRisk | SeatsUsed/Purchased | NPS | OpenTickets | UrgentTickets):
${accountRows}`;
}

// ---------------------------------------------------------------------------
// Convert SDK messages to OpenAI format for the LLM
// ---------------------------------------------------------------------------
type SdkMessage = {
  id: string;
  role: 'user' | 'assistant';
  content?: string;
  message?: string | Array<{ type: string; text?: string }>;
};

function toOpenAIMessages(messages: SdkMessage[]): OpenAI.Chat.ChatCompletionMessageParam[] {
  return messages.map((m) => {
    let content = '';
    if (typeof m.content === 'string') {
      content = m.content;
    } else if (typeof m.message === 'string') {
      content = m.message;
    } else if (Array.isArray(m.message)) {
      content = m.message
        .filter((p) => p.type === 'text' && p.text)
        .map((p) => p.text)
        .join('\n');
    }
    return { role: m.role, content } as OpenAI.Chat.ChatCompletionMessageParam;
  });
}

// ---------------------------------------------------------------------------
// POST /api/genui-chat
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // 1. Auth
  const supabase = createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Parse request — C1Chat with threadManager sends { messages, threadId, responseId }
  const body = await req.json();
  const { messages: rawMessages, threadId, responseId, prompt } = body as {
    messages?: SdkMessage[];
    threadId: string;
    responseId: string;
    prompt?: SdkMessage;
  };

  if (!threadId) {
    return NextResponse.json({ error: 'threadId is required' }, { status: 400 });
  }

  // Build the conversation history for the LLM
  // When using threadManager, the SDK sends `messages` array
  // When using apiUrl directly, it sends `prompt` (single message)
  let conversationMessages: OpenAI.Chat.ChatCompletionMessageParam[];

  if (rawMessages && rawMessages.length > 0) {
    conversationMessages = toOpenAIMessages(rawMessages);
  } else if (prompt) {
    conversationMessages = toOpenAIMessages([prompt]);
  } else {
    return NextResponse.json({ error: 'messages or prompt required' }, { status: 400 });
  }

  // 3. Persist user message to DB
  const lastUserMsg = rawMessages
    ? rawMessages.filter((m) => m.role === 'user').pop()
    : prompt;

  if (lastUserMsg) {
    const userContent = typeof lastUserMsg.message === 'string'
      ? lastUserMsg.message
      : typeof lastUserMsg.content === 'string'
        ? lastUserMsg.content
        : '';

    await supabase.from('chat_messages').upsert({
      id: lastUserMsg.id,
      thread_id: threadId,
      role: 'user',
      content: { message: userContent },
    });

    // Update thread title from first message if it's still "New Chat"
    const { data: thread } = await supabase
      .from('chat_threads')
      .select('title')
      .eq('id', threadId)
      .single();

    if (thread?.title === 'New Chat' && userContent) {
      await supabase
        .from('chat_threads')
        .update({ title: userContent.slice(0, 60), updated_at: new Date().toISOString() })
        .eq('id', threadId);
    }
  }

  try {
    // 4. Fetch portfolio data and build context
    const dataContext = await buildDataContext(supabase);
    const systemPrompt = PORTFOLIO_SYSTEM_PROMPT + '\n\n' + dataContext;

    // 5. Streaming call to Thesys C1
    const client = getGenuiClient();
    const llmStream = await client.chat.completions.create({
      model: 'c1/anthropic/claude-sonnet-4/v-20251230',
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationMessages,
      ],
      stream: true,
    });

    // 6. Convert to Crayon stream format and persist assistant response on completion
    const responseStream = transformStream(
      llmStream,
      (chunk) => chunk.choices?.[0]?.delta?.content ?? '',
      {
        onEnd: async ({ accumulated }) => {
          const message = accumulated.filter((m) => m).join('');
          if (message) {
            // Persist assistant message to DB
            await supabase.from('chat_messages').upsert({
              id: responseId,
              thread_id: threadId,
              role: 'assistant',
              content: { message: [{ type: 'text', text: message }] },
            });

            // Update thread timestamp
            await supabase
              .from('chat_threads')
              .update({ updated_at: new Date().toISOString() })
              .eq('id', threadId);
          }
        },
      },
    ) as ReadableStream;

    return new NextResponse(responseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (err: unknown) {
    const errObj = err as Record<string, unknown>;
    console.error('[genui-chat] Error:', errObj?.message ?? String(err));
    console.error('[genui-chat] Status:', errObj?.status);
    const message = errObj?.message ? String(errObj.message) : 'Generative UI chat failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
