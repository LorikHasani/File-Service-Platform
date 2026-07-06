import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOWED_ORIGIN = process.env.SITE_URL || 'https://chiptunefiles.com';

const MAX_TITLE_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 2000;

// ─── Web push ───
// Public key is mirrored in src/lib/push.ts; the private key exists only in
// the Vercel environment. When VAPID_PRIVATE_KEY is unset, push is silently
// skipped and notifications remain in-app + email only.
const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  'BNAlvOYedrfxmjCMP8eKO7f3cCkC_4zs9atkI8Lg7WFFxaXLfc4_ahI9cEjBS0JxtESSIfiF7JDhBid8KssIsBg';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:kikzaperformance@gmail.com';

// Mirrors getNotificationLink in src/components/NotificationDropdown.tsx.
function pushUrl(linkType: string | null, linkId: string | null, forAdmin: boolean): string {
  if (!linkType || !linkId) return forAdmin ? '/admin' : '/dashboard';
  if (linkType === 'job') return forAdmin ? `/admin/jobs/${linkId}` : `/jobs/${linkId}`;
  if (linkType === 'ticket') return forAdmin ? `/admin/tickets/${linkId}` : `/tickets/${linkId}`;
  return forAdmin ? '/admin' : '/dashboard';
}

async function sendPushToUsers(
  userIds: string[],
  payload: { title: string; body: string; url: string }
): Promise<void> {
  if (!VAPID_PRIVATE_KEY || userIds.length === 0) return;

  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .in('user_id', userIds);

    if (!subs || subs.length === 0) return;

    const body = JSON.stringify(payload);
    await Promise.all(
      subs.map(async (sub: { endpoint: string; p256dh: string; auth: string }) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            body
          );
        } catch (err: any) {
          // 404/410 = subscription expired or unsubscribed — clean it up.
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          } else {
            console.error('Push send failed:', err?.statusCode || err?.message || err);
          }
        }
      })
    );
  } catch (err: any) {
    // Push must never break the in-app notification flow.
    console.error('Push dispatch error:', err?.message || err);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Verify auth
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing auth token' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid auth token' });
    }

    const { action, userId, title, message, linkType, linkId } = req.body;

    if (!action || typeof title !== 'string' || typeof message !== 'string' || !title || !message) {
      return res.status(400).json({ error: 'Missing required fields: action, title, message' });
    }
    if (title.length > MAX_TITLE_LENGTH || message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: 'Title or message too long' });
    }
    if ((linkType && typeof linkType !== 'string') || (linkId && typeof linkId !== 'string')) {
      return res.status(400).json({ error: 'Invalid linkType or linkId' });
    }

    if (action === 'notify_user') {
      // Sending a notification to an arbitrary user is an admin capability —
      // otherwise any client could push spoofed in-app messages to anyone.
      const { data: callerProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!callerProfile || (callerProfile.role !== 'admin' && callerProfile.role !== 'superadmin')) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: 'Missing userId for notify_user' });
      }

      const { error } = await supabase.from('notifications').insert({
        user_id: userId,
        title,
        message,
        link_type: linkType || null,
        link_id: linkId || null,
      });

      if (error) {
        console.error('Insert notification error:', error);
        return res.status(500).json({ error: 'Failed to create notification' });
      }

      await sendPushToUsers([userId], {
        title,
        body: message,
        url: pushUrl(linkType || null, linkId || null, false),
      });

    } else if (action === 'notify_admins') {
      // Any authenticated client may ping the admins (new job, new ticket, …).
      const { data: admins, error: adminError } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['admin', 'superadmin']);

      if (adminError) {
        console.error('Fetch admins error:', adminError);
        return res.status(500).json({ error: 'Failed to fetch admins' });
      }

      if (admins && admins.length > 0) {
        const inserts = admins.map((admin) => ({
          user_id: admin.id,
          title,
          message,
          link_type: linkType || null,
          link_id: linkId || null,
        }));

        const { error } = await supabase.from('notifications').insert(inserts);
        if (error) {
          console.error('Insert admin notifications error:', error);
          return res.status(500).json({ error: 'Failed to create admin notifications' });
        }

        await sendPushToUsers(
          admins.map((a) => a.id),
          {
            title,
            body: message,
            url: pushUrl(linkType || null, linkId || null, true),
          }
        );
      }

    } else {
      return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('Notification API error:', err.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
