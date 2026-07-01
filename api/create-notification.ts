import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOWED_ORIGIN = process.env.SITE_URL || 'https://chiptunefiles.com';

const MAX_TITLE_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 2000;

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
