import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { buffer as microBuffer } from 'micro';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Disable Vercel's body parser so we can read the raw body for Stripe signature
export const config = {
  api: {
    bodyParser: false,
  },
};

async function addCreditsToUser(
  userId: string,
  credits: number,
  packageName: string,
  sessionId: string
) {
  // Get current balance
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

  // Update balance
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

  // Record transaction
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

  console.log(`✅ Added ${credits} credits to user ${userId}. Balance: ${balanceBefore} → ${balanceAfter}`);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('🔔 Stripe webhook received');

  try {
    // Read raw body for signature verification
    const rawBody = await buffer(req);
    const signature = req.headers['stripe-signature'] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event: Stripe.Event;

    if (signature && webhookSecret) {
      // Verify signature (production path)
      try {
        event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
        console.log('✅ Signature verified, event:', event.type);
      } catch (err: any) {
        console.error('❌ Signature verification failed:', err.message);
        return res.status(400).json({ error: `Signature verification failed: ${err.message}` });
      }
    } else {
      // Fallback: parse body directly (for testing without webhook secret)
      console.warn('⚠️ No webhook secret or signature — parsing body directly');
      const body = JSON.parse(rawBody.toString());
      event = body as Stripe.Event;
    }

    // Only handle checkout.session.completed
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log('💳 Checkout session:', session.id, 'Payment status:', session.payment_status);

      if (session.payment_status !== 'paid') {
        console.log('⏳ Payment not yet completed, skipping');
        return res.status(200).json({ received: true });
      }

      const userId = session.metadata?.supabase_user_id;
      const credits = Number(session.metadata?.credits || 0);
      const packageName = session.metadata?.package_name || 'Credit Package';

      if (!userId || !credits) {
        console.error('❌ Missing metadata:', { userId, credits, metadata: session.metadata });
        return res.status(400).json({ error: 'Missing metadata' });
      }

      await addCreditsToUser(userId, credits, packageName, session.id);
    } else {
      console.log('ℹ️ Ignoring event type:', event.type);
    }

    return res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('❌ Webhook handler error:', err.message || err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
