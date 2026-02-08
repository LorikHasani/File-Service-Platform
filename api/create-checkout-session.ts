import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Price per credit for custom amounts (€1 = 1 credit)
const CUSTOM_PRICE_PER_CREDIT = 1.0;
const MIN_CUSTOM_CREDITS = 10;
const MAX_CUSTOM_CREDITS = 10000;

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

    const { packageId, customCredits } = req.body;

    let productName: string;
    let productDescription: string;
    let priceInCents: number;
    let totalCredits: number;
    let label: string;

    if (packageId) {
      // ─── Package purchase ───
      const { data: pkg, error: pkgError } = await supabase
        .from('credit_packages')
        .select('*')
        .eq('id', packageId)
        .eq('is_active', true)
        .single();

      if (pkgError || !pkg) {
        return res.status(404).json({ error: 'Package not found' });
      }

      totalCredits = Number(pkg.credits) + Number(pkg.bonus_credits || 0);
      priceInCents = Math.round(Number(pkg.price) * 100);
      productName = `${pkg.name} — ${totalCredits} Credits`;
      productDescription = pkg.bonus_credits > 0
        ? `${pkg.credits} credits + ${pkg.bonus_credits} bonus credits`
        : `${pkg.credits} credits`;
      label = pkg.name;

    } else if (customCredits) {
      // ─── Custom amount purchase ───
      const amount = Number(customCredits);

      if (!Number.isFinite(amount) || amount < MIN_CUSTOM_CREDITS || amount > MAX_CUSTOM_CREDITS) {
        return res.status(400).json({
          error: `Custom amount must be between ${MIN_CUSTOM_CREDITS} and ${MAX_CUSTOM_CREDITS} credits`,
        });
      }

      // Round to whole number
      totalCredits = Math.floor(amount);
      const price = totalCredits * CUSTOM_PRICE_PER_CREDIT;
      priceInCents = Math.round(price * 100);
      productName = `${totalCredits} Credits`;
      productDescription = `Custom purchase — ${totalCredits} credits at €${CUSTOM_PRICE_PER_CREDIT.toFixed(2)}/credit`;
      label = 'Custom';

    } else {
      return res.status(400).json({ error: 'Missing packageId or customCredits' });
    }

    // Get or create Stripe customer
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, contact_name')
      .eq('id', user.id)
      .single();

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: profile?.contact_name || undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;

      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: productName,
              description: productDescription,
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.headers.origin}/credits?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/credits?cancelled=true`,
      metadata: {
        supabase_user_id: user.id,
        credits: String(totalCredits),
        package_name: label,
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (err: any) {
    console.error('Checkout session error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
