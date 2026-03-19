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
// Helpers for message format conversion
// ---------------------------------------------------------------------------

type DbMsg = {
  role: string;
  content: unknown;
};

/** Strip <content thesys="true">...</content> wrapping */
function stripThesysTag(text: string): string {
  const match = text.match(/<content thesys="true">([\s\S]*)<\/content>/);
  return match ? match[1] : text;
}

/**
 * Extract readable text from Thesys C1 DSL JSON.
 * Walks the component tree and pulls out textMarkdown, title, subtitle,
 * description, label, amount, and table data.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractTextFromDSL(obj: any): string {
  const parts: string[] = [];

  function walk(node: unknown) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const n = node as Record<string, unknown>;
    // Extract text content fields
    for (const key of ['textMarkdown', 'title', 'subtitle', 'description', 'label', 'amount', 'heading']) {
      if (typeof n[key] === 'string' && n[key]) {
        parts.push(n[key] as string);
      }
    }
    // Recurse into children, props, lhs, rhs, etc.
    for (const key of ['props', 'children', 'lhs', 'rhs', 'child', 'component']) {
      if (n[key] && typeof n[key] === 'object') {
        walk(n[key]);
      }
    }
  }

  walk(obj);
  return parts.join('. ') || '[Previous assistant response with charts/tables]';
}

/** Convert a DB message to OpenAI format for LLM history, stripping Thesys DSL */
function dbMsgToOpenAI(msg: DbMsg): OpenAI.Chat.ChatCompletionMessageParam {
  let content = '';
  const c = msg.content;

  if (typeof c === 'string') {
    content = c;
  } else if (c && typeof c === 'object') {
    const obj = c as Record<string, unknown>;
    if (typeof obj.message === 'string') {
      content = obj.message;
    } else if (Array.isArray(obj.message)) {
      content = (obj.message as Array<{ type?: string; text?: string }>)
        .filter((p) => p.type === 'text' && p.text)
        .map((p) => p.text)
        .join('\n');
    } else if (typeof obj.content === 'string') {
      content = obj.content;
    }
  }

  // Strip <content thesys="true">...</content> wrapping
  content = stripThesysTag(content);

  // For assistant messages, if content is Thesys DSL JSON, extract just the text
  if (msg.role === 'assistant' && content.startsWith('{')) {
    try {
      const parsed = JSON.parse(content);
      content = extractTextFromDSL(parsed);
    } catch {
      // Not valid JSON, use as-is
    }
  }

  return { role: msg.role as 'user' | 'assistant', content };
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

  // 2. Parse request — C1Chat with apiUrl sends { prompt, threadId, responseId }
  const body = await req.json();
  const { prompt, threadId, responseId } = body as {
    prompt: { role: string; content: string; id?: string };
    threadId: string;
    responseId: string;
  };

  if (!threadId) {
    return NextResponse.json({ error: 'threadId is required' }, { status: 400 });
  }

  if (!prompt) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }

  // 3. Persist user message to DB
  const userContent = typeof prompt.content === 'string' ? prompt.content : '';
  const userMsgId = prompt.id ?? crypto.randomUUID();

  await supabase.from('chat_messages').upsert({
    id: userMsgId,
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
    const cleanTitle = stripThesysTag(userContent).slice(0, 60);
    await supabase
      .from('chat_threads')
      .update({ title: cleanTitle, updated_at: new Date().toISOString() })
      .eq('id', threadId);
  }

  try {
    // 4. Load conversation history from DB
    const { data: dbMessages } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });

    const historyMessages: OpenAI.Chat.ChatCompletionMessageParam[] =
      (dbMessages ?? []).map(dbMsgToOpenAI);

    // 5. Fetch portfolio data and build context
    const dataContext = await buildDataContext(supabase);
    const systemPrompt = PORTFOLIO_SYSTEM_PROMPT + '\n\n' + dataContext;

    // 6. Streaming call to Thesys C1
    const client = getGenuiClient();
    const llmStream = await client.chat.completions.create({
      model: 'c1/anthropic/claude-sonnet-4/v-20251230',
      messages: [
        { role: 'system', content: systemPrompt },
        ...historyMessages,
      ],
      stream: true,
    });

    // 7. Transform stream and persist assistant response on completion
    // Note: onUpdateMessage on the client also persists via /api/threads/{id}/messages
    // so server-side persistence here is a backup
    const responseStream = transformStream(
      llmStream,
      (chunk) => chunk.choices[0]?.delta?.content,
      {
        onEnd: async ({ accumulated }) => {
          const message = accumulated.filter((m) => m).join('');
          if (message) {
            try {
              await supabase.from('chat_messages').upsert({
                id: responseId,
                thread_id: threadId,
                role: 'assistant',
                content: { message: [{ type: 'text', text: message }] },
              });

              await supabase
                .from('chat_threads')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', threadId);
            } catch (e) {
              console.error('[genui-chat] Failed to persist assistant message:', e);
            }
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
