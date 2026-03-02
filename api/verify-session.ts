import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

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

    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
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

    // Check if this session was already processed (prevent double-crediting)
    const { data: existing } = await supabase
      .from('transactions')
      .select('id')
      .like('description', `%${session.id}%`)
      .limit(1);

    if (existing && existing.length > 0) {
      // Already processed — just return the current balance
      const { data: profile } = await supabase
        .from('profiles')
        .select('credit_balance')
        .eq('id', userId)
        .single();

      return res.status(200).json({
        status: 'already_processed',
        credit_balance: profile?.credit_balance ?? 0,
      });
    }

    // Add credits — same logic as webhook
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('credit_balance')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return res.status(500).json({ error: 'User profile not found' });
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
      return res.status(500).json({ error: 'Failed to update balance' });
    }

    // Record the transaction
    await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'credit_purchase',
        amount: credits,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        description: `Purchased ${packageName} (${credits} credits) — Stripe ${session.id}`,
      });

    console.log(`[verify-session] Added ${credits} credits to user ${userId}. Balance: ${balanceBefore} -> ${balanceAfter}`);

    return res.status(200).json({
      status: 'credits_added',
      credits_added: credits,
      credit_balance: balanceAfter,
    });
  } catch (err: any) {
    console.error('Verify session error:', err.message || err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
