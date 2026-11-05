-- ============================================================================
-- 025 — Remove the Partner API
--
-- Undoes migrations 022 (partner API) and 023 (partner webhooks). The app
-- code for the API was removed on 2026-11-06; this drops what it left in the
-- database:
--
--   * the webhook triggers on jobs / files / job_messages, which otherwise
--     keep queueing deliveries that nothing will ever send
--   * the API and webhook functions
--   * the extra job columns (source, api_key_id, external_ref,
--     end_customer_ref) and their indexes
--   * the api_keys, api_request_log, api_webhooks and api_webhook_deliveries
--     tables, including every key, request log entry and queued delivery
--
-- Jobs that were submitted through the API stay as ordinary jobs; only their
-- partner reference columns go. Their charges in `transactions` are untouched.
--
-- Run this whole file in the Supabase SQL editor. It is wrapped in a
-- transaction, so it either applies completely or not at all, and every
-- statement uses IF EXISTS, so running it twice is harmless.
-- ============================================================================

BEGIN;

-- 1. Webhook triggers first, so nothing queues while the rest is dropped.
DROP TRIGGER IF EXISTS job_status_webhook ON jobs;
DROP TRIGGER IF EXISTS file_ready_webhook ON files;
DROP TRIGGER IF EXISTS job_message_webhook ON job_messages;

DROP FUNCTION IF EXISTS trg_job_status_webhook();
DROP FUNCTION IF EXISTS trg_file_ready_webhook();
DROP FUNCTION IF EXISTS trg_job_message_webhook();

-- 2. API and webhook functions.
DROP FUNCTION IF EXISTS enqueue_webhook_event(UUID, TEXT, UUID, JSONB);
DROP FUNCTION IF EXISTS claim_webhook_deliveries(INT);
DROP FUNCTION IF EXISTS record_webhook_result(BIGINT, BOOLEAN, INT, TEXT, INT, INT);
DROP FUNCTION IF EXISTS touch_api_key(UUID);
DROP FUNCTION IF EXISTS create_api_job(
    UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT, TEXT, TEXT,
    TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT
);

-- 3. Job columns added for API jobs. Their indexes (uq_jobs_client_external_ref,
--    idx_jobs_source) and the api_key_id foreign key go with them.
ALTER TABLE jobs DROP COLUMN IF EXISTS api_key_id;
ALTER TABLE jobs DROP COLUMN IF EXISTS external_ref;
ALTER TABLE jobs DROP COLUMN IF EXISTS end_customer_ref;
ALTER TABLE jobs DROP COLUMN IF EXISTS source;

-- 4. Tables, children before parents. Policies and grants go with them.
DROP TABLE IF EXISTS api_webhook_deliveries;
DROP TABLE IF EXISTS api_webhooks;
DROP TABLE IF EXISTS api_request_log;
DROP TABLE IF EXISTS api_keys;

COMMIT;
