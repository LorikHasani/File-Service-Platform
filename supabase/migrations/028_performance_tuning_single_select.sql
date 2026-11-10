-- ============================================================================
-- Performance Tuning: pick only one, and list Stage 1 first.
--
-- Both are data, not code: the upload form reads service_categories.
-- selection_type ('single' = pick one) and orders services by sort_order.
-- Names are matched loosely (case and extra spaces do not matter).
--
-- Run by hand in the Supabase SQL editor. The result table at the end shows
-- what the category and its services look like afterwards.
-- ============================================================================

-- 1. The client may choose only one service in this category.
UPDATE service_categories
SET selection_type = 'single'
WHERE name ILIKE '%performance%tuning%';

-- 2. Order inside the category: Stage 1, Stage 2, (other stages), NO OPTIONS.
UPDATE services s
SET sort_order = CASE
    WHEN s.name ILIKE 'stage%1%'    THEN 1
    WHEN s.name ILIKE 'stage%2%'    THEN 2
    WHEN s.name ILIKE 'stage%3%'    THEN 3
    WHEN s.name ILIKE 'no%option%'  THEN 99
    ELSE 50
END
FROM service_categories c
WHERE c.id = s.category_id
  AND c.name ILIKE '%performance%tuning%';

-- 3. Check: selection_type should be 'single' and Stage 1 should be first.
SELECT c.name AS category, c.job_type, c.selection_type, s.name AS service, s.sort_order, s.is_active
FROM service_categories c
LEFT JOIN services s ON s.category_id = c.id
WHERE c.name ILIKE '%performance%tuning%'
ORDER BY c.name, c.job_type, s.sort_order;
