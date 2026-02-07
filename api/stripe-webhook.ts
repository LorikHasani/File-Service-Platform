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

      await addCreditsToUser(userId, credits, packageName, session.id);
    }

    return res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('Webhook error:', err.message || err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
