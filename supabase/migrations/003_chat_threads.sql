-- ============================================================
-- 003_chat_threads.sql
-- Persistent chat threads and messages for Portfolio Analyst
-- ============================================================

-- =========================
-- 1. chat_threads
-- =========================
CREATE TABLE IF NOT EXISTS chat_threads (
  id         TEXT PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT 'New Chat',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================
-- 2. chat_messages
-- =========================
CREATE TABLE IF NOT EXISTS chat_messages (
  id         TEXT NOT NULL,
  thread_id  TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content    JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (thread_id, id)
);

-- =========================
-- Indexes
-- =========================
CREATE INDEX IF NOT EXISTS idx_chat_threads_user_id ON chat_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_updated_at ON chat_threads(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_id ON chat_messages(thread_id);

-- =========================
-- Row-Level Security
-- =========================
ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Threads: users can only see/manage their own threads
CREATE POLICY "Users can read own threads"
  ON chat_threads FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own threads"
  ON chat_threads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own threads"
  ON chat_threads FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own threads"
  ON chat_threads FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Messages: users can access messages in their own threads
CREATE POLICY "Users can read messages in own threads"
  ON chat_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM chat_threads WHERE chat_threads.id = chat_messages.thread_id AND chat_threads.user_id = auth.uid()));
CREATE POLICY "Users can insert messages in own threads"
  ON chat_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM chat_threads WHERE chat_threads.id = chat_messages.thread_id AND chat_threads.user_id = auth.uid()));
CREATE POLICY "Users can update messages in own threads"
  ON chat_messages FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM chat_threads WHERE chat_threads.id = chat_messages.thread_id AND chat_threads.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM chat_threads WHERE chat_threads.id = chat_messages.thread_id AND chat_threads.user_id = auth.uid()));
CREATE POLICY "Users can delete messages in own threads"
  ON chat_messages FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM chat_threads WHERE chat_threads.id = chat_messages.thread_id AND chat_threads.user_id = auth.uid()));
