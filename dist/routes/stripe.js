"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const stripe_1 = __importDefault(require("stripe"));
const auth_1 = require("../middleware/auth");
const index_1 = require("../models/index");
const router = (0, express_1.Router)();
const PLANS = {
    price_starter: { tokens: 120, name: 'starter' },
    price_pro: { tokens: 350, name: 'pro' },
    price_studio: { tokens: 1000, name: 'studio' },
};
router.post('/checkout', auth_1.requireAuth, async (req, res) => {
    try {
        const { priceId } = req.body;
        const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'], mode: 'subscription', customer_email: req.user.email,
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `${process.env.FRONTEND_URL}/dashboard?success=true`,
            cancel_url: `${process.env.FRONTEND_URL}/#pricing`,
            metadata: { userId: req.user.id, priceId },
        });
        res.json({ url: session.url });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/webhook', async (req, res) => {
    try {
        const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
        const event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            const userId = session.metadata?.userId;
            const priceId = session.metadata?.priceId;
            if (userId && priceId && PLANS[priceId]) {
                const plan = PLANS[priceId];
                await index_1.User.findByIdAndUpdate(userId, { plan: plan.name, tokens: plan.tokens, stripeId: session.customer });
                await index_1.Purchase.create({ userId, tokens: plan.tokens, amount: (session.amount_total || 0) / 100, plan: plan.name, stripeId: session.id });
            }
        }
        if (event.type === 'invoice.paid') {
            const invoice = event.data.object;
            const user = await index_1.User.findOne({ stripeId: invoice.customer }).lean();
            if (user) {
                const planTokens = { starter: 120, pro: 350, studio: 1000 };
                if (planTokens[user.plan])
                    await index_1.User.findByIdAndUpdate(user._id, { tokens: planTokens[user.plan] });
            }
        }
        res.json({ received: true });
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
exports.default = router;
