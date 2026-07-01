import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOWED_ORIGIN = process.env.SITE_URL || 'https://chiptunefiles.com';

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

    const { sessionId } = req.body;
    if (!sessionId || typeof sessionId !== 'string' || !sessionId.startsWith('cs_')) {
      return res.status(400).json({ error: 'Missing or invalid sessionId' });
    }

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Payment not completed' });
    }

    // Verify this session belongs to the requesting user
    const userId = session.metadata?.supabase_user_id;
    if (userId !== user.id) {
      return res.status(403).json({ error: 'Session does not belong to this user' });
    }

    const credits = Number(session.metadata?.credits || 0);
    const packageName = session.metadata?.package_name || 'Credit Package';

    if (!credits) {
      return res.status(400).json({ error: 'No credits in session metadata' });
    }

    // Atomic + idempotent: add_stripe_credits() locks the profile row and the
    // unique stripe_session_id index guarantees a session is credited exactly
    // once, no matter how this endpoint races with the Stripe webhook.
    const { data: result, error: rpcError } = await supabase.rpc('add_stripe_credits', {
      p_user_id: userId,
      p_credits: credits,
      p_package_name: packageName,
      p_session_id: session.id,
    });

    if (rpcError) {
      console.error('[verify-session] add_stripe_credits failed:', rpcError.message);
      return res.status(500).json({ error: 'Failed to add credits' });
    }

    const row = Array.isArray(result) ? result[0] : result;
    if (!row) {
      return res.status(500).json({ error: 'Failed to add credits' });
    }

    if (row.status === 'already_processed') {
      return res.status(200).json({
        status: 'already_processed',
        credit_balance: Number(row.new_balance),
      });
    }

    console.log(`[verify-session] Added ${credits} credits to user ${userId}. Balance: ${row.new_balance}`);

    return res.status(200).json({
      status: 'credits_added',
      credits_added: credits,
      credit_balance: Number(row.new_balance),
    });
  } catch (err: any) {
    console.error('Verify session error:', err.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
