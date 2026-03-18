// ---------------------------------------------------------------------------
// Generative UI Chat API Route — Thesys C1 + tool calling
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getGenuiClient } from '@/lib/ai/genui-client';
import { PORTFOLIO_SYSTEM_PROMPT, buildGenuiTools } from '@/lib/ai/genui-chat';
import { transformStream } from '@crayonai/stream';
import type OpenAI from 'openai';

export const maxDuration = 60;

// ---------------------------------------------------------------------------
// In-memory message store (per thread). Sufficient for demo; production
// would persist to Supabase.
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

  // 4. Build tools with Supabase access
  const client = getGenuiClient();
  const tools = buildGenuiTools(supabase);

  try {
    // 5. Call C1 with tool calling + streaming
    const runner = client.chat.completions.runTools({
      model: 'c1-nightly',
      messages: [
        { role: 'system', content: PORTFOLIO_SYSTEM_PROMPT },
        ...store.getOpenAIMessages(),
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: tools as any,
      stream: true,
    });

    // 6. Transform to Crayon stream format
    const responseStream = transformStream(
      runner as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>,
      (chunk) => chunk.choices[0]?.delta?.content,
      {
        onEnd: ({ accumulated }) => {
          const message = accumulated.filter(Boolean).join('');
          if (message) {
            store.addMessage({
              role: 'assistant',
              content: message,
              id: responseId,
            });
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
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generative UI chat failed';
    console.error('[genui-chat]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
