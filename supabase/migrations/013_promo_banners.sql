-- ============================================================================
-- Promotional banners shown on the client dashboard
-- Admins upload a banner image (and an optional click-through link); clients
-- see all active banners stacked at the top of their dashboard.
-- ============================================================================

CREATE TABLE IF NOT EXISTS promo_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,                              -- internal label / alt text (optional)
  image_url TEXT NOT NULL,                 -- signed URL of the uploaded banner image
  link_url TEXT,                           -- where the banner links to (optional)
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_banners_active
  ON promo_banners(is_active, created_at DESC);

ALTER TABLE promo_banners ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read active banners (clients need this to see them).
DROP POLICY IF EXISTS "Anyone can view active banners" ON promo_banners;
CREATE POLICY "Anyone can view active banners"
  ON promo_banners FOR SELECT
  USING (is_active OR is_admin());

-- Only admins can create / update / delete banners.
DROP POLICY IF EXISTS "Admins can insert banners" ON promo_banners;
CREATE POLICY "Admins can insert banners"
  ON promo_banners FOR INSERT
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admins can update banners" ON promo_banners;
CREATE POLICY "Admins can update banners"
  ON promo_banners FOR UPDATE
  USING (is_admin());

DROP POLICY IF EXISTS "Admins can delete banners" ON promo_banners;
CREATE POLICY "Admins can delete banners"
  ON promo_banners FOR DELETE
  USING (is_admin());
