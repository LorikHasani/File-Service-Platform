import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
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

    if (!action || !title || !message) {
      return res.status(400).json({ error: 'Missing required fields: action, title, message' });
    }

    if (action === 'notify_user') {
      // Notify a specific user
      if (!userId) {
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
      // Notify all admins
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
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
