'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Send } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Comment {
  id: string;
  account_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: {
    display_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
}

interface CommentsSectionProps {
  accountId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommentsSection({ accountId }: CommentsSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/comments?account_id=${accountId}`);
      if (res.ok) {
        setComments(await res.json());
      }
      setLoaded(true);
    }
    load();
  }, [accountId]);

  async function handlePost() {
    if (!content.trim()) return;
    setPosting(true);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId, content }),
      });
      if (res.ok) {
        const newComment = await res.json();
        setComments((prev) => [newComment, ...prev]);
        setContent('');
      }
    } finally {
      setPosting(false);
    }
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  }

  function getInitials(profile: Comment['profiles']) {
    const name = profile?.display_name || profile?.email || '?';
    return name
      .split(' ')
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-blue-500" />
          <CardTitle>
            Comments{' '}
            {comments.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({comments.length})
              </span>
            )}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {/* Post input */}
        <div className="flex gap-2">
          <Textarea
            placeholder="Add a comment about this account..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[60px] resize-none text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handlePost();
              }
            }}
          />
          <Button
            size="sm"
            className="shrink-0 self-end"
            disabled={!content.trim() || posting}
            onClick={handlePost}
          >
            <Send className="size-3.5" />
          </Button>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Press Ctrl+Enter to post
        </p>

        {/* Comments list */}
        {loaded && comments.length > 0 && (
          <div className="mt-4 space-y-3">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                {/* Avatar */}
                {comment.profiles?.avatar_url ? (
                  <img
                    src={comment.profiles.avatar_url}
                    alt=""
                    className="size-7 shrink-0 rounded-full"
                  />
                ) : (
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
                    {getInitials(comment.profiles)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium">
                      {comment.profiles?.display_name ||
                        comment.profiles?.email ||
                        'User'}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatTime(comment.created_at)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-foreground/90 whitespace-pre-wrap">
                    {comment.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {loaded && comments.length === 0 && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            No comments yet. Be the first to add context.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
