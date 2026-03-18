-- ============================================================
-- 002_profiles_tasks_comments.sql
-- User profiles, actionable tasks, and comments
-- ============================================================

-- =========================
-- 1. profiles
-- =========================
CREATE TABLE IF NOT EXISTS profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email        TEXT,
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- 2. user_tasks
-- =========================
CREATE TABLE IF NOT EXISTS user_tasks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id       TEXT NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  assigned_to      UUID REFERENCES auth.users(id),
  title            TEXT NOT NULL,
  description      TEXT,
  source           TEXT DEFAULT 'ai_recommendation',
  source_rationale TEXT,
  owner_suggestion TEXT,
  timeframe        TEXT,
  status           TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done', 'dismissed')),
  dismissed_reason TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- =========================
-- 3. comments
-- =========================
CREATE TABLE IF NOT EXISTS comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id TEXT NOT NULL REFERENCES accounts(account_id) ON DELETE CASCADE,
  user_id    UUID REFERENCES auth.users(id),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================
-- Indexes
-- =========================
CREATE INDEX IF NOT EXISTS idx_user_tasks_account_id ON user_tasks(account_id);
CREATE INDEX IF NOT EXISTS idx_user_tasks_assigned_to ON user_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_comments_account_id ON comments(account_id);

-- =========================
-- Row-Level Security
-- =========================

-- profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read profiles"
  ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- user_tasks
ALTER TABLE user_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read user_tasks"
  ON user_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert user_tasks"
  ON user_tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update user_tasks"
  ON user_tasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can delete user_tasks"
  ON user_tasks FOR DELETE TO authenticated USING (true);

-- comments
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read comments"
  ON comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert comments"
  ON comments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can delete own comments"
  ON comments FOR DELETE TO authenticated USING (auth.uid() = user_id);
