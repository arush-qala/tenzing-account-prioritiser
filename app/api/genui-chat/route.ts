// ---------------------------------------------------------------------------
// Generative UI Chat API Route — Thesys C1 + manual tool calling
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getGenuiClient } from '@/lib/ai/genui-client';
import { PORTFOLIO_SYSTEM_PROMPT, buildGenuiTools } from '@/lib/ai/genui-chat';
import { crayonStream } from '@crayonai/stream';
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

  // 4. Build tools
  const client = getGenuiClient();
  const rawTools = buildGenuiTools(supabase);

  // Separate: API-facing tool definitions vs local implementations
  const toolDefs = rawTools.map((t) => ({
    type: t.type,
    function: {
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters,
    },
  }));

  const toolImpls: Record<string, (args: Record<string, unknown>) => Promise<string>> = {};
  for (const t of rawTools) {
    toolImpls[t.function.name] = t.function.function as (args: Record<string, unknown>) => Promise<string>;
  }

  try {
    // 5. Manual tool-calling loop (non-streaming)
    const allMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: PORTFOLIO_SYSTEM_PROMPT },
      ...store.getOpenAIMessages(),
    ];

    const MAX_TOOL_ROUNDS = 5;
    let finalContent = '';

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await client.chat.completions.create({
        model: 'c1/anthropic/claude-sonnet-4/v-20251230',
        messages: allMessages,
        tools: toolDefs as OpenAI.Chat.ChatCompletionTool[],
      });

      const choice = response.choices[0];
      const message = choice.message;

      // No tool calls — we have the final response
      if (!message.tool_calls?.length) {
        finalContent = message.content || '';
        break;
      }

      // Append the assistant message (with tool_calls) to history
      const toolCalls = message.tool_calls as Array<{
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }>;
      allMessages.push({
        role: 'assistant',
        content: message.content || '',
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.function.name, arguments: tc.function.arguments },
        })),
      });

      // Execute each tool call and append results
      for (const tc of toolCalls) {
        const impl = toolImpls[tc.function.name];
        if (!impl) {
          allMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify({ error: `Unknown tool: ${tc.function.name}` }),
          });
          continue;
        }

        const args = JSON.parse(tc.function.arguments || '{}');
        const result = await impl(args);
        allMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: result,
        });
      }
    }

    // 6. Store the assistant response
    if (finalContent) {
      store.addMessage({ role: 'assistant', content: finalContent, id: responseId });
    }

    // 7. Wrap in Crayon stream format (C1Chat expects text/event-stream)
    const { stream, onText, onEnd, onLLMEnd } = crayonStream();
    onText(finalContent);
    onLLMEnd();
    onEnd();

    return new NextResponse(stream as ReadableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (err: unknown) {
    // Log full error details for debugging
    const errObj = err as Record<string, unknown>;
    console.error('[genui-chat] Error type:', typeof err);
    console.error('[genui-chat] Error message:', errObj?.message ?? String(err));
    console.error('[genui-chat] Error status:', errObj?.status);
    console.error('[genui-chat] Error body:', JSON.stringify(errObj?.error ?? errObj?.body ?? ''));
    const message = errObj?.message ? String(errObj.message) : 'Generative UI chat failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
