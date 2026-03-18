'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Phone, PhoneOff, Volume2, Loader2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Feature flag — if NEXT_PUBLIC_ENABLE_VOICE !== "true", render nothing
// ---------------------------------------------------------------------------

const VOICE_ENABLED = process.env.NEXT_PUBLIC_ENABLE_VOICE === 'true';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VoiceChatProps {
  accountId: string;
  accountName: string;
  /** Account context string to send to the agent */
  accountContext: string;
}

interface TranscriptEntry {
  role: 'user' | 'agent';
  text: string;
  isFinal: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VoiceChat({ accountId, accountName, accountContext }: VoiceChatProps) {
  if (!VOICE_ENABLED) return null;

  return <VoiceChatInner accountId={accountId} accountName={accountName} accountContext={accountContext} />;
}

function VoiceChatInner({ accountName, accountContext }: VoiceChatProps) {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [mode, setMode] = useState<'listening' | 'speaking'>('listening');
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [muted, setMuted] = useState(false);
  const conversationRef = useRef<unknown>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contextSentRef = useRef(false);

  // Auto-scroll transcript
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  const startConversation = useCallback(async () => {
    setError(null);
    setStatus('connecting');
    setTranscript([]);
    contextSentRef.current = false;

    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Get signed URL from our server
      const tokenRes = await fetch('/api/voice-token');
      if (!tokenRes.ok) {
        const err = await tokenRes.json().catch(() => ({ error: 'Failed to get token' }));
        throw new Error(err.error || 'Failed to get voice token');
      }
      const { signed_url } = await tokenRes.json();

      // Dynamic import to avoid SSR issues
      const { Conversation } = await import('@elevenlabs/client');

      const conversation = await Conversation.startSession({
        signedUrl: signed_url,
        connectionType: 'websocket',

        onConnect: () => {
          setStatus('connected');
          // Send account context once connected
          if (!contextSentRef.current && conversationRef.current) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (conversationRef.current as any).sendContextualUpdate(
              `You are now discussing account: ${accountName}. Here is the full account context:\n\n${accountContext}\n\nUse this data to answer the user's questions. Be specific and reference metrics.`
            );
            contextSentRef.current = true;
          }
        },

        onDisconnect: () => {
          setStatus('idle');
          conversationRef.current = null;
        },

        onMessage: (message: { source?: string; message?: string }) => {
          if (message.source === 'user' && message.message) {
            setTranscript((prev) => {
              // Replace last interim user entry if exists
              const last = prev[prev.length - 1];
              if (last && last.role === 'user' && !last.isFinal) {
                return [...prev.slice(0, -1), { role: 'user', text: message.message!, isFinal: true }];
              }
              return [...prev, { role: 'user', text: message.message!, isFinal: true }];
            });
          } else if (message.source === 'ai' && message.message) {
            setTranscript((prev) => {
              const last = prev[prev.length - 1];
              if (last && last.role === 'agent' && !last.isFinal) {
                return [...prev.slice(0, -1), { role: 'agent', text: message.message!, isFinal: true }];
              }
              return [...prev, { role: 'agent', text: message.message!, isFinal: true }];
            });
          }
        },

        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          setError(msg);
          setStatus('error');
        },

        onModeChange: (newMode: { mode?: string }) => {
          if (newMode.mode === 'speaking') setMode('speaking');
          else setMode('listening');
        },
      });

      conversationRef.current = conversation;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start voice chat';
      setError(msg);
      setStatus('error');
    }
  }, [accountName, accountContext]);

  const endConversation = useCallback(async () => {
    if (conversationRef.current) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (conversationRef.current as any).endSession();
      } catch {
        // Ignore cleanup errors
      }
      conversationRef.current = null;
    }
    setStatus('idle');
  }, []);

  const toggleMute = useCallback(() => {
    if (conversationRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (conversationRef.current as any).setMicMuted(!muted);
      setMuted(!muted);
    }
  }, [muted]);

  // ---- Idle state: show start button ----
  if (status === 'idle' || status === 'error') {
    return (
      <div className="flex flex-col items-center gap-2">
        <Button
          onClick={startConversation}
          variant="outline"
          size="sm"
          className="gap-1.5"
        >
          <Phone className="size-3.5" />
          Voice Chat
        </Button>
        {error && (
          <p className="text-xs text-red-500 max-w-[200px] text-center">{error}</p>
        )}
      </div>
    );
  }

  // ---- Connecting state ----
  if (status === 'connecting') {
    return (
      <Button variant="outline" size="sm" disabled className="gap-1.5">
        <Loader2 className="size-3.5 animate-spin" />
        Connecting...
      </Button>
    );
  }

  // ---- Connected: show voice chat UI ----
  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-xl border bg-background shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className={`size-2 rounded-full ${mode === 'speaking' ? 'bg-green-500 animate-pulse' : 'bg-blue-500 animate-pulse'}`} />
          <span className="text-xs font-medium">
            {mode === 'speaking' ? 'Agent speaking...' : 'Listening...'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={toggleMute}
            title={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <MicOff className="size-3.5 text-red-500" /> : <Mic className="size-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
            onClick={endConversation}
            title="End call"
          >
            <PhoneOff className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Transcript */}
      <div ref={scrollRef} className="max-h-48 overflow-y-auto px-4 py-3">
        {transcript.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            <Volume2 className="inline size-3.5 mr-1" />
            Start speaking about {accountName}
          </p>
        ) : (
          <div className="space-y-2">
            {transcript.map((entry, i) => (
              <div
                key={i}
                className={`text-xs ${entry.role === 'user' ? 'text-right' : 'text-left'}`}
              >
                <span
                  className={`inline-block max-w-[90%] rounded-lg px-2.5 py-1.5 ${
                    entry.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  } ${!entry.isFinal ? 'opacity-60' : ''}`}
                >
                  {entry.text}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
