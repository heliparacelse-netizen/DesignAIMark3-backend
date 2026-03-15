import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { User, Purchase } from '../models/index';

const router = Router();

const PLANS: Record<string, { tokens: number; name: string }> = {
  price_starter: { tokens: 120, name: 'starter' },
  price_pro: { tokens: 350, name: 'pro' },
  price_studio: { tokens: 1000, name: 'studio' },
};

router.post('/checkout', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { priceId } = req.body;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' as any });
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'], mode: 'subscription', customer_email: req.user!.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/dashboard?success=true`,
      cancel_url: `${process.env.FRONTEND_URL}/#pricing`,
      metadata: { userId: req.user!.id, priceId },
    });
    res.json({ url: session.url });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' as any });
    const event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'] as string, process.env.STRIPE_WEBHOOK_SECRET!);
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const priceId = session.metadata?.priceId;
      if (userId && priceId && PLANS[priceId]) {
        const plan = PLANS[priceId];
        await User.findByIdAndUpdate(userId, { plan: plan.name, tokens: plan.tokens, stripeId: session.customer });
        await Purchase.create({ userId, tokens: plan.tokens, amount: (session.amount_total || 0) / 100, plan: plan.name, stripeId: session.id });
      }
    }
    if (event.type === 'invoice.paid') {
      const invoice = event.data.object as Stripe.Invoice;
      const user = await User.findOne({ stripeId: invoice.customer });
      if (user) {
        const planTokens: Record<string, number> = { starter: 120, pro: 350, studio: 1000 };
        const tokens = planTokens[user.plan];
        if (tokens) await User.findByIdAndUpdate(user._id, { tokens });
      }
    }
    res.json({ received: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

export default router;
