import { supabase } from '@/lib/supabase';

// Partner webhooks are queued by database triggers (migration 023) and sent by
// /api/v1/webhooks/dispatch. Calling this right after a delivering admin action
// is what makes callbacks land within a second instead of waiting for the next
// scheduled drain.
//
// Fire-and-forget by design: a partner's endpoint being slow or down must never
// slow down or fail the admin's own action. Anything left over is retried on
// the next dispatch.
export function dispatchWebhooks(): void {
  void (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      await fetch('/api/v1/webhooks/dispatch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      });
    } catch (err) {
      console.error('Webhook dispatch failed:', err);
    }
  })();
}
