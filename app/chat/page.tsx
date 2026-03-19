'use client';

import { useEffect, useState, useCallback } from 'react';
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

type TextPart = { type: 'text'; text: string };
type TemplatePart = { type: 'template'; name: string; templateProps: unknown };
type MsgPart = TextPart | TemplatePart;

// ---------------------------------------------------------------------------
// Helpers to convert between DB records and SDK types
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbMsgToSdk(msg: DbMsg): any {
  if (msg.role === 'user') {
    return {
      id: msg.id,
      role: 'user',
      type: 'prompt',
      message:
        typeof msg.content === 'string'
          ? msg.content
          : (msg.content as { message?: string })?.message ?? '',
    };
  }

  // assistant
  const content = msg.content as { message?: unknown } | unknown;
  let parts: MsgPart[];

  if (typeof content === 'string') {
    parts = [{ type: 'text', text: content }];
  } else if (Array.isArray(content)) {
    parts = content;
  } else if (content && typeof content === 'object' && 'message' in content) {
    const inner = (content as { message: unknown }).message;
    if (Array.isArray(inner)) {
      parts = inner;
    } else if (typeof inner === 'string') {
      parts = [{ type: 'text', text: inner }];
    } else {
      parts = [{ type: 'text', text: JSON.stringify(inner) }];
    }
  } else {
    parts = [{ type: 'text', text: JSON.stringify(content) }];
  }

  return { id: msg.id, role: 'assistant', message: parts };
}

function dbThreadToSdk(t: DbThread) {
  return {
    threadId: t.id,
    title: t.title,
    createdAt: new Date(t.created_at),
  };
}

// ---------------------------------------------------------------------------
// Save a message to the DB (fire-and-forget)
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function persistMsg(threadId: string, msg: any) {
  const content =
    msg.role === 'user'
      ? { message: msg.message ?? '' }
      : { message: msg.message ?? '' };

  await fetch(`/api/threads/${threadId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: msg.id, role: msg.role, content }),
  });
}

// ---------------------------------------------------------------------------
// Chat Page Component
// ---------------------------------------------------------------------------
export default function ChatPage() {
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

  // ---------------------------------------------------------------------------
  // Thread List Manager — connects sidebar to our API
  // ---------------------------------------------------------------------------
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
      const title = (firstMsg as any).message?.slice(0, 60) || 'New Chat';

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

  // ---------------------------------------------------------------------------
  // Thread Manager — connects message state to our API
  // ---------------------------------------------------------------------------
  const threadManager = useThreadManager({
    threadListManager,

    loadThread: useCallback(async (threadId: string) => {
      const res = await fetch(`/api/threads/${threadId}/messages`);
      if (!res.ok) return [];
      const messages: DbMsg[] = await res.json();
      return messages.map(dbMsgToSdk);
    }, []),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onUpdateMessage: useCallback(({ message }: { message: any }) => {
      const selectedId = threadListManager.selectedThreadId;
      if (selectedId && message.role === 'assistant') {
        persistMsg(selectedId, message);
      }
    }, [threadListManager.selectedThreadId]),

    apiUrl: '/api/genui-chat',

    customizeC1: {
      artifactViewMode: ArtifactViewMode.AUTO_OPEN,
    },
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
              'I help you identify which accounts need attention and what action to take. Ask about churn risk, expansion opportunities, renewal pipeline, or any cross-functional Sales and CS question.',
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
