import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const config = {
  api: {
    bodyParser: false,
  },
};

// Read raw body inline — no external dependency needed
async function getRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function addCreditsToUser(
  userId: string,
  credits: number,
  packageName: string,
  sessionId: string
) {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('credit_balance')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    throw new Error(`User not found: ${userId}`);
  }

  const balanceBefore = Number(profile.credit_balance);
  const balanceAfter = balanceBefore + credits;

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      credit_balance: balanceAfter,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (updateError) {
    throw new Error(`Failed to update balance: ${updateError.message}`);
  }

  const { error: txError } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      type: 'credit_purchase',
      amount: credits,
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      description: `Purchased ${packageName} (${credits} credits) — Stripe ${sessionId}`,
    });

  if (txError) {
    console.error('Transaction record failed (credits already added):', txError);
  }

  console.log(`Added ${credits} credits to user ${userId}. Balance: ${balanceBefore} -> ${balanceAfter}`);
  return balanceAfter;
}

const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const BRAND_NAME = 'ChipTuneFiles';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const SITE_URL = process.env.SITE_URL || 'https://chiptunefiles.com';
const FROM_EMAIL = process.env.FROM_EMAIL || `${BRAND_NAME} <onboarding@resend.dev>`;
const LOGO_URL = `${SITE_URL}/logo.png`;

async function sendCreditPurchaseEmails(
  userId: string,
  credits: number,
  packageName: string,
  amountPaid: number,
  balanceAfter: number
) {
  // Fetch client info
  const { data: client } = await supabase
    .from('profiles')
    .select('contact_name, email')
    .eq('id', userId)
    .single();

  if (!client) return;

  const accent = '#2563eb';

  function emailFooter() {
    return `
        </td></tr>
        <tr><td style="padding:30px 10px 0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:middle;">
                <p style="margin:0 0 4px;font-size:13px;color:#333;">
                  <strong style="color:${accent};">${BRAND_NAME}</strong> | Germany &amp; Kosovo
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
        </td></tr>`;
  }

  async function sendEmail(to: string, subject: string, html: string) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(`Resend error: ${JSON.stringify(err)}`);
    }
  }

  // ─── Email to Client ───
  const clientHtml = `
<!DOCTYPE html><html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f0f0f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f0f0;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background-color:#ffffff;border-radius:12px;padding:40px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <h1 style="margin:0 0 24px;color:${accent};font-size:24px;font-weight:900;text-transform:uppercase;">CREDIT PURCHASE CONFIRMED</h1>
          <p style="margin:0 0 20px;color:#333;font-size:15px;">Hello <strong>${client.contact_name}</strong>, your credit purchase has been successfully processed.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid #eee;border-radius:8px;">
            <tr style="background-color:#f9f9f9;"><td style="padding:12px 16px;font-weight:600;color:#666;font-size:13px;">PACKAGE</td><td style="padding:12px 16px;color:#333;font-size:14px;">${packageName}</td></tr>
            <tr><td style="padding:12px 16px;font-weight:600;color:#666;font-size:13px;border-top:1px solid #eee;">CREDITS ADDED</td><td style="padding:12px 16px;color:#22c55e;font-size:14px;font-weight:700;border-top:1px solid #eee;">+${credits} credits</td></tr>
            <tr style="background-color:#f9f9f9;"><td style="padding:12px 16px;font-weight:600;color:#666;font-size:13px;border-top:1px solid #eee;">AMOUNT PAID</td><td style="padding:12px 16px;color:#333;font-size:14px;border-top:1px solid #eee;">&euro;${amountPaid.toFixed(2)}</td></tr>
            <tr><td style="padding:12px 16px;font-weight:600;color:#666;font-size:13px;border-top:1px solid #eee;">NEW BALANCE</td><td style="padding:12px 16px;color:${accent};font-size:14px;font-weight:700;border-top:1px solid #eee;">${balanceAfter.toFixed(2)} credits</td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="left" style="padding:8px 0 0;">
            <a href="${SITE_URL}/credits" style="display:inline-block;background-color:${accent};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 32px;border-radius:8px;">&rarr; Log in to portal</a>
          </td></tr></table>
          ${emailFooter()}
      </table>
    </td></tr>
  </table>
</body></html>`;

  await sendEmail(client.email, `Credit Purchase Confirmed — ${credits} Credits — ${BRAND_NAME}`, clientHtml);
  console.log(`Credit purchase email sent to ${client.email}`);

  // ─── Email to Admin ───
  if (ADMIN_EMAIL) {
    const adminHtml = `
<!DOCTYPE html><html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f0f0f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f0f0;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background-color:#ffffff;border-radius:12px;padding:40px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <h1 style="margin:0 0 24px;color:${accent};font-size:24px;font-weight:900;text-transform:uppercase;">NEW CREDIT PURCHASE</h1>
          <p style="margin:0 0 24px;color:#333;font-size:15px;">A client has purchased credits on <strong>${BRAND_NAME}</strong>.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid #eee;border-radius:8px;">
            <tr style="background-color:#f9f9f9;"><td style="padding:12px 16px;font-weight:600;color:#666;font-size:13px;">CLIENT</td><td style="padding:12px 16px;color:#333;font-size:14px;">${client.contact_name} (${client.email})</td></tr>
            <tr><td style="padding:12px 16px;font-weight:600;color:#666;font-size:13px;border-top:1px solid #eee;">PACKAGE</td><td style="padding:12px 16px;color:#333;font-size:14px;border-top:1px solid #eee;">${packageName}</td></tr>
            <tr style="background-color:#f9f9f9;"><td style="padding:12px 16px;font-weight:600;color:#666;font-size:13px;border-top:1px solid #eee;">CREDITS</td><td style="padding:12px 16px;color:#22c55e;font-size:14px;font-weight:700;border-top:1px solid #eee;">+${credits} credits</td></tr>
            <tr><td style="padding:12px 16px;font-weight:600;color:#666;font-size:13px;border-top:1px solid #eee;">AMOUNT PAID</td><td style="padding:12px 16px;color:#333;font-size:14px;font-weight:700;border-top:1px solid #eee;">&euro;${amountPaid.toFixed(2)}</td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="left" style="padding:8px 0 0;">
            <a href="${SITE_URL}/admin/users" style="display:inline-block;background-color:${accent};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 32px;border-radius:8px;">&rarr; Log in to portal</a>
          </td></tr></table>
          ${emailFooter()}
      </table>
    </td></tr>
  </table>
</body></html>`;

    await sendEmail(ADMIN_EMAIL, `Credit Purchase — ${client.contact_name} bought ${credits} credits — ${BRAND_NAME}`, adminHtml);
    console.log(`Credit purchase admin email sent to ${ADMIN_EMAIL}`);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawBody = await getRawBody(req);
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.payment_status !== 'paid') {
        return res.status(200).json({ received: true });
      }

      const userId = session.metadata?.supabase_user_id;
      const credits = Number(session.metadata?.credits || 0);
      const packageName = session.metadata?.package_name || 'Credit Package';

      if (!userId || !credits) {
        console.error('Missing metadata:', session.metadata);
        return res.status(400).json({ error: 'Missing metadata' });
      }

      const balanceAfter = await addCreditsToUser(userId, credits, packageName, session.id);

      // Send email notifications (fire-and-forget — don't block webhook response)
      const amountPaid = (session.amount_total || 0) / 100;
      sendCreditPurchaseEmails(userId, credits, packageName, amountPaid, balanceAfter).catch((err) => {
        console.error('Failed to send credit purchase emails:', err.message || err);
      });
    }

    return res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('Webhook error:', err.message || err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
