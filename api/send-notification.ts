import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const FROM_EMAIL = process.env.FROM_EMAIL || 'TuneForge <noreply@tuneforge.com>';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const SITE_URL = process.env.SITE_URL || 'https://file-service-platform.vercel.app';
const BRAND_NAME = process.env.BRAND_NAME || 'TuneForge';

// ─── HTML Email Templates ───

function fileDeliveredEmail(data: {
  clientName: string;
  refNumber: string;
  vehicleInfo: string;
  jobId: string;
}) {
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
          <p style="margin:0 0 4px;color:#666;font-size:16px;">Hey</p>
          <p style="margin:0 0 20px;color:#22c55e;font-size:24px;font-weight:bold;">${data.clientName}!</p>
          
          <p style="margin:0 0 24px;color:#333;font-size:15px;">
            Thank you for using <strong>${BRAND_NAME}</strong>. Your request has been delivered.
          </p>

          <!-- Request Details -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr style="border-bottom:2px solid #eee;">
              <td style="padding:12px 0;font-weight:600;color:#333;">Request</td>
              <td style="padding:12px 0;font-weight:600;color:#333;text-align:right;">Status</td>
            </tr>
            <tr>
              <td style="padding:16px 0;color:#333;font-size:14px;line-height:1.5;">
                ${data.refNumber} - ${data.vehicleInfo}
              </td>
              <td style="padding:16px 0;text-align:right;">
                <span style="color:#22c55e;font-weight:600;font-size:14px;">Delivered</span>
              </td>
            </tr>
          </table>

          <!-- CTA Button -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="padding:8px 0 24px;">
              <a href="${SITE_URL}/jobs/${data.jobId}" 
                 style="display:inline-block;background-color:#dc2626;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 32px;border-radius:8px;">
                Request Details
              </a>
            </td></tr>
          </table>

          <p style="margin:0 0 16px;color:#666;font-size:14px;line-height:1.6;">
            If you have any questions about this request, simply reply to this email or reach out to our support team for help.
          </p>
          <p style="margin:0;color:#666;font-size:14px;">
            Cheers,<br/>${BRAND_NAME} Team
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function newRequestEmail(data: {
  clientName: string;
  clientEmail: string;
  refNumber: string;
  vehicleInfo: string;
  services: string;
  jobId: string;
}) {
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
          <p style="margin:0 0 4px;color:#666;font-size:16px;">New Request</p>
          <p style="margin:0 0 20px;color:#dc2626;font-size:24px;font-weight:bold;">From ${data.clientName}</p>
          
          <p style="margin:0 0 24px;color:#333;font-size:15px;">
            A new tuning request has been submitted and is waiting for your review.
          </p>

          <!-- Request Details -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid #eee;border-radius:8px;">
            <tr style="background-color:#f9f9f9;">
              <td style="padding:12px 16px;font-weight:600;color:#666;font-size:13px;">CLIENT</td>
              <td style="padding:12px 16px;color:#333;font-size:14px;">${data.clientName} (${data.clientEmail})</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;font-weight:600;color:#666;font-size:13px;border-top:1px solid #eee;">REFERENCE</td>
              <td style="padding:12px 16px;color:#333;font-size:14px;border-top:1px solid #eee;">${data.refNumber}</td>
            </tr>
            <tr style="background-color:#f9f9f9;">
              <td style="padding:12px 16px;font-weight:600;color:#666;font-size:13px;border-top:1px solid #eee;">VEHICLE</td>
              <td style="padding:12px 16px;color:#333;font-size:14px;border-top:1px solid #eee;">${data.vehicleInfo}</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;font-weight:600;color:#666;font-size:13px;border-top:1px solid #eee;">SERVICES</td>
              <td style="padding:12px 16px;color:#333;font-size:14px;border-top:1px solid #eee;">${data.services}</td>
            </tr>
          </table>

          <!-- CTA Button -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="padding:8px 0 24px;">
              <a href="${SITE_URL}/admin/jobs/${data.jobId}" 
                 style="display:inline-block;background-color:#dc2626;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 32px;border-radius:8px;">
                View Request
              </a>
            </td></tr>
          </table>

          <p style="margin:0;color:#666;font-size:14px;">
            — ${BRAND_NAME} System
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Send via Resend ───

async function sendEmail(to: string, subject: string, html: string) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Resend error: ${JSON.stringify(err)}`);
  }

  return response.json();
}

// ─── Handler ───

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

    const { type, jobId } = req.body;

    if (!type || !jobId) {
      return res.status(400).json({ error: 'Missing type or jobId' });
    }

    // Fetch job details
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Fetch job services
    const { data: jobServices } = await supabase
      .from('job_services')
      .select('service_name')
      .eq('job_id', jobId);

    const serviceNames = (jobServices || []).map((s: any) => s.service_name).join(', ') || 'N/A';

    const vehicleInfo = [
      job.vehicle_brand,
      job.vehicle_model,
      job.vehicle_year,
      job.engine_type,
      job.engine_power_hp ? `${job.engine_power_hp}hp` : '',
      job.ecu_type || '',
    ].filter(Boolean).join(' ');

    if (type === 'file_delivered') {
      // ─── Admin uploaded mod file → email client ───
      const { data: client } = await supabase
        .from('profiles')
        .select('contact_name, email')
        .eq('id', job.client_id)
        .single();

      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }

      const html = fileDeliveredEmail({
        clientName: client.contact_name,
        refNumber: job.reference_number,
        vehicleInfo,
        jobId,
      });

      await sendEmail(
        client.email,
        `Your request ${job.reference_number} has been delivered — ${BRAND_NAME}`,
        html
      );

      console.log(`Email sent to ${client.email} — file delivered for ${job.reference_number}`);

    } else if (type === 'new_request') {
      // ─── Client created job → email admin ───
      if (!ADMIN_EMAIL) {
        return res.status(500).json({ error: 'ADMIN_EMAIL not configured' });
      }

      const { data: client } = await supabase
        .from('profiles')
        .select('contact_name, email')
        .eq('id', job.client_id)
        .single();

      const html = newRequestEmail({
        clientName: client?.contact_name || 'Unknown',
        clientEmail: client?.email || 'Unknown',
        refNumber: job.reference_number,
        vehicleInfo,
        services: serviceNames,
        jobId,
      });

      await sendEmail(
        ADMIN_EMAIL,
        `New request ${job.reference_number} from ${client?.contact_name || 'Client'} — ${BRAND_NAME}`,
        html
      );

      console.log(`Email sent to admin — new request ${job.reference_number}`);

    } else {
      return res.status(400).json({ error: `Unknown notification type: ${type}` });
    }

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('Notification error:', err.message || err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
