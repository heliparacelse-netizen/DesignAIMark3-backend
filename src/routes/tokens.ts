import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { User, Purchase } from '../models/index';

const router = Router();

const PLAN_LIMITS: Record<string, number> = { free: 75, starter: 500, pro: 1500, studio: 5000 };
const TOKEN_PACKS = [
  { id: 'pack_50', tokens: 50, price: 2.99, label: '50 tokens' },
  { id: 'pack_150', tokens: 150, price: 7.99, label: '150 tokens' },
  { id: 'pack_500', tokens: 500, price: 19.99, label: '500 tokens' },
  { id: 'pack_1500', tokens: 1500, price: 49.99, label: '1500 tokens' },
];

router.get('/', requireAuth, async (req: any, res: any) => {
  try {
    const user: any = await User.findById(req.user.id).select('tokens plan').lean();
    res.json({
      tokens: user?.tokens || 0,
      plan: user?.plan || 'free',
      planLimit: PLAN_LIMITS[user?.plan || 'free'],
      costPerGeneration: 25,
      costPerChat: 15,
      redesignsRemaining: Math.floor((user?.tokens || 0) / 25),
      chatMessagesRemaining: Math.floor((user?.tokens || 0) / 15),
      tokenPacks: TOKEN_PACKS,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/buy', requireAuth, async (req: any, res: any) => {
  try {
    const { packId } = req.body;
    const pack = TOKEN_PACKS.find(p => p.id === packId);
    if (!pack) return res.status(400).json({ error: 'Invalid pack' });
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return res.status(400).json({ error: 'Stripe not configured. Add STRIPE_SECRET_KEY to Render environment.' });
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' as any });
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: { currency: 'usd', unit_amount: Math.round(pack.price * 100), product_data: { name: `Roomvera AI — ${pack.label}`, description: `${pack.tokens} tokens for AI redesigns and chat` } },
        quantity: 1,
      }],
      success_url: `${process.env.FRONTEND_URL}/dashboard?purchased=true`,
      cancel_url: `${process.env.FRONTEND_URL}/dashboard/billing`,
      metadata: { userId: req.user.id, packId, tokens: pack.tokens.toString() },
    });
    res.json({ url: session.url });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
