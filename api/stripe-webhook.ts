import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Vercel needs raw body for Stripe signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

// Read raw body from request
async function getRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let event: Stripe.Event;

  try {
    const rawBody = await getRawBody(req);
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      return res.status(400).json({ error: 'Missing Stripe signature' });
    }

    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.payment_status !== 'paid') {
      console.log('Payment not completed, skipping');
      return res.status(200).json({ received: true });
    }

    const userId = session.metadata?.supabase_user_id;
    const credits = Number(session.metadata?.credits || 0);
    const packageName = session.metadata?.package_name || 'Credit Package';

    if (!userId || !credits) {
      console.error('Missing metadata in checkout session:', session.id);
      return res.status(400).json({ error: 'Missing metadata' });
    }

    try {
      // Get current balance
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('credit_balance')
        .eq('id', userId)
        .single();

      if (profileError || !profile) {
        console.error('User not found:', userId);
        return res.status(404).json({ error: 'User not found' });
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
        console.error('Failed to update balance:', updateError);
        return res.status(500).json({ error: 'Failed to update balance' });
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
          description: `Purchased ${packageName} (${credits} credits) — Stripe session ${session.id}`,
        });

      if (txError) {
        console.error('Failed to record transaction:', txError);
        // Balance already updated, log but don't fail
      }

      console.log(`Added ${credits} credits to user ${userId}. Balance: ${balanceBefore} → ${balanceAfter}`);
    } catch (err: any) {
      console.error('Error processing payment:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(200).json({ received: true });
}
