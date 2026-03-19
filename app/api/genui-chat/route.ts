// ---------------------------------------------------------------------------
// Generative UI Chat API Route — Thesys C1 (streaming, no tool calling)
// ---------------------------------------------------------------------------
// Matches the exact Thesys docs pattern: streaming create() + fromOpenAICompletion()
// Data is embedded in the system prompt instead of using tool calling.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getGenuiClient } from '@/lib/ai/genui-client';
import { PORTFOLIO_SYSTEM_PROMPT } from '@/lib/ai/genui-chat';
import { fromOpenAICompletion } from '@crayonai/stream';
import { scoreAllAccounts } from '@/lib/scoring/engine';
import type { Account } from '@/lib/scoring/types';
import type OpenAI from 'openai';

export const maxDuration = 60;

// ---------------------------------------------------------------------------
// In-memory message store (per thread)
// ---------------------------------------------------------------------------

type DBMessage = OpenAI.Chat.ChatCompletionMessageParam & { id?: string };

const threadStore: Record<string, DBMessage[]> = {};

function getStore(threadId: string) {
  if (!threadStore[threadId]) threadStore[threadId] = [];
  const messages = threadStore[threadId];
  return {
    addMessage: (msg: DBMessage) => {
      messages.push(msg);
    },
    getOpenAIMessages: (): OpenAI.Chat.ChatCompletionMessageParam[] =>
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      messages.map(({ id, ...rest }) => rest as OpenAI.Chat.ChatCompletionMessageParam),
  };
}

// ---------------------------------------------------------------------------
// Build data context string (embedded in system prompt)
// ---------------------------------------------------------------------------

async function buildDataContext(supabase: ReturnType<typeof createServerSupabaseClient>): Promise<string> {
  const { data: rawAccounts } = await supabase.from('accounts').select('*');
  const accounts = (rawAccounts ?? []) as Account[];
  const scored = scoreAllAccounts(accounts);

  // Portfolio summary
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

  // Account table (compact, one line per account)
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
// POST /api/genui-chat
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // 1. Auth
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Parse request (C1Chat sends { prompt, threadId, responseId })
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { prompt, threadId, responseId } = (await req.json()) as {
    prompt: DBMessage;
    threadId: string;
    responseId: string;
  };

  if (!prompt || !threadId) {
    return NextResponse.json(
      { error: 'prompt and threadId are required' },
      { status: 400 },
    );
  }

  // 3. Thread management
  const store = getStore(threadId);
  store.addMessage(prompt);

  try {
    // 4. Fetch portfolio data and build context
    const dataContext = await buildDataContext(supabase);
    const systemPrompt = PORTFOLIO_SYSTEM_PROMPT + '\n\n' + dataContext;

    // 5. Streaming call to Thesys C1 (matches docs pattern exactly)
    const client = getGenuiClient();
    const llmStream = await client.chat.completions.create({
      model: 'c1/anthropic/claude-sonnet-4/v-20251230',
      messages: [
        { role: 'system', content: systemPrompt },
        ...store.getOpenAIMessages(),
      ],
      stream: true,
    });

    // 6. Convert to Crayon stream format using the official helper
    const responseStream = fromOpenAICompletion(
      llmStream as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>,
    );

    return new NextResponse(responseStream as ReadableStream, {
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
