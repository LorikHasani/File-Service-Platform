import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const FROM_EMAIL = process.env.FROM_EMAIL || 'TuneForge <noreply@tuneforge.com>';
const BRAND_NAME = process.env.BRAND_NAME || 'TuneForge';

function composeEmailHtml(subject: string, body: string) {
  // Convert newlines to <br> for HTML
  const htmlBody = body.replace(/\n/g, '<br/>');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f0f0f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f0f0;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <!-- Logo -->
        <tr><td align="center" style="padding-bottom:30px;">
          <span style="font-size:28px;font-weight:bold;color:#dc2626;">⚡ ${BRAND_NAME}</span>
        </td></tr>
        <!-- Card -->
        <tr><td style="background-color:#ffffff;border-radius:12px;padding:40px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <h1 style="margin:0 0 20px;color:#333;font-size:22px;font-weight:bold;">${subject}</h1>
          <div style="margin:0 0 24px;color:#333;font-size:15px;line-height:1.7;">
            ${htmlBody}
          </div>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
          <p style="margin:0;color:#999;font-size:13px;">
            This email was sent by ${BRAND_NAME}. If you have questions, reply to this email.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendEmail(to: string, subject: string, html: string) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Resend error: ${JSON.stringify(err)}`);
  }

  return response.json();
}

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

    // Verify admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { to, subject, body } = req.body;

    if (!to || !Array.isArray(to) || to.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid recipients (to)' });
    }
    if (!subject || !body) {
      return res.status(400).json({ error: 'Missing subject or body' });
    }

    const html = composeEmailHtml(subject, body);
    let sent = 0;
    const errors: string[] = [];

    for (const recipient of to) {
      try {
        await sendEmail(recipient, subject, html);
        sent++;
      } catch (err: any) {
        console.error(`Failed to send to ${recipient}:`, err.message);
        errors.push(recipient);
      }
    }

    return res.status(200).json({ success: true, sent, failed: errors.length, errors });
  } catch (err: any) {
    console.error('Send email error:', err.message || err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
