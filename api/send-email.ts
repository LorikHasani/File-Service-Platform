import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const BRAND_NAME = 'ChipTuneFiles';
const SITE_URL = process.env.SITE_URL || 'https://chiptunefiles.com';
const FROM_EMAIL = process.env.FROM_EMAIL || `${BRAND_NAME} <onboarding@resend.dev>`;
const LOGO_URL = `${SITE_URL}/logo.png`;

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
        <!-- Card -->
        <tr><td style="background-color:#ffffff;border-radius:12px;padding:40px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Title in bold red -->
          <h1 style="margin:0 0 24px;color:#dc2626;font-size:24px;font-weight:900;text-transform:uppercase;line-height:1.3;">${subject}</h1>
          <!-- Body -->
          <div style="margin:0 0 30px;color:#333;font-size:15px;line-height:1.7;">
            ${htmlBody}
          </div>
          <!-- CTA Button -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="left" style="padding:0 0 8px;">
              <a href="${SITE_URL}/login"
                 style="display:inline-block;background-color:#dc2626;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 32px;border-radius:8px;">
                &rarr; Log in to portal
              </a>
            </td></tr>
          </table>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:30px 10px 0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:middle;">
                <p style="margin:0 0 4px;font-size:13px;color:#333;">
                  <strong style="color:#dc2626;">${BRAND_NAME}</strong> | Germany &amp; Kosovo
                </p>
                <p style="margin:0;font-size:12px;color:#666;">
                  Tel: <a href="https://wa.me/38344955389" style="color:#333;text-decoration:none;">+38344955389</a> |
                  Email: <a href="mailto:kikzaperformance@gmail.com" style="color:#1a73e8;text-decoration:none;">kikzaperformance@gmail.com</a>
                </p>
              </td>
              <td style="vertical-align:middle;text-align:right;width:80px;">
                <img src="${LOGO_URL}" alt="${BRAND_NAME}" style="height:45px;max-width:80px;" />
              </td>
            </tr>
          </table>
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
