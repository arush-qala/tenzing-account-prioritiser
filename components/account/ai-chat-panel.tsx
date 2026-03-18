'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageSquare, Send, Trash2, Bot, User, X } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AiChatPanelProps {
  accountId: string;
  accountName: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AiChatPanel({ accountId, accountName }: AiChatPanelProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streaming]);

  async function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setStreaming(true);

    setMessages([...newMessages, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: accountId,
          messages: newMessages,
        }),
      });

      if (!res.ok || !res.body) {
        setMessages([
          ...newMessages,
          { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
        ]);
        setStreaming(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages([...newMessages, { role: 'assistant', content: accumulated }]);
      }
    } catch {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: 'Connection error. Please try again.' },
      ]);
    } finally {
      setStreaming(false);
    }
  }

  function handleClear() {
    setMessages([]);
  }

  const suggestions = [
    'What should I prioritise for this account this week?',
    'What would happen if we offered a 10% discount?',
    'Summarise the key risks in plain language',
    'Draft a talking point for my next QBR',
  ];

  return (
    <>
      {/* Toggle button */}
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen(!open)}
      >
        <MessageSquare className="size-3.5" />
        {open ? 'Close Chat' : 'Chat with AI'}
      </Button>

      {/* Side pane — non-modal, no backdrop, no scroll lock */}
      <div
        className={`fixed right-0 top-0 z-40 flex h-full w-full flex-col border-l bg-background shadow-xl transition-transform duration-300 sm:w-[28rem] ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">
            AI Chat: {accountName}
          </h3>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={handleClear}
              >
                <Trash2 className="mr-1 size-3" />
                Clear
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setOpen(false)}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Messages area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-4"
        >
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Bot className="size-6 text-muted-foreground" />
              </div>
              <p className="text-center text-sm text-muted-foreground">
                Ask me anything about {accountName}. I have full context on their
                metrics, scores, and AI analysis.
              </p>
              <div className="flex flex-col gap-2 w-full">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    className="rounded-lg border px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    onClick={() => setInput(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <Bot className="size-3.5 text-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                    {msg.role === 'assistant' && msg.content === '' && streaming && (
                      <span className="inline-block animate-pulse text-muted-foreground">
                        Thinking...
                      </span>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary">
                      <User className="size-3.5 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="flex-none border-t p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2"
          >
            <Input
              placeholder="Ask about this account..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={streaming}
              className="text-sm"
            />
            <Button
              type="submit"
              size="sm"
              disabled={!input.trim() || streaming}
            >
              <Send className="size-3.5" />
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
