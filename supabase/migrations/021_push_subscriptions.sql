-- ============================================================================
-- Web push subscriptions for PWA notifications.
-- One row per browser/device a user enabled notifications on. The Vercel
-- API (service role) reads these to send pushes when a notification is
-- created; dead endpoints (410 Gone) are deleted by the sender.
-- ============================================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users manage only their own subscriptions. Sending uses the service role,
-- which bypasses RLS.
DROP POLICY IF EXISTS "Users can view own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users can view own push subscriptions"
  ON push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can add own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users can add own push subscriptions"
  ON push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users can update own push subscriptions"
  ON push_subscriptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users can delete own push subscriptions"
  ON push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);
