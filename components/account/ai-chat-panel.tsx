'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { MessageSquare, Send, Trash2, Bot, User, Volume2, Square, Mic, Loader2 } from 'lucide-react';
import { useTextToSpeech } from '@/lib/audio/use-text-to-speech';
import { useSpeechRecognition } from '@/lib/audio/use-speech-recognition';

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
// Speaker button for individual messages
// ---------------------------------------------------------------------------

function MessageSpeaker({ text }: { text: string }) {
  const tts = useTextToSpeech();

  if (!text) return null;

  return (
    <button
      className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
      onClick={() => (tts.isPlaying ? tts.stop() : tts.play(text))}
      disabled={tts.isLoading}
    >
      {tts.isLoading ? (
        <Loader2 className="size-3 animate-spin" />
      ) : tts.isPlaying ? (
        <Square className="size-3" />
      ) : (
        <Volume2 className="size-3" />
      )}
      {tts.isLoading ? 'Loading' : tts.isPlaying ? 'Stop' : 'Listen'}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AiChatPanel({ accountId, accountName }: AiChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stt = useSpeechRecognition();

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streaming]);

  // When speech recognition produces a transcript, set it as input and send
  useEffect(() => {
    if (stt.transcript && !stt.isListening) {
      setInput(stt.transcript);
      // Auto-send after a short delay so user sees the transcript
      const timer = setTimeout(() => {
        sendMessage(stt.transcript);
      }, 300);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stt.transcript, stt.isListening]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    const userMsg: ChatMessage = { role: 'user', content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setStreaming(true);

    // Add placeholder for assistant response
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

      // Stream the response
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

  async function handleSend() {
    await sendMessage(input);
  }

  function handleClear() {
    setMessages([]);
  }

  function handleMic() {
    if (stt.isListening) {
      stt.stopListening();
    } else {
      stt.startListening();
    }
  }

  const suggestions = [
    'What should I prioritise for this account this week?',
    'What would happen if we offered a 10% discount?',
    'Summarise the key risks in plain language',
    'Draft a talking point for my next QBR',
  ];

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5">
            <MessageSquare className="size-3.5" />
            Chat with AI
          </Button>
        }
      />
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader className="flex-none">
          <div className="flex items-center justify-between pr-6">
            <SheetTitle className="text-base">
              AI Chat: {accountName}
            </SheetTitle>
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
          </div>
        </SheetHeader>

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
              {stt.isSupported && (
                <p className="text-center text-[10px] text-muted-foreground">
                  You can also use the microphone to ask questions by voice.
                </p>
              )}
              <div className="flex flex-col gap-2 w-full">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    className="rounded-lg border px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    onClick={() => {
                      setInput(s);
                    }}
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
                    {/* Level 2: Speaker icon on completed assistant messages */}
                    {msg.role === 'assistant' && msg.content && !(i === messages.length - 1 && streaming) && (
                      <MessageSpeaker text={msg.content} />
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
            {/* Level 3: Microphone button */}
            {stt.isSupported && (
              <Button
                type="button"
                size="sm"
                variant={stt.isListening ? 'destructive' : 'outline'}
                onClick={handleMic}
                disabled={streaming}
                title={stt.isListening ? 'Stop recording' : 'Speak your question'}
              >
                <Mic className={`size-3.5 ${stt.isListening ? 'animate-pulse' : ''}`} />
              </Button>
            )}
            <Input
              placeholder={stt.isListening ? 'Listening...' : 'Ask about this account...'}
              value={stt.isListening ? 'Listening...' : input}
              onChange={(e) => setInput(e.target.value)}
              disabled={streaming || stt.isListening}
              className="text-sm"
            />
            <Button
              type="submit"
              size="sm"
              disabled={!input.trim() || streaming || stt.isListening}
            >
              <Send className="size-3.5" />
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
