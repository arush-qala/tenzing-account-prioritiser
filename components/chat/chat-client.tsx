'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { NavHeader } from '@/components/nav-header';
import { createClient } from '@/lib/supabase/client';
import {
  C1Chat,
  ArtifactViewMode,
  useThreadListManager,
  useThreadManager,
} from '@thesysai/genui-sdk';
import '@crayonai/react-ui/styles/index.css';

// ---------------------------------------------------------------------------
// Types for DB records
// ---------------------------------------------------------------------------
type DbThread = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type DbMsg = {
  id: string;
  thread_id: string;
  role: 'user' | 'assistant';
  content: unknown;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Extract text content from stored message
// ---------------------------------------------------------------------------
function extractText(c: unknown): string {
  if (typeof c === 'string') return c;
  if (!c || typeof c !== 'object') return '';
  const obj = c as Record<string, unknown>;
  if (typeof obj.message === 'string') return obj.message;
  if (typeof obj.content === 'string') return obj.content;
  if (Array.isArray(obj.message)) {
    return (obj.message as Array<{ type?: string; text?: string }>)
      .filter((p) => p.type === 'text' && p.text)
      .map((p) => p.text)
      .join('\n');
  }
  return '';
}

// ---------------------------------------------------------------------------
// Convert DB messages to SDK format for loadThread
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbMsgToSdk(msg: DbMsg): any {
  const text = extractText(msg.content);

  if (msg.role === 'user') {
    // Strip <content thesys="true">...</content> wrapping for display
    const stripped = stripThesysTag(text);
    return {
      id: msg.id,
      role: 'user',
      type: 'prompt',
      message: stripped,
      content: stripped,
    };
  }

  // For assistant messages, the SDK needs the raw C1 DSL content string
  // (with thesys tags) to re-render generative UI components
  return {
    id: msg.id,
    role: 'assistant',
    message: [{ type: 'text', text }],
    content: text,
  };
}

function stripThesysTag(text: string): string {
  const match = text.match(/<content thesys="true">([\s\S]*)<\/content>/);
  return match ? match[1] : text;
}

function dbThreadToSdk(t: DbThread) {
  return {
    threadId: t.id,
    title: t.title,
    createdAt: new Date(t.created_at),
  };
}

// ---------------------------------------------------------------------------
// Chat UI Component — only rendered on the client (no SSR)
// ---------------------------------------------------------------------------
export default function ChatUI() {
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) setUserEmail(user.email);
    }
    loadUser();
  }, []);

  // Stable ref for selectedThreadId — avoids recreating onUpdateMessage callback
  const selectedThreadIdRef = useRef<string | null>(null);

  const threadListManager = useThreadListManager({
    fetchThreadList: useCallback(async () => {
      const res = await fetch('/api/threads');
      if (!res.ok) return [];
      const threads: DbThread[] = await res.json();
      return threads.map(dbThreadToSdk);
    }, []),

    createThread: useCallback(async (firstMsg) => {
      const threadId = crypto.randomUUID();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msgText = (firstMsg as any).message || (firstMsg as any).content || '';
      const title = typeof msgText === 'string' ? msgText.slice(0, 60) : 'New Chat';

      const res = await fetch('/api/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: threadId, title }),
      });

      if (!res.ok) throw new Error('Failed to create thread');
      return { threadId, title, createdAt: new Date() };
    }, []),

    deleteThread: useCallback(async (threadId: string) => {
      await fetch(`/api/threads/${threadId}`, { method: 'DELETE' });
    }, []),

    updateThread: useCallback(async (thread) => {
      await fetch(`/api/threads/${thread.threadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: thread.title }),
      });
      return thread;
    }, []),

    onSwitchToNew: useCallback(() => {}, []),
    onSelectThread: useCallback(() => {}, []),
  });

  // Keep ref in sync with selectedThreadId
  useEffect(() => {
    selectedThreadIdRef.current = threadListManager.selectedThreadId ?? null;
  }, [threadListManager.selectedThreadId]);

  const threadManager = useThreadManager({
    threadListManager,

    loadThread: useCallback(async (threadId: string) => {
      const res = await fetch(`/api/threads/${threadId}/messages`);
      if (!res.ok) return [];
      const messages: DbMsg[] = await res.json();
      return messages.map(dbMsgToSdk);
    }, []),

    // Stable callback — uses ref instead of dependency on selectedThreadId
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onUpdateMessage: useCallback(async ({ message }: { message: any }) => {
      const selectedId = selectedThreadIdRef.current;
      if (!selectedId) return;

      let content: unknown;
      if (message.role === 'user') {
        content = { message: message.message ?? message.content ?? '' };
      } else {
        content = { message: message.message ?? '' };
      }

      await fetch(`/api/threads/${selectedId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: message.id,
          role: message.role,
          content,
        }),
      });
    }, []),

    apiUrl: '/api/genui-chat',
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <NavHeader userEmail={userEmail} />

      <main
        className="flex-1 overflow-hidden"
        style={{ height: 'calc(100vh - 57px)' }}
      >
        <C1Chat
          threadListManager={threadListManager}
          threadManager={threadManager}
          formFactor="full-page"
          agentName="Portfolio Analyst"
          welcomeMessage={{
            title: 'Portfolio Analyst',
            description:
              'I help you identify which accounts need attention and what action to take. Ask about churn risk, expansion opportunities, renewal pipeline, or any cross-functional Sales and CS question.\n\n📊 Ask me to create charts, tables, or pull specific data \u2014 I can generate live visuals from your portfolio.',
          }}
          conversationStarters={{
            variant: 'long',
            options: [
              {
                displayText: 'Which accounts have the highest churn risk?',
                prompt:
                  'Which accounts have the highest churn risk this quarter? Show them in a table with ARR at stake, days to renewal, and health score',
              },
              {
                displayText: 'Biggest expansion opportunities by ARR',
                prompt:
                  'Where are the biggest expansion opportunities? Show me accounts with high expansion pipeline relative to their current ARR in a bar chart',
              },
              {
                displayText: 'Renewal pipeline with risk assessment',
                prompt:
                  'Show me the renewal pipeline for the next 90 days with risk assessment, sorted by ARR at risk',
              },
              {
                displayText: 'Portfolio health across segments',
                prompt:
                  'Compare portfolio health across Enterprise, Mid-Market, and SMB segments with a breakdown of tier distribution',
              },
            ],
          }}
          customizeC1={{
            artifactViewMode: ArtifactViewMode.AUTO_OPEN,
          }}
        />
      </main>
    </div>
  );
}
