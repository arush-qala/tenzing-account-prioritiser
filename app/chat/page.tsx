import dynamic from 'next/dynamic';

// C1Chat and its hooks use browser APIs — must skip SSR entirely
// to avoid React hydration errors (#425, #418, #423)
const ChatUI = dynamic(() => import('@/components/chat/chat-client'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-muted-foreground">Loading Ask the Analyst...</p>
    </div>
  ),
});

export default function ChatPage() {
  return <ChatUI />;
}
